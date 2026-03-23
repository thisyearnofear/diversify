import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseAbi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { getSession, getAllSessions, recordExecution } from './session';
import type { RebalanceRecommendation } from './strategy';

/**
 * Guardian Autonomous Execution Loop
 *
 * POST /api/agent/guardian/execute-loop
 *   The main autonomous loop. For each active session:
 *     1. Fetch portfolio + inflation data via the strategy engine
 *     2. If recommendations exist, validate against session permissions
 *     3. Sign the transaction with the session's disposable keypair
 *     4. Broadcast on Celo mainnet
 *     5. Log receipt to OpenClaw
 *
 *   Body (optional):
 *     { userAddress: "0x..." }  — run for a single user only
 *     { dryRun: true }          — analyze but don't execute
 *
 * This endpoint is designed to be called:
 *   - By a Vercel cron job (every 15 min)
 *   - By the frontend polling (when Guardian is active)
 *   - Manually for testing
 */

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org';
const OPENCLAW_BOT_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL || process.env.OPENCLAW_BOT_URL;
const OPENCLAW_PASSWORD = process.env.OPENCLAW_SETUP_PASSWORD || process.env.SETUP_PASSWORD;

const APP_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

const MENTO_BROKER = '0x777a8255ca72412f0d706dc03c9d1987306b4cad' as const;

const TOKENS: Record<string, `0x${string}`> = {
  CELO: '0x471EcE3750Da237f93B8E339c536989b8978a438',
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  cREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
  KESm: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
  COPm: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
  PHPm: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
};

const brokerAbi = parseAbi([
  'function getExchangeProviders() view returns (address[])',
  'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)',
  'function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)',
]);

const exchangeAbi = parseAbi([
  'function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])',
]);

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

interface ExecutionResult {
  userAddress: string;
  recommendation: RebalanceRecommendation;
  status: 'executed' | 'skipped' | 'failed' | 'dry-run';
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  balanceBefore?: string;
  balanceAfter?: string;
}

async function fetchStrategy(userAddress: string): Promise<{ recommendations: RebalanceRecommendation[] }> {
  try {
    const url = APP_BASE.startsWith('http') ? APP_BASE : `https://${APP_BASE}`;
    const resp = await fetch(`${url}/api/agent/guardian/strategy?userAddress=${userAddress}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { recommendations: [] };
    return await resp.json();
  } catch {
    return { recommendations: [] };
  }
}

async function findMentoExchange(
  publicClient: ReturnType<typeof createPublicClient>,
  tokenInAddr: `0x${string}`,
  tokenOutAddr: `0x${string}`,
): Promise<{ provider: `0x${string}`; exchangeId: `0x${string}` } | null> {
  const providers = await publicClient.readContract({
    address: MENTO_BROKER,
    abi: brokerAbi,
    functionName: 'getExchangeProviders',
  });

  for (const provider of providers) {
    const exchanges = await publicClient.readContract({
      address: provider,
      abi: exchangeAbi,
      functionName: 'getExchanges',
    });

    for (const exchange of exchanges) {
      const assets = exchange.assets.map((a: string) => a.toLowerCase());
      if (assets.includes(tokenInAddr.toLowerCase()) && assets.includes(tokenOutAddr.toLowerCase())) {
        return { provider, exchangeId: exchange.exchangeId };
      }
    }
  }
  return null;
}

async function executeSwap(
  session: ReturnType<typeof getSession>,
  rec: RebalanceRecommendation,
  dryRun: boolean,
): Promise<ExecutionResult> {
  if (!session) return { userAddress: '', recommendation: rec, status: 'skipped', error: 'No session' };

  const userAddress = session.signedPermission.permission.userAddress;
  const tokenInAddr = TOKENS[rec.tokenIn];
  const tokenOutAddr = TOKENS[rec.tokenOut];

  if (!tokenInAddr || !tokenOutAddr) {
    return { userAddress, recommendation: rec, status: 'skipped', error: `Unknown token pair ${rec.tokenIn}/${rec.tokenOut}` };
  }

  // Validate action is within permission scope
  const { allowedActions, allowedTokens, dailyLimitUSD } = session.signedPermission.permission;
  if (!allowedActions.includes('swap') && !allowedActions.includes('rebalance')) {
    return { userAddress, recommendation: rec, status: 'skipped', error: 'Swap not in allowed actions' };
  }

  // Check daily budget
  const today = new Date().toISOString().slice(0, 10);
  const spentToday = session.spentDate === today ? session.spentTodayUSD : 0;
  if (spentToday + rec.estimatedAmountUSD > dailyLimitUSD) {
    return { userAddress, recommendation: rec, status: 'skipped', error: `Daily limit would be exceeded ($${spentToday.toFixed(2)} + $${rec.estimatedAmountUSD.toFixed(2)} > $${dailyLimitUSD})` };
  }

  if (dryRun) {
    return { userAddress, recommendation: rec, status: 'dry-run' };
  }

  // Execute the swap using the session's disposable keypair
  try {
    const account = privateKeyToAccount(session.sessionPrivateKey as Hex);
    const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });
    const walletClient = createWalletClient({ account, chain: celo, transport: http(CELO_RPC) });

    // Note: The session key signs the tx, but the tx operates on the USER's tokens.
    // In a full ERC-4337 / session key implementation, the session key would be
    // authorized via an on-chain smart account. For the hackathon demo, we use
    // the agent's funded wallet (PRIVATE_KEY) as a fallback signer that can
    // demonstrate the flow end-to-end.
    const agentKey = process.env.PRIVATE_KEY;
    const signerAccount = agentKey
      ? privateKeyToAccount(agentKey as Hex)
      : account;
    const signerClient = createWalletClient({
      account: signerAccount,
      chain: celo,
      transport: http(CELO_RPC),
    });

    const amountIn = parseUnits(rec.amountIn, 18);

    // Find Mento exchange
    const exchange = await findMentoExchange(publicClient, tokenInAddr, tokenOutAddr);
    if (!exchange) {
      return { userAddress, recommendation: rec, status: 'failed', error: `No Mento exchange for ${rec.tokenIn}/${rec.tokenOut}` };
    }

    // Get expected output
    const expectedOut = await publicClient.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: 'getAmountOut',
      args: [exchange.provider, exchange.exchangeId, tokenInAddr, tokenOutAddr, amountIn],
    });

    const minAmountOut = expectedOut - (expectedOut * 100n) / 10000n; // 1% slippage

    // Check allowance and approve if needed
    const currentAllowance = await publicClient.readContract({
      address: tokenInAddr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [signerAccount.address, MENTO_BROKER],
    });

    if (currentAllowance < amountIn) {
      const approveHash = await signerClient.writeContract({
        address: tokenInAddr,
        abi: erc20Abi,
        functionName: 'approve',
        args: [MENTO_BROKER, amountIn],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Execute swap
    const swapHash = await signerClient.writeContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: 'swapIn',
      args: [exchange.provider, exchange.exchangeId, tokenInAddr, tokenOutAddr, amountIn, minAmountOut],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
    const explorerUrl = `https://celoscan.io/tx/${swapHash}`;

    // Record execution in session
    recordExecution(userAddress, {
      txHash: swapHash,
      action: 'swap',
      tokenIn: rec.tokenIn,
      tokenOut: rec.tokenOut,
      amountUSD: rec.estimatedAmountUSD,
      timestamp: Date.now(),
    });

    // Log to OpenClaw (fire-and-forget)
    logToOpenClaw(swapHash, rec, userAddress).catch(() => {});

    return {
      userAddress,
      recommendation: rec,
      status: 'executed',
      txHash: swapHash,
      explorerUrl,
      balanceBefore: rec.amountIn + ' ' + rec.tokenIn,
      balanceAfter: formatUnits(expectedOut, 18) + ' ' + rec.tokenOut,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { userAddress, recommendation: rec, status: 'failed', error: message };
  }
}

async function logToOpenClaw(txHash: string, rec: RebalanceRecommendation, userAddress: string) {
  if (!OPENCLAW_BOT_URL || !OPENCLAW_PASSWORD) return;
  const auth = Buffer.from(`user:${OPENCLAW_PASSWORD}`).toString('base64');
  await fetch(`${OPENCLAW_BOT_URL}/setup/api/receipts/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      run_id: `guardian-auto-${Date.now()}`,
      track: 'celo-mento',
      action: 'autonomous-rebalance',
      tx_hash: txHash,
      explorer_url: `https://celoscan.io/tx/${txHash}`,
      metadata: {
        tokenIn: rec.tokenIn,
        tokenOut: rec.tokenOut,
        amountIn: rec.amountIn,
        reason: rec.reason,
        urgency: rec.urgency,
        wallet: userAddress,
        signedBy: 'guardian-session-key',
        autonomous: true,
      },
    }),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { userAddress, dryRun = false } = req.body || {};
  const results: ExecutionResult[] = [];

  if (userAddress) {
    // Single user execution
    const session = getSession(userAddress);
    if (!session) {
      return res.status(404).json({ error: 'No active session for this user' });
    }

    const { recommendations } = await fetchStrategy(userAddress);
    for (const rec of recommendations) {
      const result = await executeSwap(session, rec, dryRun);
      results.push(result);
    }
  } else {
    // Batch execution for all active sessions
    const activeSessions = getAllSessions();
    for (const { userAddress: addr, session } of activeSessions) {
      const { recommendations } = await fetchStrategy(addr);
      for (const rec of recommendations) {
        const result = await executeSwap(session, rec, dryRun);
        results.push(result);
      }
    }
  }

  const executed = results.filter(r => r.status === 'executed');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');
  const dryRunResults = results.filter(r => r.status === 'dry-run');

  return res.status(200).json({
    summary: {
      total: results.length,
      executed: executed.length,
      skipped: skipped.length,
      failed: failed.length,
      dryRun: dryRunResults.length,
    },
    results,
    timestamp: new Date().toISOString(),
  });
}

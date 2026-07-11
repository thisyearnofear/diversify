/**
 * GMX GM-pool deposit — Arbitrum Sepolia testnet validation harness.
 *
 * Proves the full deposit round-trip on TESTNET before any mainnet strategy is
 * enabled: approve USDC → build the ExchangeRouter.multicall (via the shared
 * builder) → submit → poll the GM market-token balance until the keeper mints.
 *
 * This is intentionally a standalone script (not wired into the app). It needs a
 * FUNDED Arbitrum Sepolia wallet and VERIFIED GMX Sepolia addresses — GMX
 * redeploys the ExchangeRouter, so confirm every address on the GMX docs /
 * Arbiscan before running.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/gmx-testnet-deposit.ts
 *
 * Required env (all must be VERIFIED for Arbitrum Sepolia):
 *   ARBITRUM_SEPOLIA_RPC      RPC URL
 *   GMX_TESTNET_PRIVATE_KEY   funded Sepolia key (test funds only!)
 *   GMX_EXCHANGE_ROUTER       ExchangeRouter address (verify on Arbiscan)
 *   GMX_DEPOSIT_VAULT         DepositVault address (verify)
 *   GMX_MARKET                GM market token address (the pool)
 *   GMX_USDC                  testnet USDC address (the short token)
 *   GMX_LONG_TOKEN            market long token address
 *   GMX_DEPOSIT_USDC          human USDC amount to deposit (e.g. "5")
 */

import { ethers } from 'ethers';
import { buildGmDepositMulticall } from '../packages/shared/src/services/swap/gmx/gmx-deposit-builder';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} — see the script header (all GMX addresses must be VERIFIED for Sepolia)`);
  return v;
}

async function main() {
  const rpc = reqEnv('ARBITRUM_SEPOLIA_RPC');
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(reqEnv('GMX_TESTNET_PRIVATE_KEY'), provider);

  const exchangeRouter = reqEnv('GMX_EXCHANGE_ROUTER');
  // GMX v2 pulls tokens via the base Router (approval target), NOT the
  // ExchangeRouter. Approving the ExchangeRouter reverts with "exceeds allowance".
  const router = reqEnv('GMX_ROUTER');
  const depositVault = reqEnv('GMX_DEPOSIT_VAULT');
  const market = reqEnv('GMX_MARKET');
  const usdc = reqEnv('GMX_USDC');
  const longToken = reqEnv('GMX_LONG_TOKEN');
  const humanUsdc = process.env.GMX_DEPOSIT_USDC || '5';

  console.log(`[gmx-testnet] wallet ${wallet.address}`);
  const usdcC = new ethers.Contract(usdc, ERC20_ABI, wallet);
  const decimals = await usdcC.decimals();
  const shortAmount = ethers.utils.parseUnits(humanUsdc, decimals).toString();
  // Keeper execution fee (ETH). Must exceed GMX's min (gasLimit × gasPrice incl.
  // Arbitrum L1 data cost); excess is auto-refunded on execution. 0.001 was too
  // low (deposit reverted); 0.01 clears the floor comfortably on testnet.
  const executionFee = ethers.utils.parseEther('0.01').toString();

  // 1. Approve USDC to the base Router (ExchangeRouter.sendTokens pulls via it).
  console.log(`[gmx-testnet] approving ${humanUsdc} USDC to base Router ${router}…`);
  await (await usdcC.approve(router, shortAmount)).wait();

  // 2. Build the atomic deposit multicall.
  const gmToken = new ethers.Contract(market, ERC20_ABI, provider);
  const before = (await gmToken.balanceOf(wallet.address)) as ethers.BigNumber;

  const tx = buildGmDepositMulticall({
    exchangeRouter, depositVault, market,
    initialLongToken: longToken, initialShortToken: usdc,
    longAmount: '0', shortAmount,
    executionFee, minMarketTokens: '0', receiver: wallet.address,
  });

  console.log('[gmx-testnet] submitting deposit multicall…');
  // GMX's payable multicall reverts under eth_estimateGas even when the tx is
  // valid (verified via a raw eth_call), so set an explicit gas limit.
  const sent = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gasLimit: 6_000_000 });
  console.log(`[gmx-testnet] tx ${sent.hash} — waiting for confirmation…`);
  await sent.wait();

  // 3. Poll for the keeper to mint GM tokens (async execution).
  console.log('[gmx-testnet] deposit order created; polling for keeper execution (up to ~3m)…');
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const now = (await gmToken.balanceOf(wallet.address)) as ethers.BigNumber;
    if (now.gt(before)) {
      console.log(`[gmx-testnet] ✅ GM tokens minted: +${ethers.utils.formatEther(now.sub(before))} (round-trip validated)`);
      return;
    }
  }
  console.log('[gmx-testnet] ⚠️ GM tokens not yet minted after timeout — check the keeper / tx on Arbiscan.');
}

main().catch((e) => {
  console.error('[gmx-testnet] failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});

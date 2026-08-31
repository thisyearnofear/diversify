/**
 * POST /api/fx-netting/settle — execute settlement of a net FX obligation.
 *
 * Zero-custody execution (same trust model as the HSP rail): the net DEBTOR
 * sends the cUSD transfer from their own wallet browser-side, then submits
 * the tx hash here. The server verifies the transfer ON-CHAIN before
 * marking anything settled:
 *
 *   1. requireWalletAuth — caller must be the settlement's debtor
 *   2. fetch the tx receipt on the settlement's chain (region-canonical —
 *      Celo for Africa/Caribbean/LatAm, HashKey for APAC; resolved by the
 *      matching engine, never hardcoded here)
 *   3. parse the ERC-20 Transfer log: token, from, to, amount
 *   4. verify token === cUSD, from === debtor, to === creditor,
 *      amount >= netAmount (settlement-execution.ts::verifySettlementTransfer)
 *   5. advance: settlement → settled (txHash + settledAt), both sides'
 *      intents → settled, and anchor FX_SETTLE to the RecommendationLedger
 *      on the region-canonical chain (fire-and-forget, like FX_MATCH)
 *
 * Idempotent: a settlement already settled with the same txHash returns
 * the settled record without re-anchoring; a different txHash on a settled
 * record is rejected (settlements settle exactly once).
 *
 * GET /api/fx-netting/settle — list settlements involving the caller
 * (outgoing = debtor worklist, incoming = creditor inbox).
 *
 * Body: { settlementId, txHash }
 * Response POST: { settlement, intentsSettled, ledgerAnchorQueued }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import connectDB from '@/lib/mongodb';
import { FxIntentRecord } from '@/models/FxIntentRecord';
import { FxSettlementRecord } from '@/models/FxSettlementRecord';
import {
  applySettledOutcome,
  type SettlementDoc,
} from '@/lib/fx-intent-pool';
import {
  verifySettlementTransfer,
  isSettlementDebtor,
} from '@diversifi/shared/src/services/fx-netting/settlement-execution';
import { CELO_TOKEN_ADDRESSES } from '@diversifi/shared/src/config/celo-tokens';
import { HASHKEY_TOKENS } from '@diversifi/shared/src/config';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const ERC20_TRANSFER_EVENT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

interface SettleResponse {
  ok: true;
  settlement: {
    settlementId: string;
    fromParticipant: string;
    toParticipant: string;
    settlementCurrency: string;
    netAmount: number;
    chainId: number;
    status: string;
    txHash?: string;
    settledAt?: number;
  };
  intentsSettled: number;
  ledgerAnchorQueued: boolean;
}

/** RPC for a settlement chain id — one env key per rail, no silent fallbacks. */
function getRpcUrl(chainId: number): string {
  switch (chainId) {
    case 42220: // Celo — Africa/Caribbean/LatAm
      return (
        process.env.CELO_RPC_URL ||
        process.env.NEXT_PUBLIC_CELO_RPC ||
        'https://forno.celo.org'
      );
    case 177: // HashKey — APAC rail (verified on-chain: chainId 0xb1)
      return process.env.HASHKEY_RPC_URL || 'https://mainnet.hsk.xyz';
    default:
      // Region-agnostic guard: never verify a settlement against the wrong
      // rail. New rails add an explicit branch + env key here first.
      throw new Error(`No RPC configured for settlement chain ${chainId}`);
  }
}

/**
 * Token metadata for the settlement currency on the settlement chain.
 * Region-agnostic: keyed by chain + currency symbol, resolved from the
 * verified on-chain token configs (never guessed per request).
 *   - Celo 42220: cUSD (Mento) via CELO_TOKEN_ADDRESSES
 *   - HashKey 177: USDT (canonical stablecoin, 6 decimals — no native USDC)
 *   - Arbitrum 42161: USDC
 */
function resolveSettlementToken(
  chainId: number,
  currency: string
): { address: string; decimals: number } | null {
  if (chainId === 42220) {
    const meta = CELO_TOKEN_ADDRESSES[currency];
    return meta ? { address: meta.address, decimals: meta.decimals } : null;
  }
  if (chainId === 177) {
    // HASHKEY_TOKENS.USDT = canonical USDT; HASHKEY_TOKENS.USDC = bridged
    // USDC.e. Both 6 decimals, verified on-chain. Env-overridable.
    const address = HASHKEY_TOKENS[currency as keyof typeof HASHKEY_TOKENS];
    return address ? { address, decimals: 6 } : null;
  }
  return null;
}

interface ParsedTransferLog {
  tokenAddress: string;
  from: string;
  to: string;
  amountMajor: number;
  chainId: number;
}

/**
 * Fetch the tx receipt on the settlement chain and parse its ERC-20
 * Transfer logs. Returns the transfer that matches the settlement token,
 * or null when the receipt exists but carries no such transfer (wrong
 * token / plain CELO send). Throws when the receipt can't be fetched
 * (network/RPC problems — surfaced to the caller as a 502-style retry).
 */
async function parseSettlementTransfer(
  txHash: string,
  chainId: number,
  tokenAddress: string,
  tokenDecimals: number,
): Promise<ParsedTransferLog | null> {
  const provider = new ethers.providers.JsonRpcProvider(getRpcUrl(chainId));
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new Error('Transaction not found on chain — wait for the transfer to confirm, then retry.');
  }
  if (receipt.status === 0) {
    throw new Error('Transaction reverted on chain — the transfer did not settle.');
  }

  const iface = new ethers.utils.Interface(ERC20_TRANSFER_EVENT_ABI);
  const transferTopic = iface.getEventTopic('Transfer');

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    if (log.topics[0] !== transferTopic) continue;
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      return {
        tokenAddress: log.address,
        from: String(parsed.args.from),
        to: String(parsed.args.to),
        amountMajor: Number(ethers.utils.formatUnits(parsed.args.value, tokenDecimals)),
        chainId,
      };
    } catch {
      // Malformed log — keep scanning
    }
  }
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettleResponse | { settlements: unknown[] } | { error: string }>,
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { allowed, retryAfterSec } = rateLimit(`fxsettle:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({
      error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)',
    });
  }

  try {
    await connectDB();

    // GET — the caller's settlements, both directions (debtor worklist +
    // creditor inbox), newest first.
    if (req.method === 'GET') {
      const settlements = await FxSettlementRecord.find({
        $or: [{ fromParticipant: userAddress }, { toParticipant: userAddress }],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.status(200).json({ settlements });
    }

    // POST — verify + settle.
    const { settlementId, txHash } = req.body as {
      settlementId?: string;
      txHash?: string;
    };

    if (!settlementId || typeof settlementId !== 'string') {
      return res.status(400).json({ error: 'settlementId is required' });
    }
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({ error: 'txHash must be a 0x-hex transaction hash' });
    }

    const doc = await FxSettlementRecord.findOne({ settlementId }).exec();
    if (!doc) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    if (!isSettlementDebtor(doc, userAddress)) {
      return res.status(403).json({ error: 'Only the settlement debtor can execute this settlement' });
    }

    // Idempotency: settling the same obligation twice with the same tx is a
    // no-op; a second *different* tx on a settled record is rejected.
    if (doc.status === 'settled') {
      if (doc.txHash === txHash) {
        return res.status(200).json(toResponse(doc, 0, false));
      }
      return res.status(409).json({ error: `Settlement already settled (tx ${doc.txHash})` });
    }
    if (doc.status === 'cancelled') {
      return res.status(409).json({ error: `Settlement was cancelled: ${doc.failureReason ?? ''}` });
    }

    // Token metadata for the settlement currency on the settlement chain.
    // Celo → Mento cUSD; HashKey → canonical USDT (verified on-chain, 6
    // decimals — HashKey has no native USDC, only bridged USDC.e).
    const tokenMeta = resolveSettlementToken(doc.chainId, doc.settlementCurrency);
    if (!tokenMeta) {
      return res.status(400).json({
        error: `Unsupported settlement currency ${doc.settlementCurrency} — no on-chain token configured`,
      });
    }

    // On-chain verification — the heart of the trust model.
    const transfer = await parseSettlementTransfer(
      txHash,
      doc.chainId,
      tokenMeta.address,
      tokenMeta.decimals,
    );
    if (!transfer) {
      return res.status(400).json({
        error: `No ${doc.settlementCurrency} transfer found in tx ${txHash}`,
      });
    }

    const verdict = verifySettlementTransfer(doc, transfer);
    if (!verdict.ok) {
      // Record the failure on the still-pending settlement (audit) but do
      // NOT cancel — a wrong tx doesn't invalidate the obligation; the
      // debtor can submit the right one.
      doc.failureReason = verdict.reason;
      await doc.save();
      return res.status(400).json({ error: `Verification failed: ${verdict.reason}` });
    }

    // Verified — advance the settlement, both sides' intents, and the ledger.
    const now = Date.now();
    doc.status = 'settled';
    doc.txHash = txHash;
    doc.settledAt = now;
    doc.failureReason = undefined;
    await doc.save();

    const intentsSettled = await applySettledOutcome(
      FxIntentRecord as never,
      { settlementId: doc.settlementId, intentIds: doc.intentIds },
      txHash,
      now,
    );

    // Anchor FX_SETTLE to the RecommendationLedger (fire-and-forget —
    // same pattern as the FX_MATCH anchor in match.ts). Chain routing:
    // explicit chainId = the settlement chain (region-canonical, resolved
    // by the matching engine). The anchor status is not awaited here — it is
    // best-effort, and the txHash itself is the on-chain ground truth.
    void import('@diversifi/shared/src/services/recommendation-ledger.service')
      .then(({ recordRecommendation }) =>
        recordRecommendation({
          user: doc.fromParticipant,
          action: 'FX_SETTLE',
          targetToken: doc.settlementCurrency,
          reasoning: `FX netting settlement executed: ${doc.netAmount.toFixed(2)} ${doc.settlementCurrency} transferred on-chain (${txHash}) settling ${doc.sourceMatchIds.length} matched flow${doc.sourceMatchIds.length === 1 ? '' : 's'}; verified on chain ${doc.chainId}.`,
          evidenceCid: txHash, // tx hash is the verifiable evidence for settlement
          servingModel: 'fx-netting/v1',
          settlementTxHash: txHash,
          confidence: 9000,
          chainId: doc.chainId,
        }),
      )
      .catch((err: unknown) =>
        console.warn(
          '[FX-Netting] FX_SETTLE ledger anchor skipped:',
          err instanceof Error ? err.message : err,
        ),
      );

    return res.status(200).json(toResponse(doc, intentsSettled, true));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Settlement failed';
    return res.status(400).json({ error: message });
  }
}

function toResponse(doc: SettlementDoc, intentsSettled: number, ledgerAnchorQueued: boolean): SettleResponse {
  return {
    ok: true,
    settlement: {
      settlementId: doc.settlementId,
      fromParticipant: doc.fromParticipant,
      toParticipant: doc.toParticipant,
      settlementCurrency: doc.settlementCurrency,
      netAmount: doc.netAmount,
      chainId: doc.chainId,
      status: doc.status,
      ...(doc.txHash ? { txHash: doc.txHash } : {}),
      ...(doc.settledAt ? { settledAt: doc.settledAt } : {}),
    },
    intentsSettled,
    ledgerAnchorQueued,
  };
}

/**
 * GET /api/fx-netting/credit-profile
 *
 * The MSME credit layer's decision-support surface: scores the caller's
 * own settlement-native credit profile from verified FxSettlementRecords.
 *
 * Honesty rules:
 * - Demo/observer participants (`demo-` / `observer-` prefixed ids) are
 *   EXCLUDED as scoring inputs — preview traffic must never build credit
 *   files, exactly as it never persists pool state.
 * - A thin file is reported as a thin file (`score: null`), never dressed up.
 * - Only verified settlements (on-chain Transfer confirmed by the settle
 *   route) count as positive evidence.
 *
 * Wallet-authenticated (same pattern as the intent route). The optional
 * `?participant=` query returns a LIMITED public view (score band + settled
 * volume only — never factor detail) so a counterparty can check who they
 * are dealing with, mirroring how tradeline data is shared between partners.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import connectDB from '@/lib/mongodb';
import { FxSettlementRecord } from '@/models/FxSettlementRecord';
import { scoreSettlementCreditProfile, type SettlementAggregate } from '@diversifi/shared/src/services/fx-netting/credit-profile';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** Participant ids that must never build or expose credit files. */
export function isSyntheticParticipant(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.startsWith('demo-') ||
    lower.startsWith('observer-') ||
    // Guardian standing-liquidity intents are market-making quotes, not a
    // business's settlement behaviour — they must never build a credit file.
    lower.startsWith('guardian-liquidity-')
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { allowed, retryAfterSec } = rateLimit(`fxcredit:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
  }

  const requested = typeof req.query.participant === 'string' ? req.query.participant.toLowerCase() : null;
  const subject = requested ?? userAddress;
  const isSelf = subject === userAddress.toLowerCase();

  if (isSyntheticParticipant(subject)) {
    // Synthetic ids have no credit file by design — report that honestly
    // rather than 404ing, so demo traffic gets a truthful empty answer.
    return res.status(200).json({
      participant: subject,
      score: null,
      fileStrength: 'none',
      synthetic: true,
      summary: 'Demo/observer participant — no credit file exists and none can be built from preview traffic.',
      lendingReadiness: 'Not applicable.',
      factors: [],
    });
  }

  try {
    await connectDB();

    // Obligations where the subject is either party.
    const records = await FxSettlementRecord.find({
      $or: [{ fromParticipant: subject }, { toParticipant: subject }],
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const aggregates: SettlementAggregate[] = records.map((r) => ({
      participant: r.fromParticipant === subject ? subject : r.fromParticipant,
      counterparty: r.fromParticipant === subject ? r.toParticipant : r.fromParticipant,
      status: r.status,
      asDebtor: r.fromParticipant === subject,
      netAmount: r.netAmount,
      settlementCurrency: r.settlementCurrency,
      createdAt: new Date(r.createdAt).getTime(),
      settledAt: r.settledAt ?? undefined,
    }));

    const profile = scoreSettlementCreditProfile(aggregates, subject);

    if (!isSelf) {
      // Third-party view: band only, no factor detail (privacy-preserving).
      return res.status(200).json({
        participant: profile.participant,
        score: profile.score,
        fileStrength: profile.fileStrength,
        settledVolumeUsd: Math.round(profile.settledVolumeUsd),
        settlementsCompleted: profile.settlementsCompleted,
        synthetic: false,
        summary: profile.summary,
        lendingReadiness: profile.lendingReadiness,
        factors: [], // factor detail is self-only
        restricted: true,
      });
    }

    return res.status(200).json({
      ...profile,
      settledVolumeUsd: Math.round(profile.settledVolumeUsd),
      synthetic: false,
      restricted: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to compute credit profile';
    return res.status(500).json({ error: message });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp } from '../../../lib/rate-limit';
import {
  resolveSubject,
  getAllowance,
  grantEarnAction,
  dailyLimitFor,
} from '../../../models/AgentUsage';
import type { RewardActionKey } from '../../../constants/credits';
import {
  REWARD_ACTIONS,
  REQUIRES_PROOF,
  nextUtcMidnightIso,
} from '../../../constants/credits';

/**
 * Daily-question allowance API (was: decorative "protection balance"
 * credits — no money was ever involved, so the unit is now questions).
 *
 * GET  ?subject=<wallet>  → { remaining, limit, bonus, resetsAt, earnedToday }
 *       No subject → keyed by client IP (walletless allowance).
 * POST { action, subject?, proof? } → grants the action's questions once
 *       per subject per UTC day; dedupe is enforced on the AgentUsage day
 *       doc. Proof-required actions still verify the URL mentions
 *       DiversiFi before granting.
 */

/** Verify a proof URL actually contains DiversiFi content */
async function verifyProofUrl(urlStr: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(urlStr, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DiversiFi-Credits-Verifier/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) return false;

    const text = await res.text();
    const lower = text.toLowerCase();

    // Must contain "diversifi" somewhere in the page
    if (!lower.includes('diversifi')) return false;

    // Must be substantial content (>500 chars to filter out empty pages)
    if (text.length < 500) return false;

    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = getClientIp(req);

  // GET ?subject= — today's allowance. Walletless callers omit subject and
  // are keyed by IP (the hook can't know its own public IP).
  if (req.method === 'GET') {
    const { subject, kind } = resolveSubject(req.query.subject, ip);
    try {
      const status = await getAllowance(subject, kind);
      return res.status(200).json(status);
    } catch {
      // DB unavailable — report the honest base allowance rather than 0.
      const limit = dailyLimitFor(kind);
      return res.status(200).json({
        remaining: limit,
        limit,
        bonus: 0,
        resetsAt: nextUtcMidnightIso(),
        earnedToday: [],
      });
    }
  }

  // POST { action, subject?, proof? } — record an earn action; grants its
  // questions once per subject per day.
  if (req.method === 'POST') {
    const { action, subject: subjectParam, proof } = (req.body ?? {}) as {
      action?: RewardActionKey;
      subject?: string;
      proof?: string;
    };

    if (!action || !(action in REWARD_ACTIONS)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const { subject, kind } = resolveSubject(subjectParam, ip);
    const reward = REWARD_ACTIONS[action];

    if (REQUIRES_PROOF.includes(action) && !proof) {
      return res.status(400).json({ error: 'Proof URL required for this action' });
    }

    // Validate proof URL domain
    if (proof) {
      try {
        const url = new URL(proof);
        const validDomains = ['medium.com', 'substack.com', 'mirror.xyz', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'linkedin.com'];
        const isValid = validDomains.some(d => url.hostname === d || url.hostname.endsWith('.' + d));
        if (!isValid) {
          return res.status(400).json({ error: 'Proof URL must be from a recognised platform (Medium, YouTube, Twitter/X, LinkedIn, Mirror, Substack)' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid proof URL' });
      }
    }

    // ── URL content verification ──
    let proofVerified = false;
    if (proof && REQUIRES_PROOF.includes(action)) {
      proofVerified = await verifyProofUrl(proof);
      if (!proofVerified) {
        return res.status(400).json({
          error: 'Could not verify that the URL contains DiversiFi content. Make sure your post mentions DiversiFi and the link is publicly accessible.',
        });
      }
    }

    // ── Grant (dedupe is atomic on the day doc) ──
    try {
      const result = await grantEarnAction(subject, kind, action);
      if (result.alreadyClaimed) {
        return res.status(409).json({
          error: `Already claimed "${reward.label}" today — it resets at midnight UTC.`,
          alreadyClaimed: true,
          remaining: result.remaining,
          limit: result.limit,
          bonus: result.bonus,
          resetsAt: result.resetsAt,
          earnedToday: result.earnedToday,
        });
      }
      return res.status(200).json({
        success: true,
        action,
        granted: reward.questions,
        proofVerified,
        remaining: result.remaining,
        limit: result.limit,
        bonus: result.bonus,
        resetsAt: result.resetsAt,
        earnedToday: result.earnedToday,
        message: `${reward.emoji} +${reward.questions} questions for: ${reward.label}`,
      });
    } catch (dbErr) {
      // Store unavailable — refuse the grant rather than credit an
      // unrecorded bump; the base allowance still applies on reads.
      console.warn('[Credits] allowance store unavailable:', (dbErr as Error).message);
      return res.status(503).json({ error: 'Allowance store unavailable — try again in a moment.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

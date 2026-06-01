import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { CreditClaim } from '../../../models/CreditClaim';
import type { RewardActionKey } from '../../../constants/credits';
import { REWARD_ACTIONS, REQUIRES_PROOF } from '../../../constants/credits';

/**
 * Credits & Freemium Status API
 *
 * Verifiable credit claims with server-side deduplication.
 * Each (userAddress, action) can only be claimed once — enforced at the
 * database level via a unique compound index.
 *
 * URL-based rewards (blog, video, tweet) are verified by fetching the URL
 * and checking for "DiversiFi" in the page text before granting credits.
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
  // GET — return reward action definitions
  if (req.method === 'GET') {
    return res.status(200).json({ rewardActions: REWARD_ACTIONS });
  }

  // POST — verify a proof URL and grant credits (one-time per user per action)
  if (req.method === 'POST') {
    const { action, proof, userAddress } = req.body as {
      action?: RewardActionKey;
      proof?: string;
      userAddress?: string;
    };

    if (!action || !(action in REWARD_ACTIONS)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // ── Rate limiting: max 3 POST claims per user per hour ──
    if (userAddress) {
      try {
        await dbConnect();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await CreditClaim.countDocuments({
          userAddress: userAddress.toLowerCase(),
          claimedAt: { $gte: oneHourAgo },
        });
        if (recentCount >= 3) {
          return res.status(429).json({
            error: 'Rate limit reached. You can claim up to 3 rewards per hour.',
          });
        }
      } catch {
        // DB unavailable — skip rate limiting
      }
    }

    if (REQUIRES_PROOF.includes(action) && !proof) {
      return res.status(400).json({ error: 'Proof URL required for this action' });
    }

    // Validate proof URL domain
    if (proof) {
      try {
        const url = new URL(proof);
        const validDomains = ['medium.com', 'substack.com', 'mirror.xyz', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'linkedin.com'];
        const isValid = validDomains.some(d => url.hostname.endsWith(d));
        if (!isValid) {
          return res.status(400).json({ error: 'Proof URL must be from a recognised platform (Medium, YouTube, Twitter/X, LinkedIn, Mirror, Substack)' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid proof URL' });
      }
    }

    const reward = REWARD_ACTIONS[action];

    // ── Server-side deduplication (MongoDB) ──
    if (userAddress) {
      try {
        await dbConnect();

        // Check if already claimed
        const existing = await CreditClaim.findOne({
          userAddress: userAddress.toLowerCase(),
          action,
        });

        if (existing) {
          return res.status(409).json({
            error: `You've already claimed the ${reward.label} reward.`,
            alreadyClaimed: true,
          });
        }
      } catch (dbErr) {
        // DB unavailable — fall through to client-side-only mode
        console.warn('[Credits] DB unavailable, skipping server-side dedup:', (dbErr as Error).message);
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

    // ── Persist claim to MongoDB ──
    if (userAddress) {
      try {
        await CreditClaim.create({
          userAddress: userAddress.toLowerCase(),
          action,
          creditsEarned: reward.credits,
          proof: proof || null,
          proofVerified,
        });
      } catch (dbErr) {
        // If duplicate (race condition), still return success since client already incremented
        console.warn('[Credits] Failed to persist claim:', (dbErr as Error).message);
      }
    }

    return res.status(200).json({
      success: true,
      action,
      creditsEarned: reward.credits,
      proofVerified,
      message: `${reward.emoji} +$${reward.credits.toFixed(2)} USDC credits for: ${reward.label}`,
    });
  }

  // GET /claims — return all claims for a user (used to sync on connect)
  if (req.method === 'GET' && req.query.userAddress) {
    const userAddress = String(req.query.userAddress).toLowerCase();
    try {
      await dbConnect();
      const claims = await CreditClaim.find({ userAddress }).sort({ claimedAt: -1 }).lean();
      const totalEarned = claims.reduce((sum, c) => sum + c.creditsEarned, 0);
      const completedActions = claims.map(c => c.action);
      return res.status(200).json({ claims, totalEarned, completedActions });
    } catch {
      return res.status(200).json({ claims: [], totalEarned: 0, completedActions: [] });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
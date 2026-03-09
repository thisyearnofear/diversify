import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Credits & Freemium Status API
 *
 * Stateless endpoint — all credit state is owned client-side in localStorage
 * via the useCredits hook. This endpoint exists only for:
 *   - Proof-of-action verification (blog/video/tweet URL validation)
 *   - Referral attribution (cross-device, best-effort)
 *
 * No in-memory Maps — no state lost on Vercel cold start.
 */

// Referral/action rewards (credited in USDC equivalent) — single source of truth
export const REWARD_ACTIONS = {
  share_app:       { label: 'Share the app',                    credits: 0.05, emoji: '📣' },
  blog_post:       { label: 'Write a blog post',                credits: 0.25, emoji: '✍️' },
  youtube_video:   { label: 'Make a YouTube video',             credits: 0.50, emoji: '🎥' },
  twitter_thread:  { label: 'Post a Twitter/X thread',          credits: 0.10, emoji: '🐦' },
  invite_friend:   { label: 'Invite a friend who connects',     credits: 0.10, emoji: '👥' },
  gooddollar_claim:{ label: 'Claim your daily G$',              credits: 0.02, emoji: '🌱' },
} as const;

export type RewardActionKey = keyof typeof REWARD_ACTIONS;

const requiresProof: RewardActionKey[] = ['blog_post', 'youtube_video', 'twitter_thread'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — return reward action definitions (client uses these to render UI)
  if (req.method === 'GET') {
    return res.status(200).json({ rewardActions: REWARD_ACTIONS });
  }

  // POST — verify a proof URL and return the credit amount to grant client-side
  if (req.method === 'POST') {
    const { action, proof } = req.body as { action?: RewardActionKey; proof?: string };

    if (!action || !(action in REWARD_ACTIONS)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (requiresProof.includes(action) && !proof) {
      return res.status(400).json({ error: 'Proof URL required for this action' });
    }

    // Basic proof URL validation for verifiable actions
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
    return res.status(200).json({
      success: true,
      action,
      creditsEarned: reward.credits,
      message: `${reward.emoji} +$${reward.credits.toFixed(2)} USDC credits for: ${reward.label}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

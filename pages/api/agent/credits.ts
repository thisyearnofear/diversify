import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Credits & Freemium Status API
 *
 * Surfaces user credit balance, free tier usage, trial status, and
 * referral/action reward eligibility to the client.
 *
 * CLEAN: Reads from the same in-memory UserManager as x402-gateway via
 * a shared module-level export. Falls back to a lightweight local store
 * for the credits-only path so this endpoint stays independent.
 */

// Free trial: 7 days from first seen, $0.50 USDC equivalent in credits
const FREE_TRIAL_DAYS = 7;
const FREE_TRIAL_CREDITS = 0.5;

// Referral/action rewards (credited in USDC equivalent)
export const REWARD_ACTIONS = {
  share_app: { label: 'Share the app', credits: 0.05, emoji: '📣' },
  blog_post: { label: 'Write a blog post', credits: 0.25, emoji: '✍️' },
  youtube_video: { label: 'Make a YouTube video', credits: 0.50, emoji: '🎥' },
  twitter_thread: { label: 'Post a Twitter/X thread', credits: 0.10, emoji: '🐦' },
  invite_friend: { label: 'Invite a friend who connects', credits: 0.10, emoji: '👥' },
  gooddollar_claim: { label: 'Claim your daily G$', credits: 0.02, emoji: '🌱' },
} as const;

export type RewardActionKey = keyof typeof REWARD_ACTIONS;

interface TrialState {
  startedAt: number;
  creditsGranted: boolean;
  completedActions: RewardActionKey[];
  referralCode: string;
  referredBy?: string;
}

// Lightweight in-memory store (same pattern as UserManager in x402-gateway)
const trialStore = new Map<string, TrialState>();
const creditStore = new Map<string, number>(); // clientKey -> bonus credits from rewards

function getClientKey(req: NextApiRequest): string {
  const ip = (req.headers['x-forwarded-for'] as string) || req.connection?.remoteAddress || 'unknown';
  const address = req.query.address as string;
  // Prefer wallet address as key (persistent across IPs), fall back to IP
  return address?.toLowerCase() || (Array.isArray(ip) ? ip[0] : ip);
}

function getOrCreateTrial(clientKey: string): TrialState {
  if (!trialStore.has(clientKey)) {
    const code = `DIVERSIFI-${clientKey.slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    trialStore.set(clientKey, {
      startedAt: Date.now(),
      creditsGranted: false,
      completedActions: [],
      referralCode: code,
    });
  }
  return trialStore.get(clientKey)!;
}

function isTrialActive(trial: TrialState): boolean {
  return Date.now() - trial.startedAt < FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

function trialDaysRemaining(trial: TrialState): number {
  const elapsed = (Date.now() - trial.startedAt) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(FREE_TRIAL_DAYS - elapsed));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientKey = getClientKey(req);

  // GET — return current status
  if (req.method === 'GET') {
    const trial = getOrCreateTrial(clientKey);

    // Grant free trial credits on first visit
    if (!trial.creditsGranted) {
      trial.creditsGranted = true;
      creditStore.set(clientKey, (creditStore.get(clientKey) || 0) + FREE_TRIAL_CREDITS);
    }

    const bonusCredits = creditStore.get(clientKey) || 0;
    const active = isTrialActive(trial);

    const availableActions = (Object.entries(REWARD_ACTIONS) as [RewardActionKey, typeof REWARD_ACTIONS[RewardActionKey]][])
      .filter(([key]) => !trial.completedActions.includes(key))
      .map(([key, val]) => ({ key, ...val }));

    return res.status(200).json({
      trial: {
        active,
        daysRemaining: trialDaysRemaining(trial),
        creditsGranted: FREE_TRIAL_CREDITS,
        startedAt: trial.startedAt,
      },
      credits: {
        bonus: parseFloat(bonusCredits.toFixed(4)),
        currency: 'USDC',
      },
      referral: {
        code: trial.referralCode,
        completedActions: trial.completedActions,
        availableActions,
        totalEarned: trial.completedActions.reduce(
          (sum, key) => sum + REWARD_ACTIONS[key].credits,
          0
        ),
      },
    });
  }

  // POST — claim a reward action
  if (req.method === 'POST') {
    const { action, proof, referralCode } = req.body as {
      action?: RewardActionKey;
      proof?: string; // URL to blog post / tweet / video
      referralCode?: string;
    };

    const trial = getOrCreateTrial(clientKey);

    // Handle referral attribution
    if (referralCode && !trial.referredBy) {
      trial.referredBy = referralCode;
      // Credit the referrer
      const referrerKey = [...trialStore.entries()].find(
        ([, t]) => t.referralCode === referralCode
      )?.[0];
      if (referrerKey && referrerKey !== clientKey) {
        const reward = REWARD_ACTIONS.invite_friend.credits;
        creditStore.set(referrerKey, (creditStore.get(referrerKey) || 0) + reward);
      }
    }

    if (!action || !(action in REWARD_ACTIONS)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (trial.completedActions.includes(action)) {
      return res.status(409).json({ error: 'Action already claimed' });
    }

    // For verifiable actions (blog/video/tweet), require a proof URL
    const requiresProof: RewardActionKey[] = ['blog_post', 'youtube_video', 'twitter_thread'];
    if (requiresProof.includes(action) && !proof) {
      return res.status(400).json({ error: 'Proof URL required for this action' });
    }

    const reward = REWARD_ACTIONS[action];
    trial.completedActions.push(action);
    creditStore.set(clientKey, (creditStore.get(clientKey) || 0) + reward.credits);

    return res.status(200).json({
      success: true,
      action,
      creditsEarned: reward.credits,
      newBalance: parseFloat(((creditStore.get(clientKey) || 0)).toFixed(4)),
      message: `${reward.emoji} +$${reward.credits.toFixed(2)} USDC credits for: ${reward.label}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Daily-question allowance constants.
 *
 * Replaces the old decorative "protection balance" (a localStorage dollar
 * figure nothing deducted). The unit is now *questions*: each advisor call
 * consumes one question, earn actions grant extra questions, and everything
 * resets at UTC midnight. Enforcement lives server-side (AgentUsage model +
 * the advisor gate); this file holds only the shared numbers and labels.
 *
 * Shared between client (useAllowance hook) and server (credits + advisor
 * API routes). Must NOT import from models/ or pages/api/ — those have
 * server-only deps.
 */

export type RewardActionKey =
  | 'share_app'
  | 'blog_post'
  | 'youtube_video'
  | 'twitter_thread'
  | 'gooddollar_claim';

/**
 * Earn grants, in questions — one grant per action per subject per UTC day
 * (dedupe is server-side on the AgentUsage day doc).
 */
export const REWARD_ACTIONS = {
  youtube_video:    { label: 'make a video',       questions: 50, emoji: '🎥' },
  blog_post:        { label: 'write a blog post',  questions: 25, emoji: '✍️' },
  twitter_thread:   { label: 'post a thread',      questions: 10, emoji: '🐦' },
  share_app:        { label: 'share the app',      questions: 5,  emoji: '📣' },
  gooddollar_claim: { label: 'claim daily G$',     questions: 3,  emoji: '🌱' },
} as const;

export const REQUIRES_PROOF: RewardActionKey[] = ['blog_post', 'youtube_video', 'twitter_thread'];

/** Base daily allowance: wallet-connected vs walletless (IP-keyed). */
export const WALLET_DAILY_QUESTIONS = 10;
export const ANON_DAILY_QUESTIONS = 3;

/** UTC day key 'YYYY-MM-DD' — the allowance period boundary. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ISO timestamp of the next UTC midnight — when the allowance resets. */
export function nextUtcMidnightIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

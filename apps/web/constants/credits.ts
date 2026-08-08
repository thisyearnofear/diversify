/**
 * Credit reward type definitions and constants.
 *
 * Shared between client (useCredits hook) and server (credits API route).
 * Must NOT import from models/ or pages/api/ — those have server-only deps.
 */

export type RewardActionKey =
  | 'share_app'
  | 'blog_post'
  | 'youtube_video'
  | 'twitter_thread'
  | 'gooddollar_claim';

export const REWARD_ACTIONS = {
  share_app:       { label: 'Share the app',                    credits: 0.05, emoji: '📣' },
  blog_post:       { label: 'Write a blog post',                credits: 0.25, emoji: '✍️' },
  youtube_video:   { label: 'Make a YouTube video',             credits: 0.50, emoji: '🎥' },
  twitter_thread:  { label: 'Post a Twitter/X thread',          credits: 0.10, emoji: '🐦' },
  gooddollar_claim:{ label: 'Claim your daily G$',              credits: 0.02, emoji: '🌱' },
} as const;

export const REQUIRES_PROOF: RewardActionKey[] = ['blog_post', 'youtube_video', 'twitter_thread'];

export const FREE_TRIAL_DAYS = 7;
export const FREE_TRIAL_CREDITS = 0.5;
export const STORAGE_KEY = 'diversifi-credits';
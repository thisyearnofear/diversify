/**
 * sentiment — the nation confidence poll's shared logic.
 *
 * The poll is deliberately a *confidence* instrument: "confident /
 * neutral / worried" about a country's money. It never asks will-it-go-
 * up, never implies a trade, and an uncovered currency can't be voted on
 * (the server allowlists codes against the curated dataset — a vote for
 * a currency we can't score is a vote we can't honestly count).
 *
 * Validation helpers are pure so the endpoint stays thin and the rules
 * are unit-testable.
 */
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { apiUrl } from '@/lib/api-url';

export const SENTIMENTS = ['confident', 'neutral', 'worried'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

const SESSION_KEY = 'diversifi-anon-session';
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface SentimentTally {
  confident: number;
  neutral: number;
  worried: number;
}

export interface SentimentResult {
  code: string;
  tally: SentimentTally;
  total: number;
  yourVote: Sentiment | null;
}

/** The anonymous per-browser id shared with funnel analytics — a vote
 *  and its funnel events should look like the same visitor. Null on the
 *  server or when storage is unavailable. */
export function sentimentSessionId(): string | null {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** A votable currency code (uppercased), or null. */
export function validVoteCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const upper = code.toUpperCase();
  return CURRENCY_BY_CODE[upper] ? upper : null;
}

/** A valid sentiment pick, or null. */
export function validSentiment(value: unknown): Sentiment | null {
  return typeof value === 'string' &&
    (SENTIMENTS as readonly string[]).includes(value)
    ? (value as Sentiment)
    : null;
}

/** A well-formed anonymous session id, or null. */
export function validSessionId(value: unknown): string | null {
  return typeof value === 'string' && SESSION_RE.test(value) ? value : null;
}

/** Grouped aggregation rows → the tally shape. Missing buckets are 0. */
export function tallyFromRows(
  rows: Array<{ _id: string; count: number }>,
): SentimentTally {
  const tally: SentimentTally = { confident: 0, neutral: 0, worried: 0 };
  for (const row of rows) {
    if (row._id in tally) tally[row._id as Sentiment] = row.count;
  }
  return tally;
}

// ── Client calls ─────────────────────────────────────────────────────

/** Read the tally for one currency; the caller's own vote comes back
 *  when a session id is supplied. Null on any failure — the poll is a
 *  delight surface, never a blocker. */
export async function fetchSentiment(
  code: string,
  sessionId?: string | null,
): Promise<SentimentResult | null> {
  try {
    const params = new URLSearchParams({ code });
    if (sessionId) params.set('session', sessionId);
    const res = await fetch(apiUrl(`/api/sentiment?${params}`));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.code === code.toUpperCase() ? (data as SentimentResult) : null;
  } catch {
    return null;
  }
}

/** Cast or change a vote. Returns the fresh tally, or null on failure. */
export async function castVote(
  code: string,
  sentiment: Sentiment,
  sessionId: string,
): Promise<SentimentResult | null> {
  try {
    const res = await fetch(apiUrl('/api/sentiment'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code, sentiment }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.code === code.toUpperCase() ? (data as SentimentResult) : null;
  } catch {
    return null;
  }
}

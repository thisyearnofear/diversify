/**
 * shield-ledger-view — the ledger as ring material.
 *
 * Shield's Verify band re-slices the plan ring into the public ledger, so the
 * numbers the arcs are drawn from have to be real proportions of something the
 * feed actually stores. The feed stores a decision count and a target token per
 * record — no dollars, no sizes. So an arc is a token's share of the decisions
 * in the read window, and the caption under the object says exactly that.
 *
 * Nothing here is inferred: an unreadable feed yields no legs (the ring keeps
 * the plan and the band fails closed), and the total the hole counts up is the
 * ledger's own `stats.totalRecommendations`, not a length.
 */
import { canonicalToken } from '@/lib/plan-legs';
import type { LedgerRecommendation, ProofFeedData } from '@/hooks/use-proof-feed';

/** Ceiling on arcs the ring can hold before tokens fold into "Other". The
 *  caller's plan usually caps it lower — see `maxLegs`. */
export const MAX_LEDGER_ARCS = 5;/** The folded bucket's id — never a real token, so selecting it can't leak
 *  into the plan's slice machinery. */
export const LEDGER_OTHER_TOKEN = '__ledger_other__';

export interface LedgerLeg {
  /** Canonical token name — the arc's key, shared with the plan legs. */
  token: string;
  /** Decisions in the read window that name this token. */
  count: number;
  /** count / window × 100 — a share of the window, not of anyone's money. */
  percent: number;
  /** The newest record for this token, so a row can be read and checked. */
  latest: LedgerRecommendation;
  /** How many distinct tokens a folded leg covers (the "Other" arc only). */
  foldedTokens?: number;
}

export type LedgerViewState = 'loading' | 'unreachable' | 'empty' | 'ready';

export interface LedgerView {
  state: LedgerViewState;
  legs: LedgerLeg[];
  /** Records the arcs are measured over. */
  windowCount: number;
  /** The ledger's own decision count — the whole, not the window. */
  totalDecisions: number;
  isStale: boolean;
}

interface Bucket {
  token: string;
  count: number;
  latest: LedgerRecommendation;
}

const NO_LEGS: LedgerView = {
  state: 'empty',
  legs: [],
  windowCount: 0,
  totalDecisions: 0,
  isStale: false,
};

/** A record can only be drawn if it names a token — a blank target would
 *  invent an arc. */
function isLegible(rec: LedgerRecommendation): boolean {
  return Boolean(rec?.targetToken);
}

export function ledgerViewFrom(
  data: ProofFeedData | null,
  opts: {
    isLoading: boolean;
    isStale: boolean;
    error: string | null;
    /** The plan's own leg count, when the ring is showing its legend rows.
     *  The ledger reading replaces those rows, so it never draws more than
     *  they did — a taller legend grows the stage and moves the page (§5
     *  rail 2: the stage has a floor). Omit where the ring has no legend at
     *  all (the compact picker): a one-leg plan must not fold the whole
     *  ledger into a single "Other" arc. */
    maxLegs?: number;
  },
): LedgerView {
  if (!data) {
    return {
      ...NO_LEGS,
      isStale: opts.isStale,
      state: opts.isLoading ? 'loading' : opts.error ? 'unreachable' : 'empty',
    };
  }
  const totalDecisions = data.stats?.totalRecommendations ?? 0;
  const rows = (data.recent ?? []).filter(isLegible);
  if (rows.length === 0) {
    return { ...NO_LEGS, totalDecisions, isStale: opts.isStale, state: 'empty' };
  }

  const byToken = new Map<string, Bucket>();
  for (const rec of rows) {
    const token = canonicalToken(rec.targetToken);
    const bucket = byToken.get(token);
    if (!bucket) byToken.set(token, { token, count: 1, latest: rec });
    else {
      bucket.count += 1;
      if (rec.timestamp > bucket.latest.timestamp) bucket.latest = rec;
    }
  }

  const sorted = [...byToken.values()].sort(
    (a, b) => b.count - a.count || b.latest.timestamp - a.latest.timestamp,
  );
  const cap = Math.max(1, Math.min(MAX_LEDGER_ARCS, opts.maxLegs ?? MAX_LEDGER_ARCS));
  const kept = sorted.slice(0, sorted.length > cap ? cap - 1 : cap);
  const rest = sorted.slice(kept.length);
  if (rest.length > 0) {
    kept.push({
      token: LEDGER_OTHER_TOKEN,
      count: rest.reduce((sum, r) => sum + r.count, 0),
      latest: rest.reduce(
        (acc, r) => (r.latest.timestamp > acc.latest.timestamp ? r : acc),
        rest[0]
      ).latest,
    });
  }

  const legs: LedgerLeg[] = kept.map((bucket) => ({
    token: bucket.token,
    count: bucket.count,
    percent: Math.round((bucket.count / rows.length) * 1000) / 10,
    latest: bucket.latest,
    ...(bucket.token === LEDGER_OTHER_TOKEN ? { foldedTokens: rest.length } : {}),
  }));

  return { state: 'ready', legs, windowCount: rows.length, totalDecisions, isStale: opts.isStale };
}

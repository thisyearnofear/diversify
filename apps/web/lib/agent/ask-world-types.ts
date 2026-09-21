/**
 * Shared vocabulary for the "Ask the World" fast-answer path: the pure
 * classifier (ask-world-intent.ts) produces AskWorldQuery, the resolvers
 * (ask-world-facts.ts) produce WorldAnswer, and the chat card renders it.
 * Kept in its own types-only module so hook, resolvers, and components
 * can import without cycles.
 *
 * Honesty contract: every entry carries its own source + as-of; `isLive`
 * distinguishes measured live data from curated reference data, and the
 * badge copy rules in ask-world-facts.ts make a reference answer say
 * "not live" — the word "live" never appears with mode 'reference'.
 */

export type AskWorldKind =
    | 'inflation_rank'
    | 'inflation_single'
    | 'depreciation_rank'
    | 'depreciation_single';

export type AskWorldQuery =
    | { kind: 'inflation_rank'; comparator: 'higher' | 'lower'; thresholdPct: number }
    | { kind: 'inflation_single'; countryName: string }
    | { kind: 'depreciation_rank'; horizon: 1 | 3 | 5 }
    | { kind: 'depreciation_single'; currencyOrCountry: string; horizon: 1 | 3 | 5 };

export type WorldFactSource = 'imf' | 'worldbank' | 'fawazahmed0' | 'curated' | 'fallback';

export interface WorldAnswerEntry {
    /** Currency code for depreciation answers (canonical mixed-case, e.g. NGN). */
    code?: string;
    /** Display name — country for inflation, currency-name for depreciation. */
    country: string;
    iso2?: string;
    /** Flag emoji; always resolvable via flagEmojiForIso2. */
    flag: string;
    /**
     * Signed percent. Inflation: annual CPI %, e.g. 14.2. Depreciation vs
     * USD: negative = lost value (matches both live DepreciationResult and
     * curated vsUSD signs), so "lost the most" sorts most-negative first.
     */
    value: number;
    /** Preformatted for display ("−23.1%", "14.2%") — never a signed −0%. */
    valueLabel: string;
    source: WorldFactSource;
    /** ISO date or year the number refers to. */
    dataAsOf: string;
    isLive: boolean;
}

export interface WorldAnswer {
    kind: AskWorldKind;
    /** 1–2 lines revealed by MaskedReveal. */
    headline: string[];
    /** Ranked best-match-first; capped by the builders at MAX_ENTRIES. */
    entries: WorldAnswerEntry[];
    /** Rows dropped for absent data — disclosed, never zero-filled. */
    omittedCount: number;
    badge: {
        mode: 'live' | 'reference';
        /** Human label, e.g. "IMF", "World Bank", "reference dataset". */
        sources: string;
        dataAsOf: string;
        /** Client-measured wall time of the actual fetch + compute. */
        latencyMs: number;
    };
}

export const MAX_WORLD_ANSWER_ENTRIES = 12;

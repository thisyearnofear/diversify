/**
 * Deterministic classifier for factual "ask the world" macro questions —
 * which countries passed a given inflation line, how high inflation is
 * somewhere, which currency lost the most value vs the dollar. Regex on
 * purpose (mirrors guardian-visibility-intent.ts): a matched question is
 * answered from real data with zero LLM tokens, so the answer is instant,
 * offline-cheap, and honest by construction.
 *
 * Scope rule (hard): this path answers read-only facts only. Any advice
 * modal ("should I…"), first-person/portfolio framing, non-USD benchmark
 * comparison, or compound sentence returns null and falls through to the
 * advisor. Entity *resolution* (name/currency → ISO3) lives in
 * ask-world-facts.ts — an unresolved entity also falls through, where the
 * advisor's web search can still help.
 */

import type { AskWorldQuery } from './ask-world-types';

/** Advice / recommendation markers — always advisor territory. */
const ADVICE_BLOCK = /\b(should|advise|advice|recommend|recommendation|wise|worth moving|migrat\w*)\b/;
/** First-person or portfolio framings imply "for ME" — advisor territory. */
const PERSONAL_BLOCK = /\b(my|mine|portfolio|holdings|i'm|i am|i've|we have|our balance)\b/;
/** v1 depreciation answers are vs-USD only (curated + live both keyed that way). */
const NON_USD_BENCHMARK = /\b(gold|xau|euro|eur|pound|gbp|yen|jpy|franc)\b/;

const WORD_NUMBERS: Record<string, 1 | 3 | 5> = { one: 1, three: 3, five: 5 };

/** Captured entity text is raw — these markers mean the "entity" is really
 *  sentence scaffolding ("which countries had inflation…"), not a name. */
const ENTITY_STOPWORDS = new Set([
    'which', 'what', 'the', 'a', 'an', 'country', 'countries', 'economies', 'economy',
    'nation', 'nations', 'currency', 'currencies', 'was', 'is', 'are', 'does', 'do',
    'high', 'how', 'list', 'rate', 'rates', 'level', 'levels', 'have', 'has', 'had',
    'where', 'lowest', 'highest', 'inflation', 'lost', 'lose', 'loses', 'losing', 'value', 'did',
    'over', 'above', 'below', 'under', 'than', 'higher', 'greater', 'exceeds', 'last', 'past',
    'from', 'with', 'about', 'since', 'vs', 'against',
]);

/** Strips sentence scaffolding out of a captured entity; null if nothing
 *  name-like survives. Resolution to ISO3 stays in ask-world-facts.ts. */
function sanitizeEntity(raw: string): string | null {
    const cleaned = raw
        .replace(/[?!.]+$/g, '')
        .split(/\s+/)
        .filter((w) => w && !ENTITY_STOPWORDS.has(w))
        .join(' ')
        .trim();
    return cleaned && cleaned.length <= 30 ? cleaned : null;
}

function parseHorizon(text: string): 1 | 3 | 5 | null | undefined {
    const numeric = /\b(\d+)\s*(?:years?|yrs?)\b/.exec(text);
    if (numeric) {
        const n = Number(numeric[1]);
        if (n === 1 || n === 3 || n === 5) return n;
        return null; // a horizon we have no data shape for → advisor
    }
    const word = /\b(one|three|five)\s+(?:years|year|yrs|yr)\b/.exec(text);
    if (word) return WORD_NUMBERS[word[1]];
    return undefined; // no horizon stated → caller defaults
}

function parseThreshold(text: string): { comparator: 'higher' | 'lower'; thresholdPct: number } | null {
    const m =
        /\b(?:higher|greater|more|above|over|worse|exceed(?:s|ing)?)\s*(?:than)?\s*(\d+(?:\.\d+)?)(?!\s*(?:years?|yrs?))\s*(?:%|percent)?\b/.exec(
            text,
        ) || /\blower\b.*?\b(?:than|below|under)\s*(\d+(?:\.\d+)?)\s*(?:%|percent)?\b/.exec(text) ||
        /\b(?:lower|less|below|under)\s*(?:than)?\s*(\d+(?:\.\d+)?)(?!\s*(?:years?|yrs?))\s*(?:%|percent)?\b/.exec(text);
    if (!m) return null;
    const thresholdPct = Number(m[1]);
    if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct > 200) return null;
    const comparator: 'higher' | 'lower' = /lower|less|below|under/.test(m[0]) ? 'lower' : 'higher';
    return { comparator, thresholdPct };
}

/** "inflation in japan", "japan's inflation", "inflation rate nigeria" → entity text. */
function parseInflationEntity(text: string): string | null {
    const pre = /\binflation(?:\s+rate)?\s+(?:in|for|of|at)\s+([a-z][a-z\s'.-]{1,30})/.exec(text);
    if (pre) return sanitizeEntity(pre[1]);
    const poss = /\b([a-z][a-z\s'.-]{1,30})'s\s+inflation\b/.exec(text);
    if (poss) return sanitizeEntity(poss[1]);
    const post = /\b([a-z][a-z\s'.-]{1,30}?)\s+inflation\b/.exec(text);
    if (post) return sanitizeEntity(post[1]);
    const trail = /\binflation(?:\s+(?:rate|levels?))?\s+([a-z][a-z\s'.-]{1,30})/.exec(
        text.replace(/[?!.]+$/, ''),
    );
    if (trail) return sanitizeEntity(trail[1]);
    return null;
}

/** "how much has ngn lost over 5 years" → entity text. */
function parseDepreciationEntity(text: string): string | null {
    const m =
        /\bhow much\b.*?\b(?:has|did)?\s*(?:the\s+)?(.+?)\s+los(?:e|es|ed|t|ing)\b/.exec(text) ||
        /\b(.+?)\s+(?:lost|depreciated|weakened)\b/.exec(text) ||
        /\b(ngn|ars|try|egp|kes|zar|uah|naira|peso|rouble|ruble|hryvnia|shilling|yuan|won|rupee|birr|real)\b/.exec(
            text,
        );
    if (!m) return null;
    return sanitizeEntity(m[1]);
}

export function classifyAskWorldQuery(message: string): AskWorldQuery | null {
    const text = message.trim().toLowerCase();
    if (!text || text.length > 200) return null;
    const words = text.split(/\s+/);
    // Long free-form messages are conversation, not a fixed question class.
    if (words.length > 14) return null;
    // Compound / multi-question sentences are ambiguous targets — advisor.
    if ((text.match(/\?/g) || []).length > 1 || text.includes(';')) return null;
    if (ADVICE_BLOCK.test(text) || PERSONAL_BLOCK.test(text)) return null;

    const horizon = parseHorizon(text);
    if (horizon === null) return null;

    // ── Inflation classes ──
    if (/\binflation\b/.test(text)) {
        if (NON_USD_BENCHMARK.test(text.replace(/\binflation\b/, ''))) return null;
        const threshold = parseThreshold(text);
        if (threshold) {
            return { kind: 'inflation_rank', ...threshold };
        }
        const entity = parseInflationEntity(text);
        if (entity) {
            return { kind: 'inflation_single', countryName: entity };
        }
        return null;
    }

    // ── Depreciation classes ──
    const lossSignal =
        /\blos(?:e|es|ed|t|ing)\b/.test(text) ||
        /\bdepreciat\w*\b/.test(text) ||
        /\bweaken(?:ed|ing|s)?\b/.test(text) ||
        /\bworst\b/.test(text);
    const currencySignal = /\b(currenc(?:y|ies)|economies|money|value|naira|peso|real|rouble|ruble|hryvnia|shilling|yuan|won|rupee|ngn|ars|try|egp|kes|zar|uah)\b/.test(
        text,
    );
    if (!lossSignal || !currencySignal) return null;
    if (NON_USD_BENCHMARK.test(text)) return null;

    const entity = parseDepreciationEntity(text);
    if (entity) {
        return { kind: 'depreciation_single', currencyOrCountry: entity, horizon: horizon ?? 1 };
    }
    // Ranking phrasing ("which currency lost the most…") with no entity.
    if (/\b(which|what|most|worst|biggest)\b/.test(text)) {
        return { kind: 'depreciation_rank', horizon: horizon ?? 1 };
    }
    return null;
}

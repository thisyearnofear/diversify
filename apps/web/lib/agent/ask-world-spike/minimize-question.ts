/**
 * Question minimization for the Jev router spike.
 *
 * EXPLICIT PRIVACY-POSTURE CHANGE: the spike is the first place where text
 * typed into the chat may leave the app toward a third-party classifier
 * (TypeSafe/Jev). The mitigation is that raw user prose never leaves the
 * client — only a canonical skeleton built from a fixed vocabulary:
 *
 *   "inflation_rank?threshold=5&dir=higher"
 *   "inflation_single?country=nigeria"
 *   "depreciation_rank?horizon=5"
 *   "depreciation_single?currency=ngn&horizon=1"
 *
 * Lossiness guarantee: if ANY token falls outside the whitelist (question
 * grammar, inflation/depreciation vocabulary, known country or currency
 * names, bare numbers), the function returns null and NOTHING is sent.
 * The vendor therefore learns only which question class was asked and at
 * most a generic country/currency word — never names, balances, addresses,
 * or free text. The receiver also re-validates the skeleton shape server-side.
 *
 * When Jev accepts an intent at the confidence bar, `parseQuestionSkeleton`
 * turns that same skeleton back into an AskWorldQuery so the deterministic
 * facts path answers — TypeSafe only routes; it never invents numbers.
 */

import type { AskWorldQuery } from '../ask-world-types';

const GRAMMAR_WORDS = new Set<string>([
    // question scaffolding
    'which', 'what', 'whats', 'when', 'where', 'how', 'much', 'many',
    'is', 'are', 'was', 'were', 'do', 'does', 'did', 'has', 'have', 'had',
    'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'or', 'on', 'with', 'since',
    'country', 'countries', 'nation', 'nations', 'economy', 'economies',
    // comparison + magnitude
    'higher', 'lower', 'greater', 'less', 'more', 'most', 'worst', 'best',
    'biggest', 'largest', 'smallest', 'above', 'below', 'over', 'under',
    'than', 'vs', 'versus', 'against', 'compared', 'exceeds', 'exceeding',
    // topic vocabulary
    'inflation', 'price', 'prices', 'rate', 'rates',
    'currency', 'currencies', 'money', 'dollar', 'usd',
    'value', 'purchasing', 'power',
    'lost', 'lose', 'loses', 'losing', 'loss', 'fall', 'falls', 'fell',
    'fallen', 'drop', 'drops', 'dropped', 'depreciate', 'depreciated',
    'depreciation', 'devalue', 'devalued', 'devaluation', 'weaken', 'weakens',
    'weakened', 'weaker',
    // time framing
    'percent', 'percentage', 'year', 'years', 'yr', 'yrs', 'ago', 'last',
    'past', 'current', 'currently', 'today',
]);

const NUMBER_WORDS = new Set<string>([
    'one', 'two', 'three', 'five', 'seven', 'ten',
]);

/** Country words: every lowercase word of the shared COUNTRY_NAMES values,
 *  plus the subcontinent-style qualifiers that appear inside them. */
const COUNTRY_WORDS = new Set<string>([
    'united', 'states', 'kingdom', 'south', 'korea', 'north', 'africa',
    'nigeria', 'nigerian', 'egypt', 'egyptian', 'brazil', 'brazilian',
    'india', 'indian', 'china', 'chinese', 'mexico', 'mexican', 'argentina',
    'argentinian', 'colombia', 'colombian', 'chile', 'chilean', 'peru',
    'philippines', 'filipino', 'indonesia', 'indonesian', 'thailand', 'thai',
    'vietnam', 'viet', 'nam', 'ukraine', 'ukrainian', 'russia', 'russian',
    'poland', 'polish', 'romania', 'hungary', 'slovakia', 'spain', 'spanish',
    'france', 'french', 'germany', 'german', 'italy', 'italian', 'netherlands',
    'dutch', 'switzerland', 'swiss', 'canada', 'canadian', 'japan', 'japanese',
    'australia', 'australian', 'ghana', 'ghanaian', 'kenya', 'kenyan',
    'south', 'african', 'britain', 'british', 'england', 'turkey', 'turkish',
    'uae', 'emirates', 'singapore', 'singaporean', 'pakistan', 'bangladesh',
    'turkiye',
]);

/** Currency words: names appearing in the app's curated + priority datasets. */
const CURRENCY_WORDS = new Set<string>([
    'naira', 'cedi', 'rand', 'pound', 'shilling', 'birr', 'rupee', 'rupees',
    'real', 'reais', 'peso', 'pesos', 'boliviano', 'dinar', 'dirham',
    'hryvnia', 'ryl', 'rouble', 'ruble', 'forint', 'leu', 'zloty', 'won',
    'yen', 'yuan', 'renminbi', 'ringgit', 'baht', 'dong', 'sol',
    'lira', 'euro', 'euros', 'franc', 'francs', 'koruna', 'lev', 'kuna',
    'marka', 'manat', 'taka', 'kyat', 'riyal', 'rial', 'dram',
]);

const ENTITY_WORDS = new Set<string>([...COUNTRY_WORDS, ...CURRENCY_WORDS]);

function tokenize(text: string): string[] | null {
    const cleaned = text
        .toLowerCase()
        .replace(/'s\b/g, ' ')
        .replace(/[^a-z0-9.%\s-]/g, ' ')
        .replace(/[%]/g, ' percent ');
    const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 14) return null;
    return tokens;
}

function isNumericToken(token: string): boolean {
    return /^\d+(\.\d+)?$/.test(token) || NUMBER_WORDS.has(token);
}

function toNumber(token: string): number | null {
    if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
    const words: Record<string, number> = {
        one: 1, two: 2, three: 3, five: 5, seven: 7, ten: 10,
    };
    return words[token] ?? null;
}

/**
 * Returns one of four canonical skeletons, or null when the question cannot
 * be expressed without leaking vocabulary the whitelist doesn't cover.
 */
export function toQuestionSkeleton(text: string): string | null {
    const raw = text.trim();
    if (!raw || raw.length > 200) return null;
    const allTokens = tokenize(raw);
    if (!allTokens) return null;

    for (const token of allTokens) {
        const known =
            GRAMMAR_WORDS.has(token) ||
            ENTITY_WORDS.has(token) ||
            isNumericToken(token);
        if (!known) return null; // informative word outside the whitelist
    }

    // Lift "<n> year(s)" pairs into a horizon BEFORE threshold extraction —
    // "inflation over 5 years in japan" is a single-country question, not a
    // threshold=5 ranking. A horizon we can't express (2, 7, …) is not
    // sendable at all.
    let horizon: number | null = null;
    const tokens: string[] = [];
    for (let i = 0; i < allTokens.length; i += 1) {
        const token = allTokens[i];
        const next = allTokens[i + 1];
        if ((next === 'year' || next === 'years') && isNumericToken(token)) {
            const n = toNumber(token);
            if (n !== 1 && n !== 3 && n !== 5) return null;
            horizon = n;
            i += 1; // consume the year word too
            continue;
        }
        tokens.push(token);
    }

    const has = (word: string) => tokens.includes(word);
    const entity = tokens.find((t) => ENTITY_WORDS.has(t)) ?? null;
    const numeric = tokens.find(isNumericToken) ?? null;
    const numericValue = numeric ? toNumber(numeric) : null;

    const isInflation = has('inflation') || (has('price') && has('higher')) || has('prices');
    const isLoss =
        has('lost') || has('lose') || has('loses') || has('losing') || has('loss') ||
        has('depreciated') || has('depreciation') || has('depreciate') ||
        has('devalued') || has('devaluation') || has('devalue') ||
        has('weakened') || has('weaker') || has('weaken') ||
        has('fell') || has('fallen');
    const isCurrencyTopic = has('currency') || has('currencies') || has('money') || isLoss;

    if (isInflation) {
        const hasComparator =
            has('higher') || has('greater') || has('above') || has('over') || has('exceeds') ||
            has('lower') || has('less') || has('below') || has('under');
        if (hasComparator && numericValue !== null) {
            const dir = has('lower') || has('less') || has('below') || has('under')
                ? 'lower'
                : 'higher';
            return `inflation_rank?threshold=${numericValue}&dir=${dir}`;
        }
        if (entity) {
            return `inflation_single?country=${entity}`;
        }
        return null;
    }

    if (isCurrencyTopic) {
        if (entity) {
            return `depreciation_single?currency=${entity}&horizon=${horizon ?? 1}`;
        }
        if (has('which') || has('what') || has('most') || has('worst') || has('biggest') || has('largest')) {
            return `depreciation_rank?horizon=${horizon ?? 1}`;
        }
        return null;
    }

    return null;
}

/**
 * Inverse of toQuestionSkeleton for accepted Jev routes. Returns null when
 * the string is not one of the four server-accepted shapes (defense in depth
 * — the API already re-validates before calling Jev).
 */
export function parseQuestionSkeleton(skeleton: string): AskWorldQuery | null {
    const rank = /^inflation_rank\?threshold=(\d{1,3}(?:\.\d)?)&dir=(higher|lower)$/.exec(skeleton);
    if (rank) {
        const thresholdPct = Number(rank[1]);
        if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct > 200) return null;
        return {
            kind: 'inflation_rank',
            comparator: rank[2] as 'higher' | 'lower',
            thresholdPct,
        };
    }
    const inflSingle = /^inflation_single\?country=([a-z]{1,20})$/.exec(skeleton);
    if (inflSingle) {
        return { kind: 'inflation_single', countryName: inflSingle[1] };
    }
    const depRank = /^depreciation_rank\?horizon=([135])$/.exec(skeleton);
    if (depRank) {
        return { kind: 'depreciation_rank', horizon: Number(depRank[1]) as 1 | 3 | 5 };
    }
    const depSingle = /^depreciation_single\?currency=([a-z]{1,20})&horizon=([135])$/.exec(skeleton);
    if (depSingle) {
        return {
            kind: 'depreciation_single',
            currencyOrCountry: depSingle[1],
            horizon: Number(depSingle[2]) as 1 | 3 | 5,
        };
    }
    return null;
}

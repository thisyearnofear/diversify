/**
 * ask-world-facts — pure resolvers/builders for the "Ask the World" fast
 * path. Turns a classified AskWorldQuery plus a raw data payload into a
 * WorldAnswer card. Kept HTTP-free (payload passed in) so every rule —
 * ranking order, sign handling, WEOWORLD exclusion, omission counting,
 * live-vs-reference badge copy — is unit-testable without a server.
 *
 * Honesty contract lives here:
 *  - `pctLabel` never renders a signed −0%.
 *  - badge copy says "live" only when mode === 'live'; reference answers
 *    name themselves ("Reference data … — not live").
 *  - rows without a number are counted in `omittedCount`, never zero-filled.
 *  - flags come from ISO2 via flagEmojiForIso2 (deterministic
 *    regional-indicator encoding) — never guessed per dataset.
 */

import { flagEmojiForIso2 } from '@/lib/narrative/currency-moment';
import { CURRENCY_RISK_DATA } from '@/constants/currency-risk';
import { COUNTRY_NAMES } from '@/constants/inflation';
import {
    MAX_WORLD_ANSWER_ENTRIES,
    type AskWorldQuery,
    type WorldAnswer,
    type WorldAnswerEntry,
    type WorldFactSource,
} from './ask-world-types';
import type { WorldFactsResponse, WorldFactsEntryView } from '@/pages/api/agent/world-facts';

/** Mirrors GET /api/inflation (IMF → World Bank → static fallback). */
export interface InflationFeedRow {
    country: string;
    countryCode: string;
    value: number | null;
    year: number;
    source: string;
    isGlobal?: boolean;
}
export interface InflationFeed {
    countries: InflationFeedRow[];
    source: string;
    lastUpdated: string;
}

export type AskWorldOutcome =
    | { status: 'answered'; answer: WorldAnswer }
    /** Entity not in our datasets → let the advisor (with web search) try. */
    | { status: 'fall-through' }
    /** Data route unreachable/empty — answer honestly in text, no LLM. */
    | { status: 'unavailable' };

// ── Formatting ─────────────────────────────────────────────────────────

/** Signed percent with a real minus glyph; −0 never appears. */
export function pctLabel(value: number): string {
    const r = Math.round(value * 10) / 10;
    if (r === 0) return '0%';
    const abs = Math.abs(r);
    const num = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    return `${r < 0 ? '−' : ''}${num}%`;
}

// ── Entity helpers ─────────────────────────────────────────────────────

/** ISO3 → ISO2 for every country the inflation feed can name, plus the
 *  curated currency dataset (IMF uses TUR, not the ISO official UKR… both
 *  spellings observed in the wild). */
const ISO3_TO_ISO2: Record<string, string> = {
    USA: 'US', DEU: 'DE', JPN: 'JP', GBR: 'GB', FRA: 'FR', ITA: 'IT', CAN: 'CA',
    KOR: 'KR', AUS: 'AU', ESP: 'ES', BRA: 'BR', IND: 'IN', CHN: 'CN', ZAF: 'ZA',
    NGA: 'NG', EGY: 'EG', MEX: 'MX', ARG: 'AR', COL: 'CO', UKR: 'UA', RUS: 'RU',
    POL: 'PL', ROU: 'RO', HUN: 'HU', SVK: 'SK', NLD: 'NL', CHE: 'CH', VNM: 'VN',
    THA: 'TH', PHL: 'PH', IDN: 'ID', PAK: 'PK', LKA: 'LK', GHA: 'GH', TZA: 'TZ',
    UGA: 'UG', HTI: 'HT', TTO: 'TT', BRB: 'BB', TKN: 'TC',
};
for (const e of CURRENCY_RISK_DATA) {
    if (e.iso3 && e.iso2 && e.iso2.length === 2) ISO3_TO_ISO2[e.iso3] = e.iso2;
}

function iso2FromAny(code: string): string | null {
    const c = code.toUpperCase();
    if (c.length === 2) return /^[A-Z]{2}$/.test(c) ? c : null;
    return ISO3_TO_ISO2[c] ?? null;
}

function flagFor(iso2: string | null, fallbackGlyph: string): string {
    return (iso2 ? flagEmojiForIso2(iso2) : null) ?? fallbackGlyph;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Common colloquial names → normalized canonical display name. */
const COUNTRY_ALIASES: Record<string, string> = {
    us: 'unitedstates', usa: 'unitedstates', america: 'unitedstates',
    uk: 'unitedkingdom', britain: 'unitedkingdom', england: 'unitedkingdom',
    korea: 'southkorea', russia: 'russia', turkey: 'turkey', vietnam: 'vietnam',
    holland: 'netherlands', switzerland: 'switzerland',
};

/** Cheap static membership test used BEFORE any fetch: an entity we can
 *  never name shouldn't cost a data-route round trip — straight to advisor. */
export function isKnownCountry(name: string): boolean {
    const bare = name.replace(/^the\s+/i, '').trim();
    const q = norm(COUNTRY_ALIASES[norm(bare)] ?? bare);
    if (q.length < 2) return false;
    return Object.values(COUNTRY_NAMES).some((v) => norm(v) === q);
}

/** Resolve a free-text country mention against the inflation feed's own
 *  display names (IMF names come from COUNTRY_NAMES; World Bank names are
 *  official-style, hence the normalization + containment match). */
export function resolveInflationCountry(
    query: string,
    rows: InflationFeedRow[],
): InflationFeedRow | null {
    const bare = query.replace(/^the\s+/i, '').trim();
    const q = norm(COUNTRY_ALIASES[norm(bare)] ?? bare);
    if (q.length < 2) return null;
    for (const row of rows) {
        const name = norm(row.country);
        if (!name || row.isGlobal) continue;
        if (name === q) return row;
        if (q.length >= 4 && (name.includes(q) || q.includes(name))) return row;
    }
    // Match on ISO2/ISO3 code text typed directly ("ng", "nga").
    const raw = query.trim().toUpperCase();
    const byCode = rows.find((r) => r.countryCode.toUpperCase() === raw);
    return byCode ?? null;
}

/** Currency-name → code, only where the name is unambiguous in the
 *  curated dataset. Ambiguous names ("peso", "dollar") intentionally have
 *  NO entry — they fall through to the advisor instead of a coin flip. */
const CURRENCY_NAME_TO_CODE: Record<string, string> = {
    naira: 'NGN', hryvnia: 'UAH', rouble: 'RUB', ruble: 'RUB', rupee: 'INR',
    real: 'BRL', birr: 'ETB', shilling: 'KES', guarani: 'PYG', kip: 'LAK',
};

/** Resolve "ngn" / "nigeria" / "naira" to a curated dataset currency code. */
export function resolveDepreciationCode(entity: string): string | null {
    const raw = entity.trim().toLowerCase();
    if (/^[a-z]{3}$/.test(raw)) {
        const code = raw.toUpperCase();
        return CURRENCY_RISK_DATA.some((e) => e.code === code) ? code : null;
    }
    const named = CURRENCY_NAME_TO_CODE[raw];
    if (named && CURRENCY_RISK_DATA.some((e) => e.code === named)) return named;
    const q = norm(COUNTRY_ALIASES[norm(raw)] ?? raw);
    const entry = CURRENCY_RISK_DATA.find(
        (e) => norm(e.countryName) === q || norm(e.iso3) === q || norm(e.iso2) === q,
    );
    return entry?.code ?? null;
}

// ── Inflation builders ─────────────────────────────────────────────────

const INFLATION_SOURCE_LABEL: Record<string, string> = {
    imf: 'IMF', worldbank: 'World Bank', fallback: 'Static reference data',
};

function inflationSourceOf(source: string): WorldFactSource {
    return source === 'imf' || source === 'worldbank' || source === 'fallback'
        ? source
        : 'worldbank';
}

export function resolveInflationAnswer(
    query: Extract<AskWorldQuery, { kind: 'inflation_rank' | 'inflation_single' }>,
    payload: InflationFeed,
    startedAt: number,
): WorldAnswer | { entityUnresolved: true } | null {
    if (!Array.isArray(payload.countries)) return null;

    const usable = payload.countries.filter(
        (r) => !r.isGlobal && r.countryCode !== 'WEOWORLD',
    );
    const withValue = usable.filter((r) => typeof r.value === 'number' && Number.isFinite(r.value));
    const omittedCount = usable.length - withValue.length;

    const isReference = payload.source === 'fallback';
    const asOf = isReference
        ? (payload.lastUpdated || '').slice(0, 10)
        : String(Math.max(...withValue.map((r) => r.year), 0) || '');

    let rows: InflationFeedRow[];
    let headline: string[];

    if (query.kind === 'inflation_rank') {
        rows = withValue.filter((r) =>
            query.comparator === 'higher' ? r.value! > query.thresholdPct : r.value! < query.thresholdPct,
        );
        rows.sort((a, b) =>
            query.comparator === 'higher' ? b.value! - a.value! : a.value! - b.value!,
        );
        const word = query.comparator === 'higher' ? 'above' : 'below';
        headline = [
            `${rows.length} ${rows.length === 1 ? 'country' : 'countries'} ${word}`,
            `${query.thresholdPct}% inflation`,
        ];
    } else {
        const row = resolveInflationCountry(query.countryName, withValue);
        if (!row) return { entityUnresolved: true };
        rows = [row];
        headline = [`${row.country} runs ${pctLabel(row.value!)} inflation`];
    }

    const shown = rows.slice(0, MAX_WORLD_ANSWER_ENTRIES);
    const entries: WorldAnswerEntry[] = shown.map((r) => {
        const iso2 = iso2FromAny(r.countryCode);
        return {
            country: r.country,
            iso2: iso2 ?? undefined,
            flag: flagFor(iso2, r.country.slice(0, 1).toUpperCase()),
            value: r.value as number,
            valueLabel: pctLabel(r.value as number),
            source: inflationSourceOf(r.source),
            dataAsOf: String(r.year),
            isLive: !isReference,
        };
    });

    return {
        kind: query.kind,
        headline,
        entries,
        omittedCount,
        badge: {
            mode: isReference ? 'reference' : 'live',
            sources: INFLATION_SOURCE_LABEL[payload.source] ?? payload.source,
            dataAsOf: asOf,
            latencyMs: Date.now() - startedAt,
        },
    };
}

// ── Depreciation builders ──────────────────────────────────────────────

const HORIZON_WORD = (h: number) => (h === 1 ? '1 year' : `${h} years`);

export function buildDepreciationAnswer(
    query: Extract<AskWorldQuery, { kind: 'depreciation_rank' | 'depreciation_single' }>,
    payload: WorldFactsResponse,
    startedAt: number,
): WorldAnswer | null {
    if (!Array.isArray(payload.entries)) return null;

    const toEntry = (e: WorldFactsEntryView): WorldAnswerEntry => {
        const iso2 = e.iso2 && e.iso2.length === 2 ? e.iso2 : iso2FromAny(e.code);
        return {
            code: e.code,
            country: e.countryName,
            iso2: iso2 ?? undefined,
            flag: flagFor(iso2, e.code.slice(0, 1)),
            value: e.value,
            valueLabel: pctLabel(e.value),
            source: payload.mode === 'live' ? 'fawazahmed0' : 'curated',
            dataAsOf: payload.dataAsOf,
            isLive: e.isLive,
        };
    };

    let entries: WorldAnswerEntry[];
    let headline: string[];

    if (query.kind === 'depreciation_rank') {
        // "Lost the most" = most negative. Positive deltas are appreciation
        // and must not appear in a loss ranking; zeros carry no story.
        const losses = payload.entries
            .filter((e) => Number.isFinite(e.value) && e.value < 0)
            .sort((a, b) => a.value - b.value);
        entries = losses.slice(0, MAX_WORLD_ANSWER_ENTRIES).map(toEntry);
        headline = [
            `Worst vs USD, last ${HORIZON_WORD(query.horizon)}`,
            `${entries.length} ${entries.length === 1 ? 'currency' : 'currencies'} lost value`,
        ];
    } else {
        if (payload.entries.length === 0) return null;
        entries = payload.entries.map(toEntry);
        headline = [
            `${entries[0].code} vs USD, ${HORIZON_WORD(query.horizon)}`,
        ];
    }

    return {
        kind: query.kind,
        headline,
        entries,
        omittedCount: payload.omittedCount ?? 0,
        badge: {
            mode: payload.mode,
            sources: payload.sources,
            dataAsOf: payload.dataAsOf,
            latencyMs: Date.now() - startedAt,
        },
    };
}

// ── Badge + plain-text twin (TTS and markdown fallback read the content) ─

/** Single source for the honesty badge sentence, shared by the card UI and
 *  the text twin. "live" appears only in live mode, never in reference. */
export function worldBadgeCopy(badge: WorldAnswer['badge']): string {
    const asOf = badge.dataAsOf ? `, as of ${badge.dataAsOf}` : '';
    return badge.mode === 'live'
        ? `Answered from live data in ${badge.latencyMs}ms · ${badge.sources}${asOf}`
        : `Reference data${asOf} · answered in ${badge.latencyMs}ms — not live`;
}

export function worldAnswerToText(answer: WorldAnswer): string {
    const lines = [
        answer.headline.join(' — ') + ':',
        ...answer.entries.map(
            (e) => `• ${e.flag} ${e.code ?? e.country}: ${e.valueLabel}`,
        ),
    ];
    if (answer.entries.length === 0) lines.push('No matching entries in our data.');
    if (answer.omittedCount > 0) {
        lines.push(`(${answer.omittedCount} ${answer.omittedCount === 1 ? 'entry' : 'entries'} without data were left out.)`);
    }
    lines.push(worldBadgeCopy(answer.badge));
    return lines.join('\n');
}

// ── Fetch orchestration (client-side; fetchImpl injectable for tests) ──

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
    const resp = await fetchImpl(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
}

export async function fetchAndResolve(
    query: AskWorldQuery,
    options: { startedAt: number; fetchImpl?: typeof fetch; urlPrefix?: string },
): Promise<AskWorldOutcome> {
    const doFetch = options.fetchImpl ?? fetch;
    const base = options.urlPrefix ?? '';
    try {
        if (query.kind === 'inflation_rank' || query.kind === 'inflation_single') {
            if (query.kind === 'inflation_single' && !isKnownCountry(query.countryName)) {
                return { status: 'fall-through' };
            }
            const payload = (await getJson(`${base}/api/inflation`, doFetch)) as InflationFeed;
            const result = resolveInflationAnswer(query, payload, options.startedAt);
            if (!result) return { status: 'unavailable' };
            if ('entityUnresolved' in result) return { status: 'fall-through' };
            return { status: 'answered', answer: result };
        }

        if (query.kind === 'depreciation_single') {
            const code = resolveDepreciationCode(query.currencyOrCountry);
            if (!code) return { status: 'fall-through' };
            const payload = (await getJson(
                `${base}/api/agent/world-facts?kind=depreciation&horizon=${query.horizon}&currency=${code}`,
                doFetch,
            )) as WorldFactsResponse;
            const answer = buildDepreciationAnswer(query, payload, options.startedAt);
            if (!answer) return { status: 'fall-through' };
            return { status: 'answered', answer };
        }

        const payload = (await getJson(
            `${base}/api/agent/world-facts?kind=depreciation&horizon=${query.horizon}`,
            doFetch,
        )) as WorldFactsResponse;
        const answer = buildDepreciationAnswer(query, payload, options.startedAt);
        if (!answer) return { status: 'unavailable' };
        return { status: 'answered', answer };
    } catch {
        return { status: 'unavailable' };
    }
}

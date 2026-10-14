/**
 * FX-move measurement adapter for the macro-signal ledger.
 *
 * The beats engine (Home / Guardian / Shield LiveLine, the corridor line's
 * dateline) reads `MACRO_SIGNAL:*` records and renders the ones that are
 * fresh, attributable and readable. Until now the ONLY producer of a
 * renderable beat was the stablecoin depeg monitor — `MACRO_SIGNAL:
 * PRICE_DEVIATION` requires a >1% measured deviation, so in calm markets
 * nothing ever renders and the line has no data.
 *
 * This adapter generalises the same honesty pattern the stablecoin monitor
 * established (see `verified-macro-measurement.ts`):
 *
 *   - the provider measurement is fetched independently from a fixed
 *     dataset endpoint — never scraped text, never a model classification;
 *   - the measurement carries its own dates, so the record is dated rather
 *     than timestamped at write time;
 *   - the claim is a *measured move that already happened*, never a
 *     forecast, a direction call, or a trade instruction;
 *   - unresolvable input yields no measurement (the caller records nothing)
 *     rather than a placeholder.
 *
 * Dataset: fawazahmed0 open currency dataset, the same source the shared
 * `fx-rate.service` and the CLI FX-drag report read.
 */

const DATASET_MIN_DATE = '2024-03-02';
/** Days to walk back looking for a published table (weekends/holidays). */
const MAX_LOOKBACK_DAYS = 7;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Default measurement window. Measured empirically against the live dataset:
 * 7 days cleared the threshold for 1 of 10 attributable currencies, 14 days
 * for 2, 30 days for 5. A month is also the honest unit for the claim — the
 * beat says "this month", not "this tick" — and it comfortably outlives the
 * reader's 14-day freshness window.
 */
export const FX_MOVE_DEFAULT_WINDOW_DAYS = 30;
/** A move must clear this to be material; matches the monitor's 1%-class gate. */
export const FX_MOVE_THRESHOLD_PERCENT = 1.5;

export interface FxMoveMeasurement {
  kind: 'fx_move';
  /** ISO 4217, uppercase. */
  code: string;
  windowDays: number;
  /** ISO date of the window's start (the earlier table). */
  fromDate: string;
  /** ISO date of the window's end (the later table). */
  toDate: string;
  /** Local units per USD at the window's start (the dataset's own basis). */
  fromPerUsd: number;
  /** Local units per USD at the window's end. */
  toPerUsd: number;
  /**
   * Change in the currency's USD value across the window, in percent.
   * Negative = the currency weakened (took more local units to buy a dollar).
   */
  movePercent: number;
  thresholdPercent: number;
  material: boolean;
  sourceUrl: string;
  retrievedAt: string;
  executionEligibility: 'observation_only';
}

function datasetUrls(isoDate: string): string[] {
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${isoDate}/v1/currencies/usd.min.json`,
    `https://${isoDate}.currency-api.pages.dev/v1/currencies/usd.min.json`,
  ];
}

function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) - days * 86_400_000).toISOString().slice(0, 10);
}

/** Fetch one date's USD table (local-per-USD keyed by lowercase code). */
async function fetchUsdTable(
  isoDate: string,
  fetcher: typeof fetch,
): Promise<Record<string, number> | null> {
  for (const url of datasetUrls(isoDate)) {
    try {
      const res = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const body = (await res.json()) as { usd?: Record<string, number> };
      if (body?.usd) return body.usd;
    } catch {
      // timeout or network error — try the next mirror
    }
  }
  return null;
}

/**
 * The most recent published table at or before `isoDate`, with the date it
 * actually came from — the measurement is dated by the provider, not by us.
 */
async function resolveTable(
  isoDate: string,
  fetcher: typeof fetch,
): Promise<{ date: string; table: Record<string, number> } | null> {
  let probe = isoDate;
  for (let i = 0; i <= MAX_LOOKBACK_DAYS && probe >= DATASET_MIN_DATE; i++) {
    const table = await fetchUsdTable(probe, fetcher);
    if (table) return { date: probe, table };
    probe = shiftDays(probe, 1);
  }
  return null;
}

/**
 * Measure each code's move against USD over the window. Codes the dataset
 * can't resolve are omitted; when neither end of the window has a table at
 * all the provider is unavailable and this throws, so the caller records
 * nothing rather than an unmeasured claim.
 */
export async function readFxMoveMeasurements(
  codes: string[],
  options: {
    fetcher?: typeof fetch;
    now?: number;
    /** Defaults to {@link FX_MOVE_DEFAULT_WINDOW_DAYS}. */
    windowDays?: number;
  } = {},
): Promise<FxMoveMeasurement[]> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now();
  const windowDays = options.windowDays ?? FX_MOVE_DEFAULT_WINDOW_DAYS;
  if (!Number.isFinite(now) || now <= 0) throw new Error('Invalid measurement time');
  if (!Number.isFinite(windowDays) || windowDays <= 0) throw new Error('Invalid measurement window');

  const toIso = new Date(now).toISOString().slice(0, 10);
  const fromIso = shiftDays(toIso, windowDays);

  const [to, from] = await Promise.all([
    resolveTable(toIso, fetcher),
    resolveTable(fromIso, fetcher),
  ]);
  if (!to || !from) throw new Error('Independent FX dataset unavailable');

  const retrievedAt = new Date(now).toISOString();
  const seen = new Set<string>();
  const out: FxMoveMeasurement[] = [];

  for (const raw of codes) {
    const code = String(raw ?? '').toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const toPerUsd = to.table[code.toLowerCase()];
    const fromPerUsd = from.table[code.toLowerCase()];
    if (
      typeof toPerUsd !== 'number' || !Number.isFinite(toPerUsd) || toPerUsd <= 0 ||
      typeof fromPerUsd !== 'number' || !Number.isFinite(fromPerUsd) || fromPerUsd <= 0
    ) {
      continue; // unresolvable — no measurement, never a placeholder
    }

    // The dataset quotes local-per-USD, so USD value is proportional to 1/rate.
    const movePercent = Math.round(((fromPerUsd / toPerUsd) - 1) * 1000) / 10;
    out.push({
      kind: 'fx_move',
      code,
      windowDays,
      fromDate: from.date,
      toDate: to.date,
      fromPerUsd,
      toPerUsd,
      movePercent,
      thresholdPercent: FX_MOVE_THRESHOLD_PERCENT,
      material: Math.abs(movePercent) > FX_MOVE_THRESHOLD_PERCENT + 1e-9,
      sourceUrl: datasetUrls(to.date)[0],
      retrievedAt,
      executionEligibility: 'observation_only',
    });
  }

  return out;
}

/** The material moves, largest first, capped so one run can't flood the ledger. */
export function selectMaterialFxMoves(
  measurements: FxMoveMeasurement[],
  limit = 5,
): FxMoveMeasurement[] {
  return measurements
    .filter((m) => m.material)
    .sort((a, b) => Math.abs(b.movePercent) - Math.abs(a.movePercent) || a.code.localeCompare(b.code))
    .slice(0, Math.max(0, limit));
}

/**
 * The one-line beat. Deliberately short — the reader caps a beat at 110
 * chars — and deliberately past-tense: it states what the provider measured,
 * not where the currency is going.
 *
 * Phrased in the product's own money grammar rather than an analyst's. The
 * beat rotates on the same `LiveLine` as `corridor-voice`'s beats ("la TRM:
 * the peso lost ~17% to the dollar in 5 years"), so it uses the same
 * register: the money's plain name, its own verb for the move, and the
 * benchmark spoken as "the dollar". Two beats describing one currency in two
 * narrators reads as two apps.
 *
 * `subject` is how the host supplies that name (`moneyNameFor`, "the peso").
 * This adapter owns no currency-name registry and must not grow one — with no
 * subject the ISO code stands in, which is plainer but never wrong.
 *
 * The as-of date stays even though the beat's dateline also carries a date:
 * the dateline is the *record's* timestamp, so a run that anchors just after
 * midnight would otherwise label one day's measurement as the next day's.
 * This is the only place the measurement's own date is stated as a fact.
 */
export function fxMoveOneLiner(m: FxMoveMeasurement, subject?: string): string {
  const verb = m.movePercent <= 0 ? 'lost' : 'gained';
  // Mirrors corridor-voice's templates: "lost … to the dollar" /
  // "gained … on the dollar".
  const particle = m.movePercent <= 0 ? 'to' : 'on';
  return `${subject ?? m.code} ${verb} ${Math.abs(m.movePercent).toFixed(1)}% ${particle} the dollar over ${m.windowDays} days (measured mid-market, as of ${m.toDate})`;
}

/**
 * The full record text. The reader keeps only the text before the first
 * `. Source:` as the beat, so the measured rates land after it — readable in
 * the off-chain echo for audit, out of the ticket's way.
 */
export function fxMoveReasoning(m: FxMoveMeasurement, subject?: string): string {
  return (
    `${fxMoveOneLiner(m, subject)}. Source: ${m.sourceUrl} — ` +
    `1 USD bought ${m.fromPerUsd} ${m.code} on ${m.fromDate} and ${m.toPerUsd} ${m.code} on ${m.toDate}. ` +
    'Measured mid-market move, not a forecast, a direction call, or a trade instruction.'
  );
}

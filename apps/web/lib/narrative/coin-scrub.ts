/**
 * Coin scrub — the Home coin as its own chart. Dragging the local coin
 * walks the feed's real 12-month vs-USD series; every reading here is a
 * ratio of two sampled points, never an interpolation or an estimate.
 */

export interface ValueSeries {
  dates: string[];
  values: number[];
}

export interface ScrubReading {
  index: number;
  date: string;
  /** % change in buying power from this date to today (negative = weakened since). */
  changeToToday: number;
  /** % change from the window's start to this date — how worn the coin is here. */
  changeFromStart: number;
  /** This date's value over today's (>1 = it bought more then). */
  ratioToToday: number;
}

export function isScrubbableSeries(
  series: ValueSeries | null | undefined,
): series is ValueSeries {
  if (!series) return false;
  const { dates, values } = series;
  if (values.length < 2 || dates.length !== values.length) return false;
  const ts = dates.map((d) => Date.parse(d));
  return (
    values.every((v) => Number.isFinite(v) && v > 0) &&
    ts.every((t, i) => Number.isFinite(t) && (i === 0 || t > ts[i - 1]))
  );
}

export function clampIndex(series: ValueSeries, index: number): number {
  return Math.max(0, Math.min(series.values.length - 1, Math.round(index)));
}

export function readingAt(series: ValueSeries, index: number): ScrubReading {
  const i = clampIndex(series, index);
  const { values, dates } = series;
  const v = values[i];
  const last = values[values.length - 1];
  return {
    index: i,
    date: dates[i],
    changeToToday: (last / v - 1) * 100,
    changeFromStart: (v / values[0] - 1) * 100,
    ratioToToday: v / last,
  };
}

/** Samples per month — the keyboard step, so arrows move ~one month. */
export function monthStep(series: ValueSeries): number {
  const n = series.values.length;
  const spanMs =
    Date.parse(series.dates[n - 1]) - Date.parse(series.dates[0]);
  const months = Math.max(1, spanMs / (30.44 * 86_400_000));
  return Math.max(1, Math.round((n - 1) / months));
}

/** Curated events carry only a year — match on the reading's UTC year. */
export function eventForDate<E extends { year: number }>(
  events: readonly E[],
  iso: string,
): E | null {
  const year = new Date(Date.parse(iso)).getUTCFullYear();
  const hits = events.filter((e) => e.year === year);
  return hits.length ? hits[hits.length - 1] : null;
}

/** Wear from a buying-power change: a loss wears the coin, a gain doesn't. */
export function coinWear(delta: number): number {
  return Math.max(0, Math.min(1, -delta / 100));
}

export function monthLabel(iso: string): string {
  return new Date(Date.parse(iso)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The window the scrubbed number covers, as short as the horizon chips
 *  ("7 mo") so the number keeps its own window without widening the stage. */
export function monthsBackLabel(iso: string, todayIso?: string): string {
  const end = todayIso ? Date.parse(todayIso) : Date.now();
  const months = Math.round((end - Date.parse(iso)) / (30.44 * 86_400_000));
  return months < 1 ? "<1 mo" : `${months} mo`;
}

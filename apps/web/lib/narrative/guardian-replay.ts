/**
 * Guardian replay — the walletless example decision, told on the visitor's
 * own currency. The three beats keep the example's contract (stand down,
 * propose, show the work) but each is pinned to a sampled month of the
 * real 12-month vs-USD series. Nothing is interpolated, no balance is
 * named, and the replay is labelled past data — never live activity.
 */
export interface ValueSeries {
  dates: string[];
  values: number[];
}

function isUsableSeries(series: ValueSeries | null | undefined): series is ValueSeries {
  if (!series || series.values.length < 2 || series.dates.length !== series.values.length) return false;
  const ts = series.dates.map((d) => Date.parse(d));
  return (
    series.values.every((v) => Number.isFinite(v) && v > 0) &&
    ts.every((t, i) => Number.isFinite(t) && (i === 0 || t > ts[i - 1]))
  );
}

export type ReplayMood = "protective" | "alert" | "neutral";

export interface ReplayStep {
  mood: ReplayMood;
  title: string;
  line: string;
  why: string;
}

/** A fall between two samples smaller than this is noise, not a shock. */
export const REPLAY_MIN_DROP_PCT = 2;

const monthYear = (iso: string) =>
  new Date(Date.parse(iso)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const pct = (n: number) => {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "0%";
  return `${r > 0 ? "+" : "−"}${Math.abs(r)}%`;
};

/** Index of the sharpest one-sample fall, with its size (negative %). */
export function sharpestDrop(series: ValueSeries): { index: number; change: number } | null {
  let best: { index: number; change: number } | null = null;
  for (let i = 1; i < series.values.length; i++) {
    const change = (series.values[i] / series.values[i - 1] - 1) * 100;
    if (!best || change < best.change) best = { index: i, change };
  }
  return best && best.change <= -REPLAY_MIN_DROP_PCT ? best : null;
}

/** The replay for one currency, or null when the series has no real shock
 *  (the caller keeps the illustrative example instead). */
export function buildGuardianReplay(
  code: string,
  series: ValueSeries | null | undefined,
  asOf?: string | null,
): ReplayStep[] | null {
  if (!isUsableSeries(series)) return null;
  const drop = sharpestDrop(series);
  if (!drop) return null;
  const { index } = drop;
  const before = series.dates[index - 1];
  const at = series.dates[index];
  const last = series.values[series.values.length - 1];
  const since = (last / series.values[index] - 1) * 100;
  const days = Math.round((Date.parse(at) - Date.parse(before)) / 86_400_000);
  const source = `Sampled ${code} vs USD from the daily FX feed${asOf ? `, as of ${asOf}` : ""}.`;
  return [
    {
      mood: "protective",
      title: monthYear(before),
      line: `${code} before the drop. No move.`,
      why: `Nothing had moved yet, so there was nothing to justify. Guardian waits rather than guesses. ${source}`,
    },
    {
      mood: "alert",
      title: `${code} ${pct(drop.change)} in ${days} days`,
      line: `${monthYear(at)}. Guardian proposes; you sign in Exchange.`,
      why: `The sharpest fall between two samples in the last year. By default Guardian only proposes — nothing leaves your wallet until you approve it in Exchange. ${source}`,
    },
    {
      mood: "neutral",
      title: `Since then: ${pct(since)}`,
      line: "A real decision cites its dated source.",
      why: `${source} A real decision also carries a receipt when anchored; a replay of past data has none.`,
    },
  ];
}

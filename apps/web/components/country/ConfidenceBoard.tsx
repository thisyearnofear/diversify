/**
 * ConfidenceBoard — the public read on the confidence poll.
 *
 * The poll already renders tallies per currency; this is the cross-currency
 * readout: how visitors feel about each money, dated, counts disclosed.
 * Register stays "vibes, not a market" — a percentage only renders once a
 * row has enough votes to mean anything; below that the row says so.
 * Renders nothing when the read fails or no votes exist yet.
 */
import { useEffect, useState } from 'react';
import { fetchSentimentBoard, type SentimentBoard } from '@/lib/sentiment';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { moneyNameFor } from '@/lib/corridor-context';

/** Below this a share is noise — show the count, not a percentage. */
const MIN_READABLE_VOTES = 10;
const MAX_ROWS = 8;

const LEAD_LABEL: Record<string, string> = {
  confident: 'confident',
  neutral: 'neutral',
  worried: 'worried',
};

function leadOf(board: SentimentBoard['rows'][number]) {
  const entries = Object.entries(board.tally) as Array<[string, number]>;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
}

export function ConfidenceBoard() {
  const [board, setBoard] = useState<SentimentBoard | null>(null);

  useEffect(() => {
    let live = true;
    void fetchSentimentBoard().then((b) => {
      if (live && b && b.rows.length > 0) setBoard(b);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!board) return null;
  const rows = board.rows.slice(0, MAX_ROWS);
  const asOf = new Date(board.asOf);

  return (
    <section aria-label="How visitors feel" className="mt-12">
      <h2 className="text-center text-xs font-bold uppercase tracking-widest text-white/40">
        How visitors feel
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-center text-[11px] leading-relaxed text-white/30">
        Anonymous confidence votes on each money · as of{' '}
        {Number.isNaN(asOf.getTime()) ? 'today' : asOf.toISOString().slice(0, 10)}
      </p>
      <ul className="mx-auto mt-5 max-w-md space-y-1">
        {rows.map((row) => {
          const entry = CURRENCY_BY_CODE[row.code];
          const [lead, leadCount] = leadOf(row);
          const readable = row.total >= MIN_READABLE_VOTES;
          const pct = readable ? Math.round((leadCount / row.total) * 100) : null;
          return (
            <li
              key={row.code}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <span className="text-lg" aria-hidden="true">
                {entry?.flag ?? ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white/85">
                  {moneyNameFor(row.code)}
                </span>
                <span className="text-[11px] text-white/40">
                  {readable
                    ? `${pct}% ${LEAD_LABEL[lead] ?? lead} · ${row.total} votes`
                    : `${row.total} ${row.total === 1 ? 'vote' : 'votes'} — too few to read`}
                </span>
              </span>
              {entry && (
                <span className="shrink-0 text-xs font-semibold tabular-nums text-white/50">
                  {row.code}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mx-auto mt-4 max-w-sm text-center text-[11px] leading-relaxed text-white/30">
        Vibes, not a market — tallies drift as votes change. Cast yours on any
        scorecard.
      </p>
    </section>
  );
}

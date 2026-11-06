/**
 * SentimentPoll — the no-money nation confidence vote.
 *
 * Three words, one question: how confident are you in this money? The
 * poll is deliberately a confidence instrument — no buy/sell framing, no
 * countdown, no stakes. An anonymous session vote, changeable any time;
 * the tally renders as bars, not a verdict.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  castVote,
  fetchSentiment,
  sentimentSessionId,
  type SentimentResult,
} from '@/lib/sentiment';
import { trackFunnelEvent } from '@/lib/analytics';
import type { Sentiment } from '@/lib/sentiment';

interface Props {
  code: string;
  /** "the naira" — the question names the money, not the trade. */
  moneyName: string;
  /** After a vote, reflect where the voter landed in the crowd — one
   *  quiet line, used where the poll speaks in the Guardian's register. */
  acknowledge?: boolean;
  /** Fires once a vote lands — hosts use it to react non-verbally
   *  (the Guardian's settle nod on the board). */
  onVote?: () => void;
}

const OPTIONS: Array<{ id: Sentiment; label: string }> = [
  { id: 'confident', label: 'Confident' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'worried', label: 'Worried' },
];

function pctOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function SentimentPoll({ code, moneyName, acknowledge, onVote }: Props) {
  const reduced = useReducedMotion();
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'voting' | 'unavailable' | 'error'>('loading');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchSentiment(code, sentimentSessionId()).then((r) => {
      if (!live) return;
      if (r) {
        setResult(r);
        setState('ready');
      } else {
        setState('unavailable');
      }
    });
    return () => {
      live = false;
    };
  }, [code]);

  const vote = useCallback(
    async (sentiment: Sentiment) => {
      const sessionId = sentimentSessionId();
      if (!sessionId || state === 'voting') return;
      setState('voting');
      const r = await castVote(code, sentiment, sessionId);
      if (r) {
        setResult(r);
        setChanging(false);
        setState('ready');
        trackFunnelEvent('sentiment_vote_cast', { code, sentiment });
        onVote?.();
      } else {
        setState('error');
      }
    },
    [code, state, onVote],
  );

  // Absent, not an error card: a poll that can't answer renders nothing.
  if (state === 'unavailable') return null;

  const showBallot = !result?.yourVote || changing;

  return (
    <section aria-label={`Confidence in ${moneyName}`} className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold tracking-wide text-ink/90">
          How confident are you in {moneyName}?
        </h2>
        {result && result.total > 0 && (
          <span className="shrink-0 text-xs text-ink/40">
            {result.total.toLocaleString()} {result.total === 1 ? 'vote' : 'votes'}
          </span>
        )}
      </div>

      {state === 'loading' ? (
        <div className="mt-4 h-10 animate-pulse rounded-lg bg-ink/5" />
      ) : showBallot ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={state === 'voting'}
              onClick={() => void vote(opt.id)}
              className="min-h-11 rounded-xl border border-ink/15 bg-ink/[0.05] px-3 py-2 text-sm font-semibold text-ink/80 transition-colors hover:border-ink/30 hover:bg-ink/10 disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : result ? (
        <div className="mt-4 space-y-2">
          {OPTIONS.map((opt) => {
            const count = result.tally[opt.id];
            const pct = pctOf(count, result.total);
            const mine = result.yourVote === opt.id;
            return (
              <div key={opt.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-ink/60">
                  {opt.label}
                  {mine && <span className="ml-1 text-ink/90">· you</span>}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                  <motion.div
                    className={`h-full rounded-full ${mine ? 'bg-ink/70' : 'bg-ink/30'}`}
                    initial={reduced ? false : { width: 0 }}
                    animate={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                    transition={{ duration: reduced ? 0 : 0.5 }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink/50">
                  {pct}%
                </span>
              </div>
            );
          })}
          {acknowledge && result.yourVote && (() => {
            const top = OPTIONS.reduce((a, b) =>
              result.tally[b.id] > result.tally[a.id] ? b : a);
            const myLabel = OPTIONS.find((o) => o.id === result.yourVote)?.label ?? '';
            const myPct = pctOf(result.tally[result.yourVote], result.total);
            const topPct = pctOf(result.tally[top.id], result.total);
            return (
              <p className="pt-1 text-xs leading-relaxed text-ink/50">
                {result.yourVote === top.id
                  ? `You're with the ${myPct}% — ${myLabel.toLowerCase()}.`
                  : `You're with ${myPct}% on ${myLabel.toLowerCase()} — most went ${top.label.toLowerCase()} (${topPct}%).`}
              </p>
            );
          })()}
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="pt-1 text-xs font-semibold text-ink/50 underline-offset-2 hover:text-ink/80 hover:underline"
          >
            change your take
          </button>
        </div>
      ) : null}

      {state === 'error' && (
        <p className="mt-3 text-xs text-amber-300/80">
          Couldn&apos;t record that — try again.
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink/30">
        Vibes, not a market. No money rides on this — it&apos;s a tally of how
        visitors feel about {moneyName}.
      </p>
    </section>
  );
}

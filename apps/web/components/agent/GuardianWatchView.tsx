/**
 * GuardianWatchView — the watching board performed in place (plan.md
 * §12 W7). The reading slot swaps to this; nothing expands, no cards.
 *
 * The board is an instrument, not a paragraph: each money is a gauge —
 * flag, name, the cents kept of a five-years-ago dollar drawn as a fill,
 * the figure at the end. The lead fact is narrated once (masked
 * per-character rise); the gauges stagger in behind it. The why the
 * queue ranked the row by rides as a small chip; "watching" provenance
 * says nothing, so it says nothing.
 *
 * Reduced motion renders the final state on the first frame; the
 * sr-only copy carries the same sentence assistive tech announces.
 */
import React from "react";
import { motion } from "framer-motion";
import { useMotionBudget } from "@/hooks/use-motion-budget";
import { CHAR_STAGGER_S, STAGGER_STEP_S, reveal } from "@/lib/motion-tokens";
import { CURRENCY_BY_CODE } from "@/constants/currency-risk";
import { moneyNameFor } from "@/lib/corridor-context";
import type { BoardEntry } from "@/lib/guardian-board";
import { haptics } from "@/lib/haptics";

const MAX_ROWS = 4;

/** Cents kept of a five-years-ago dollar; null when the dataset has no
 *  depreciation figure — a missing gauge is honest absence, never a
 *  guessed fill. */
export function keptCentsFor(code: string): number | null {
  const cur = CURRENCY_BY_CODE[code];
  if (!cur) return null;
  return Math.max(0, Math.round(100 + cur.depreciation.vsUSD["5yr"]));
}

/** The row's short money name — "the naira" reads as "Naira" on a gauge
 *  where the figure carries the sentence. */
function shortName(code: string): string {
  const name = moneyNameFor(code).replace(/^the\s+/i, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** One row's sentence — kept-cents + provenance, or provenance alone
 *  when the dataset has no kept-cents for the money. */
export function watchRowText(entry: BoardEntry): string {
  const cur = CURRENCY_BY_CODE[entry.code];
  const name = moneyNameFor(entry.code);
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const kept = keptCentsFor(entry.code);
  const fact =
    kept !== null
      ? `${capitalized} kept ~${kept}¢ of a five-years-ago dollar`
      : capitalized;
  const why = entry.why && entry.why !== "watching" ? ` · ${entry.why}` : "";
  return `${cur?.flag ? `${cur.flag} ` : ""}${fact}${why}`;
}

/** The narrated line — HeadlineReveal's grammar on a sentence: masked
 *  per-character rise, played once on mount, inert under reduced
 *  motion. sr-only carries the plain sentence for assistive tech. */
function NarratedLine({ text }: { text: string }) {
  const budget = useMotionBudget();
  const words = text.split(" ");
  let glyphIndex = 0;
  return (
    <p className="text-sm leading-relaxed text-ink/80">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
          const glyphs = Array.from(word);
          const start = glyphIndex;
          glyphIndex += glyphs.length;
          return (
            <React.Fragment key={`${word}-${wordIndex}`}>
              {wordIndex > 0 ? " " : null}
              <span className="inline-block whitespace-nowrap">
                {glyphs.map((glyph, i) => (
                  <span
                    key={`${glyph}-${start + i}`}
                    className="inline-block overflow-hidden align-bottom"
                  >
                    <motion.span
                      className="inline-block"
                      initial={
                        budget.motion ? { y: "0.85em", opacity: 0 } : false
                      }
                      animate={{ y: 0, opacity: 1 }}
                      transition={
                        budget.motion
                          ? { ...reveal, delay: (start + i) * CHAR_STAGGER_S }
                          : { duration: 0 }
                      }
                    >
                      {glyph}
                    </motion.span>
                  </span>
                ))}
              </span>
            </React.Fragment>
          );
        })}
      </span>
    </p>
  );
}

/** The kept-cents gauge: a track to the right-end tick (a whole dollar),
 *  the fill reaching only as far as the money kept. The fill animates on
 *  scaleX — origin-left — never width. */
function KeptGauge({ kept, delay }: { kept: number; delay: number }) {
  const budget = useMotionBudget();
  return (
    <span
      aria-hidden="true"
      className="relative mx-2 flex h-1.5 flex-1 items-center rounded-full bg-ink/10"
    >
      <motion.span
        className="block h-full w-full origin-left rounded-full bg-blue-600 dark:bg-blue-400"
        initial={budget.motion ? { scaleX: 0 } : { scaleX: kept / 100 }}
        animate={{ scaleX: kept / 100 }}
        transition={
          budget.motion
            ? { ...reveal, delay, type: "spring", stiffness: 180, damping: 26 }
            : { duration: 0 }
        }
      />
      <span className="absolute inset-y-[-2px] right-0 w-px bg-ink/30" />
    </span>
  );
}

export function GuardianWatchView({
  entries,
  onOpenFull,
}: {
  entries: BoardEntry[];
  onOpenFull: () => void;
}) {
  const budget = useMotionBudget();
  const rows = entries.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  return (
    <div data-testid="guardian-watch-view" className="w-full max-w-[340px]">
      <p className="text-2xs font-bold uppercase tracking-wide text-ink-muted">
        What the Guardian watches
      </p>
      <div className="mt-1">
        <NarratedLine text="What each money kept of a five-years-ago dollar." />
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map((entry, i) => {
          const cur = CURRENCY_BY_CODE[entry.code];
          const kept = keptCentsFor(entry.code);
          const why =
            entry.why && entry.why !== "watching" ? entry.why : null;
          return (
            <motion.div
              key={entry.code}
              data-testid={`watch-row-${entry.code}`}
              initial={budget.motion ? { opacity: 0, y: 4 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={
                budget.motion
                  ? { ...reveal, delay: i * STAGGER_STEP_S }
                  : { duration: 0 }
              }
            >
              <div className="flex items-center">
                <span aria-hidden="true" className="w-6 text-base">
                  {cur?.flag ?? ""}
                </span>
                <span className="w-[4.75rem] truncate text-xs font-bold text-ink">
                  {shortName(entry.code)}
                </span>
                {kept !== null ? (
                  <KeptGauge kept={kept} delay={0.12 + i * STAGGER_STEP_S} />
                ) : (
                  <span className="mx-2 flex-1" />
                )}
                <span className="w-[3rem] text-right text-sm font-black tabular-nums text-ink">
                  {kept !== null ? `~${kept}¢` : "—"}
                </span>
              </div>
              {why && (
                <p className="pl-7 text-3xs uppercase tracking-wide text-ink-subtle">
                  {entry.glyph ? `${entry.glyph} ` : ""}
                  {why}
                </p>
              )}
              <span className="sr-only">{watchRowText(entry)}</span>
            </motion.div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onOpenFull();
        }}
        className="link-quiet mt-3 text-2xs"
      >
        Full board — the poll, every money →
      </button>
    </div>
  );
}

export default GuardianWatchView;

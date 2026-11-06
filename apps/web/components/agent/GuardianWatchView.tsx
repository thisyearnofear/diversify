/**
 * GuardianWatchView — the watching board performed in place (plan.md
 * §12 W7). The reading slot swaps to this; nothing expands, no cards.
 *
 * The lead row is narrated — a masked per-character rise, the Guardian
 * reading its own board aloud. Remaining rows stagger-fade. Every row
 * is one honest line: flag, money name, the kept-cents fact, and the
 * provenance the queue ranked it by ("signal 2d ago", "in 12d · …").
 * "watching" provenance says nothing, so it says nothing.
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

/** One row's sentence — kept-cents + provenance, or provenance alone
 *  when the dataset has no kept-cents for the money. */
export function watchRowText(entry: BoardEntry): string {
  const cur = CURRENCY_BY_CODE[entry.code];
  const name = moneyNameFor(entry.code);
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const kept = cur
    ? Math.max(0, Math.round(100 + cur.depreciation.vsUSD["5yr"]))
    : null;
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

export function GuardianWatchView({
  entries,
  onOpenFull,
  onClose,
}: {
  entries: BoardEntry[];
  onOpenFull: () => void;
  onClose: () => void;
}) {
  const budget = useMotionBudget();
  const rows = entries.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;
  const [lead, ...rest] = rows;

  return (
    <div data-testid="guardian-watch-view" className="w-full max-w-[340px]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-bold uppercase tracking-wide text-ink-muted">
          What the Guardian watches
        </p>
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            onClose();
          }}
          className="link-quiet text-2xs"
        >
          Fold away
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        <NarratedLine text={watchRowText(lead)} />
        {rest.map((entry, i) => (
          <motion.p
            key={entry.code}
            className="text-sm leading-relaxed text-ink/80"
            initial={budget.motion ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              budget.motion
                ? { ...reveal, delay: (i + 1) * STAGGER_STEP_S }
                : { duration: 0 }
            }
          >
            {watchRowText(entry)}
          </motion.p>
        ))}
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

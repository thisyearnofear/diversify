/**
 * HeadlineReveal — the country name set into place, never typed.
 *
 * One masked per-character rise on mount, and only on mount: motion here
 * reveals a fact that already exists, so it plays once and never re-arms.
 * There is no scramble, no caret, no cursor — nothing on this page is being
 * edited, so nothing on this page may look like it is.
 *
 * Accessibility is the reason the markup is shaped this way: the animated
 * glyphs are `aria-hidden`, and one plain sentence is exposed to assistive
 * tech, so a screen reader says "🇳🇬 Nigeria" rather than twenty letters.
 * Both copies are always rendered — only the animation is conditional — so
 * server and client markup agree and reduced motion gets the final state on
 * the first frame instead of a reflow after hydration.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { useMotionBudget } from '@/hooks/use-motion-budget';
import { CHAR_STAGGER_S, reveal } from '@/lib/motion-tokens';

export function HeadlineReveal({
  flag,
  text,
  className = '',
}: {
  flag: string;
  /** The headline itself — a curated name, never generated copy. */
  text: string;
  className?: string;
}) {
  const budget = useMotionBudget();
  const words = text.split(' ');
  let glyphIndex = 0;

  return (
    <h1 className={className}>
      <span className="sr-only">
        {flag} {text}
      </span>
      <span aria-hidden="true">
        <span className="mr-2">{flag}</span>
        {words.map((word, wordIndex) => {
          const glyphs = Array.from(word);
          const start = glyphIndex;
          glyphIndex += glyphs.length;
          return (
            <React.Fragment key={`${word}-${wordIndex}`}>
              {wordIndex > 0 ? ' ' : null}
              {/* Words break between themselves, never inside a word. */}
              <span className="inline-block whitespace-nowrap">
                {glyphs.map((glyph, i) => (
                  <span
                    key={`${glyph}-${start + i}`}
                    // overflow-hidden is the mask; align-bottom keeps the
                    // masked boxes on one baseline (an overflow-hidden
                    // inline-block otherwise reports its bottom edge as its
                    // baseline).
                    className="inline-block overflow-hidden align-bottom"
                  >
                    <motion.span
                      className="inline-block"
                      initial={budget.motion ? { y: '0.85em', opacity: 0 } : false}
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
    </h1>
  );
}

export default HeadlineReveal;

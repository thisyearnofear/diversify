/**
 * MaskedReveal — Skills "staggered-word-reveal" technique, framer-native.
 *
 * Hero lines rise out of an overflow-hidden mask, staggered per line —
 * one reveal on mount, never a loop. Each line gets the same grammar as
 * the tab transition (spring settle). Reduced motion renders the lines
 * statically.
 *
 * <MaskedReveal lines={["KES bought", "72% less gold"]} className="text-4xl font-black" />
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { spring, STAGGER_STEP_S } from "@/lib/motion-tokens";

export interface MaskedRevealProps {
  lines: (string | React.ReactNode)[];
  /** Base delay before the first line rises (s). */
  delay?: number;
  className?: string;
  /** Class applied to each line's inner span (typography lives here). */
  lineClassName?: string;
  /** Element for the outer wrapper — "p" when the hero line is a paragraph
   *  (headlines keep paragraph semantics for assistive tech). */
  as?: "span" | "p" | "h1" | "h2" | "h3";
}

export function MaskedReveal({
  lines,
  delay = 0,
  className = "",
  lineClassName = "",
  as: Tag = "span",
}: MaskedRevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Tag className={`block ${className}`.trim()}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className={`block ${lineClassName}`.trim()}
            initial={reducedMotion ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{ ...spring, delay: delay + i * STAGGER_STEP_S }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

export default MaskedReveal;

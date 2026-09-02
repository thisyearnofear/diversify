/**
 * InstrumentWait — the waiting object, not a card skeleton.
 *
 * Tabs are instruments. While the real object (moment, ring, calculator)
 * is settling, show that same first-viewport grammar: one coin gets the
 * colour, one line names the job. Motion reveals once (spring + a single
 * shine). Reduced-motion is a static coin + the same copy.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coin } from "./FloatingCoins";
import { spring } from "@/lib/motion-tokens";

interface InstrumentWaitProps {
  /** The job this wait is doing — not "Loading…". */
  label: string;
  symbol?: string;
  color?: string;
  className?: string;
}

export function InstrumentWait({
  label,
  symbol = "$",
  color = "#f59e0b",
  className = "",
}: InstrumentWaitProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="instrument-wait"
      className={`flex flex-col items-center justify-center min-h-[280px] px-4 ${className}`.trim()}
    >
      <motion.div
        initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : spring}
      >
        <Coin
          size={84}
          symbol={symbol}
          color={color}
          shine={reducedMotion ? false : "once"}
        />
      </motion.div>
      <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-center">
        {label}
      </p>
    </div>
  );
}

export default InstrumentWait;

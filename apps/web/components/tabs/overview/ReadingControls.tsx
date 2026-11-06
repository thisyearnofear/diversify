/**
 * ReadingControls — the moment reading's benchmark + horizon selectors.
 *
 * L2 material (plan: Home density pass): comparison is exploration, so the
 * controls live in the currency story inspector rather than stacked under
 * the resting reading. Same segmented + coin motifs as before — selection
 * still rewrites the artefact; the artefact just states the selection in
 * its subline ("against the dollar · over 12M").
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coin } from "@/components/shared/FloatingCoins";
import { BENCHMARK_COLORS } from "@/components/shared/palette";
import {
  BENCHMARKS,
  HORIZONS,
  type Benchmark,
  type Horizon,
} from "@/constants/currency-risk";
import { press, springPress } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";

export const BENCHMARK_COIN: Record<Benchmark, { glyph: string; color: string }> = {
  USD: { glyph: "$", color: BENCHMARK_COLORS.USD },
  EUR: { glyph: "€", color: BENCHMARK_COLORS.EUR },
  XAU: { glyph: "Au", color: BENCHMARK_COLORS.XAU },
};

export const BENCHMARK_SHORT: Record<Benchmark, string> = {
  USD: "USD",
  EUR: "EUR",
  XAU: "Gold",
};

export function ReadingControls({
  benchmarks,
  horizons,
  benchmark,
  horizon,
  onSelectBenchmark,
  onSelectHorizon,
}: {
  benchmarks: Benchmark[];
  horizons: Horizon[];
  benchmark: Benchmark;
  horizon: Horizon;
  onSelectBenchmark: (b: Benchmark) => void;
  onSelectHorizon: (h: Horizon) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <div
        className="inline-flex items-center gap-2"
        role="group"
        aria-label="Time horizon"
      >
        {horizons.map((h) => (
          <motion.button
            key={h}
            type="button"
            aria-pressed={horizon === h}
            onClick={() => {
              haptics.tap();
              onSelectHorizon(h);
            }}
            whileTap={reducedMotion ? undefined : press}
            transition={springPress}
            className={`min-h-tap min-w-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
              horizon === h
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {HORIZONS[h].short}
          </motion.button>
        ))}
      </div>
      <span
        className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700"
        aria-hidden="true"
      />
      <div
        role="group"
        aria-label="Benchmark"
        className="inline-flex items-center gap-1.5"
      >
        {benchmarks.map((b) => {
          const c = BENCHMARK_COIN[b];
          const selected = benchmark === b;
          return (
            <motion.button
              key={b}
              type="button"
              aria-pressed={selected}
              aria-label={`Compare against ${BENCHMARKS[b].label}`}
              onClick={() => {
                haptics.tap();
                onSelectBenchmark(b);
              }}
              whileTap={reducedMotion ? undefined : press}
              transition={springPress}
              className={`min-h-tap min-w-tap inline-flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                selected
                  ? "bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-900 dark:ring-white"
                  : "ring-1 ring-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
            >
              <Coin
                size={34}
                symbol={c.glyph}
                color={c.color}
                variant="asset"
              />
              <span
                className={`text-2xs font-bold ${selected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
              >
                {BENCHMARK_SHORT[b]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

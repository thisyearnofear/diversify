/**
 * ProtectionCalculator — Learn's one object.
 *
 * Amount + year timeline + the preserved-purchasing-power number.
 * Year tap selects (parent opens the inspector). One CTA. Cash is quiet;
 * the preserved number gets the color.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { YearPoint } from "@/lib/learn/protection-calculator";

interface ProtectionCalculatorProps {
  amount: number;
  onAmountChange: (n: number) => void;
  amountLabel?: string;
  currencyCode: string;
  series: YearPoint[];
  selectedYear: number;
  years: number;
  mixLabel: string;
  onSelectYear: (year: number) => void;
  onProtect: () => void;
  ctaLabel: string;
}

const ACCENT = "#2563eb";

export function ProtectionCalculator({
  amount,
  onAmountChange,
  amountLabel = "Your savings amount",
  currencyCode,
  series,
  selectedYear,
  years,
  mixLabel,
  onSelectYear,
  onProtect,
  ctaLabel,
}: ProtectionCalculatorProps) {
  const reducedMotion = useReducedMotion();
  const point = series[selectedYear] ?? series[series.length - 1];
  const preserved = Math.max(0, (point?.protected ?? 0) - (point?.cash ?? 0));
  const mixWord = mixLabel.toLowerCase() === "gold" ? "gold" : `your ${mixLabel} mix`;
  const maxBar = Math.max(
    1,
    ...series.map((p) => Math.max(p.cash, p.protected)),
  );

  const fmt = (n: number) => Math.round(n).toLocaleString();

  return (
    <div data-testid="protection-calculator">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
        {currencyCode} · {years} years
      </p>

      <label className="inline-flex items-baseline gap-1 mb-3">
        <span className="sr-only">{amountLabel}</span>
        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
          {currencyCode}
        </span>
        <input
          type="number"
          min={1}
          value={amount}
          aria-label={amountLabel}
          onChange={(e) => onAmountChange(Math.max(1, Number(e.target.value) || 1))}
          className="w-28 text-xl font-black text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none tabular-nums"
          inputMode="decimal"
        />
      </label>

      <motion.div
        key={selectedYear}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p
          className="text-4xl font-black tabular-nums leading-none"
          style={{ color: ACCENT }}
        >
          {currencyCode} {fmt(preserved)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-snug">
          {selectedYear === 0
            ? `Today cash and ${mixWord} start even.`
            : `more kept in ${selectedYear} year${selectedYear === 1 ? "" : "s"} with ${mixWord}.`}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
          Cash {currencyCode} {fmt(point?.cash ?? 0)} · {mixLabel} {currencyCode}{" "}
          {fmt(point?.protected ?? 0)}
        </p>
      </motion.div>

      <div
        className="flex items-end justify-between gap-1 mt-6 h-28"
        role="listbox"
        aria-label="Year"
      >
        {series.map((p) => {
          const selected = p.year === selectedYear;
          const cashH = (p.cash / maxBar) * 100;
          const protH = (p.protected / maxBar) * 100;
          return (
            <button
              key={p.year}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`Year ${p.year}`}
              onClick={() => onSelectYear(p.year)}
              className="flex-1 min-h-[44px] flex flex-col items-center justify-end gap-1"
            >
              <div className="relative w-full max-w-[28px] h-20 mx-auto">
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-md ${
                    selected ? "bg-blue-600" : "bg-blue-200 dark:bg-blue-800"
                  }`}
                  style={{
                    height: `${Math.max(protH, 4)}%`,
                    transition: reducedMotion ? undefined : "height 0.35s ease",
                  }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gray-300 dark:bg-gray-600 opacity-80"
                  style={{
                    height: `${Math.max(cashH, 2)}%`,
                    transition: reducedMotion ? undefined : "height 0.35s ease",
                  }}
                />
              </div>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  selected
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400"
                }`}
              >
                {p.year}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onProtect}
        className="mt-5 min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
        style={{ backgroundColor: ACCENT }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default ProtectionCalculator;

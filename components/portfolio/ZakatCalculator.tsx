/**
 * ZakatCalculator - Islamic wealth obligation calculator
 * 
 * Zakat is one of the Five Pillars of Islam - a mandatory charitable giving
 * of 2.5% of one's wealth above the nisab threshold (approx. $5,700 USD)
 * that has been held for one lunar year.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface ZakatCalculatorProps {
  totalPortfolioValue?: number;
  onClose?: () => void;
}

export default function ZakatCalculator({ totalPortfolioValue = 0, onClose }: ZakatCalculatorProps) {
  const [nisabThreshold] = useState(5700); // Approximate nisab in USD
  const [holdings, setHoldings] = useState<number>(totalPortfolioValue || 1000);
  const [liabilities, setLiabilities] = useState(0);

  // Calculate Zakat
  const calculations = useMemo(() => {
    const taxableAmount = Math.max(0, holdings - liabilities);
    const isAboveNisab = taxableAmount >= nisabThreshold;
    const yearlyZakat = isAboveNisab ? taxableAmount * 0.025 : 0;
    const monthlyZakat = yearlyZakat / 12;

    return {
      taxableAmount,
      isAboveNisab,
      yearlyZakat,
      monthlyZakat,
    };
  }, [holdings, liabilities, nisabThreshold]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-4 border-2 border-emerald-200 dark:border-emerald-800"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🕌</span>
          <h3 className="text-base font-black text-emerald-900 dark:text-emerald-100">
            Zakat Calculator
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ✕
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="mb-4 p-3 bg-white/50 dark:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800">
        <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
          Zakat (زكاة) is the third pillar of Islam - a mandatory charity of 2.5% 
          of wealth above the nisab threshold that has been held for one lunar year.
        </p>
      </div>

      {/* Input Fields */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-bold text-emerald-800 dark:text-emerald-200 block mb-1">
            Total Holdings (USD)
          </label>
          <input
            type="number"
            value={holdings}
            onChange={(e) => setHoldings(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold focus:border-emerald-500 outline-none"
            placeholder="Enter total portfolio value"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-emerald-800 dark:text-emerald-200 block mb-1">
            Liabilities/Debts (USD)
          </label>
          <input
            type="number"
            value={liabilities}
            onChange={(e) => setLiabilities(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold focus:border-emerald-500 outline-none"
            placeholder="Enter any outstanding debts"
          />
        </div>
      </div>

      {/* Nisab Status */}
      <div className={`p-3 rounded-xl border-2 mb-4 ${calculations.isAboveNisab 
        ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700' 
        : 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
            {calculations.isAboveNisab ? '✓ Above Nisab Threshold' : '✕ Below Nisab Threshold'}
          </span>
          <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
            Min: ${nisabThreshold.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-white dark:bg-emerald-900 rounded-xl border border-emerald-200 dark:border-emerald-700 text-center">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wide">
            Taxable Amount
          </span>
          <span className="text-lg font-black text-emerald-900 dark:text-emerald-100">
            ${calculations.taxableAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white text-center">
          <span className="text-[10px] font-bold text-emerald-100 block uppercase tracking-wide">
            Yearly Zakat
          </span>
          <span className="text-xl font-black">
            ${calculations.yearlyZakat.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="mt-3 p-2 bg-white/50 dark:bg-emerald-900/30 rounded-lg text-center">
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
          ≈ ${calculations.monthlyZakat.toLocaleString(undefined, { maximumFractionDigits: 2 })} / month
        </span>
      </div>

      {/* halal Assets Note */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          💡 <strong>Tip:</strong> Ensure your holdings are in Sharia-compliant assets. 
          Avoid interest-bearing instruments. Consider gold (PAXG), asset-backed stablecoins, 
          or Mento tokens (USDm, EURm) for halal exposure.
        </p>
      </div>
    </motion.div>
  );
}

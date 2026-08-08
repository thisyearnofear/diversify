import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TokenIcon } from "../shared/TokenIcon";
import Scrim from "../shared/Scrim";

export interface TokenPickerItem {
  symbol: string;
  /** Friendly display name, already simplified for the user's experience mode */
  name: string;
  region?: string;
  balance?: string;
  balanceValue?: number;
  compliant: boolean;
  complianceReason?: string;
  /** Strategy alignment chip, e.g. { label: 'Builds Africa' } */
  badge?: { label: string } | null;
  /** Yield chip, e.g. { text: '+5% APY', color: '...' } */
  yieldBadge?: { text: string; color: string } | null;
}

interface TokenPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  items: TokenPickerItem[];
  selectedToken: string;
  title: string;
}

/**
 * TokenPickerSheet — searchable token picker that replaces the native
 * <select>. Bottom sheet on small screens, centered dialog on larger ones.
 * Shows token logos, balances, and strategy chips instead of cramming
 * metadata into option text.
 */
export default function TokenPickerSheet({
  isOpen,
  onClose,
  onSelect,
  items,
  selectedToken,
  title,
}: TokenPickerSheetProps) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  // Reset search each time the sheet opens, then focus it
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Escape closes; lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.region || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  // Tokens the user holds first, then alphabetical — the thing you own is
  // almost always the thing you're swapping from.
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const balA = a.balanceValue || 0;
        const balB = b.balanceValue || 0;
        if (balA !== balB) return balB - balA;
        return a.symbol.localeCompare(b.symbol);
      }),
    [filtered],
  );

  const formatBalance = (balanceStr?: string) => {
    const num = Number.parseFloat(balanceStr || "0");
    if (num === 0) return "0.00";
    if (num < 0.01) return "<0.01";
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <Scrim intensity="light" onClick={onClose} />
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full sm:max-w-md max-h-[80dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 dark:text-gray-100">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close token picker"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, symbol, or region"
                  aria-label="Search tokens"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                />
              </div>
            </div>

            {/* Token list */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 custom-scrollbar">
              {sorted.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No tokens match &ldquo;{query}&rdquo;
                </p>
              )}
              {sorted.map((item) => {
                const isSelected = item.symbol === selectedToken;
                const hasBalance = (item.balanceValue || 0) > 0;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    disabled={!item.compliant}
                    onClick={() => {
                      onSelect(item.symbol);
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                        : item.compliant
                          ? "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                          : "opacity-45 cursor-not-allowed border border-transparent"
                    }`}
                  >
                    <TokenIcon symbol={item.symbol} size={36} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            title={`Aligned with your strategy: ${item.badge.label}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {item.badge.label}
                          </span>
                        )}
                        {item.yieldBadge && (
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.yieldBadge.color}`}>
                            {item.yieldBadge.text}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {item.symbol}
                        {item.region && item.region !== "Unknown" ? ` · ${item.region}` : ""}
                        {!item.compliant && item.complianceReason
                          ? ` · Not aligned with your strategy`
                          : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      {isSelected && (
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {hasBalance && (
                        <>
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {formatBalance(item.balance)}
                          </div>
                          <div className="text-[10px] text-gray-400">balance</div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "../shared/TokenIcon";
import { PickerSheetShell } from "../shared/PickerSheetShell";
import { haptics } from "@/lib/haptics";
import { springPop } from "@/lib/motion-tokens";
// Deep leaf import — provenance facts are curated constants.
import { provenanceFor } from "@diversifi/shared/src/constants/token-provenance";
import { ProvenanceCoinBack } from "./ProvenanceCoinBack";

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
  const reducedMotion = useReducedMotion();

  // Reset search each time the sheet opens (autofocus lives in the shell).
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
  }, [isOpen]);

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

  // Progressive disclosure: searchable list is powerful but 0-state shows
  // 20+ tokens. Show held + recommended first, tuck the rest behind
  // "Show N more" — selection still rewrites the ticket, search still
  // covers all tokens. Resets when sheet opens.
  const [showAll, setShowAll] = useState(false);
  // Coin-back flip: one row at a time shows its provenance (tapping the
  // token's coin reveals its back — who issued it, who holds the keys).
  const [flippedSymbol, setFlippedSymbol] = useState<string | null>(null);
  useEffect(() => {
    if (isOpen) {
      setShowAll(false);
      setFlippedSymbol(null);
    }
  }, [isOpen]);
  const hasQuery = query.trim().length > 0;
  const displayed = useMemo(() => {
    if (hasQuery || showAll) return sorted;
    const held = sorted.filter((i) => (i.balanceValue || 0) > 0);
    const rec = sorted.filter((i) => (i.balanceValue || 0) === 0 && i.badge);
    const top = [...held, ...rec].slice(0, 6);
    // Ensure selected token is always visible even if it is dust.
    if (!top.some((i) => i.symbol === selectedToken)) {
      const sel = sorted.find((i) => i.symbol === selectedToken);
      if (sel) top.push(sel);
    }
    // Deduplicate
    const seen = new Set<string>();
    return top.filter((i) => (seen.has(i.symbol) ? false : (seen.add(i.symbol), true)));
  }, [sorted, hasQuery, showAll, selectedToken]);
  const hiddenCount = sorted.length - displayed.length;

  const formatBalance = (balanceStr?: string) => {
    const num = Number.parseFloat(balanceStr || "0");
    if (num === 0) return "0.00";
    if (num < 0.01) return "<0.01";
    if (num < 1) return num.toFixed(4);
    return num.toFixed(2);
  };

  // Chrome (portal, scrim, drag handle, search, scroll lock, dismissal)
  // lives in PickerSheetShell — this component owns only the rows.
  return (
    <PickerSheetShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Search name, symbol, or region"
      searchAriaLabel="Search tokens"
      closeButtonAriaLabel="Close token picker"
    >
              {sorted.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No tokens match &ldquo;{query}&rdquo;
                </p>
              )}
              {displayed.map((item, idx) => {
                const isSelected = item.symbol === selectedToken;
                const hasBalance = (item.balanceValue || 0) > 0;
                const provenance = provenanceFor(item.symbol);
                const isFlipped = flippedSymbol === item.symbol;
                return (
                  <motion.div
                    key={item.symbol}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.18) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                        : item.compliant
                          ? "border border-transparent"
                          : "opacity-45 border border-transparent"
                    }`}
                  >
                    {/* The coin: tap to see its back (provenance). Only
                        exists when there's a story — a coin with no back
                        is just an icon. */}
                    {provenance ? (
                      <button
                        type="button"
                        aria-label={`About ${item.symbol}`}
                        aria-pressed={isFlipped}
                        onClick={() => setFlippedSymbol(isFlipped ? null : item.symbol)}
                        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <motion.span
                          key={String(isFlipped)}
                          className="inline-flex"
                          initial={reducedMotion ? false : { rotateY: 90, opacity: 0.3 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          transition={springPop}
                        >
                          <TokenIcon symbol={item.symbol} size={36} className="shrink-0" />
                        </motion.span>
                      </button>
                    ) : (
                      <TokenIcon symbol={item.symbol} size={36} className="shrink-0" />
                    )}
                    <button
                      type="button"
                      disabled={!item.compliant}
                      onClick={() => {
                        onSelect(item.symbol);
                        onClose();
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-3 text-left rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        item.compliant && !isSelected ? "hover:bg-gray-50 dark:hover:bg-gray-800" : ""
                      } ${!item.compliant ? "cursor-not-allowed" : ""}`}
                    >
                    {isFlipped && provenance ? (
                      <div className="flex-1 min-w-0">
                        <ProvenanceCoinBack provenance={provenance} />
                      </div>
                    ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 text-3xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            title={`Aligned with your strategy: ${item.badge.label}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {item.badge.label}
                          </span>
                        )}
                        {item.yieldBadge && (
                          <span className={`shrink-0 text-3xs font-bold px-1.5 py-0.5 rounded-full ${item.yieldBadge.color}`}>
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
                    )}
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
                          <div className="text-3xs text-gray-400">balance</div>
                        </>
                      )}
                    </div>
                    </button>
                  </motion.div>
                );
              })}
              {!hasQuery && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setShowAll(true); }}
                  data-testid="token-picker-show-all"
                  className="w-full mt-2 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-xl border border-gray-200 dark:border-white/[0.06] transition-colors"
                >
                  Show {hiddenCount} more tokens
                </button>
              )}
              {!hasQuery && showAll && hiddenCount === 0 && sorted.length > 6 && (
                <button
                  type="button"
                  onClick={() => { haptics.tap(); setShowAll(false); }}
                  className="w-full mt-2 py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Show less
                </button>
              )}
    </PickerSheetShell>
  );
}

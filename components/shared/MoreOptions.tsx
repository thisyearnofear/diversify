/**
 * MoreOptions — A compact bottom-of-page disclosure for low-priority info.
 *
 * The home page used to render three separate full-bleed cards at the bottom:
 *   - "Two Chains, One Mission" marketing banner
 *   - Region selector chips
 *   - MiniPay footnote (when applicable)
 *
 * None of them is critical to the user's primary action. They earned their
 * place by being there, not by being essential. `MoreOptions` collapses them
 * into a single disclosure row so the page breathes at the bottom.
 *
 * Render as a `<details>` element so it works without JavaScript, but we
 * style it as a custom accordion to match the rest of the design system.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Region } from "@/hooks/use-user-region";
import RegionalIconography from "../regional/RegionalIconography";

export interface MoreOptionsProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regions: readonly Region[];
  /** Whether to render the "Two Chains, One Mission" line. */
  showTwoChainsBanner?: boolean;
  /** Whether to render the MiniPay footnote. */
  isMiniPay?: boolean;
  /** Optional id for in-page navigation targeting. */
  id?: string;
  /** Beginner-mode shortcuts to Exchange and Advisor (hidden behind this disclosure). */
  showPowerActions?: boolean;
  onNavigateToExchange?: () => void;
  onOpenAdvisor?: () => void;
}

export function MoreOptions({
  userRegion,
  setUserRegion,
  regions,
  showTwoChainsBanner = true,
  isMiniPay = false,
  id = "home-more-options",
  showPowerActions = false,
  onNavigateToExchange,
  onOpenAdvisor,
}: MoreOptionsProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const hasPowerActions =
    showPowerActions && (onNavigateToExchange || onOpenAdvisor);

  const hasAnyContent =
    showTwoChainsBanner || isMiniPay || regions.length > 0 || hasPowerActions;

  if (!hasAnyContent) return null;

  return (
    <section
      id={id}
      data-home-section={id}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 scroll-mt-20"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">⚙️</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {showPowerActions && !showTwoChainsBanner && regions.length === 0
              ? "More options"
              : "Settings & region"}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            · {userRegion}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`${id}-content`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800">
              {hasPowerActions && (
                <div className="pt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {onNavigateToExchange && (
                    <button
                      type="button"
                      onClick={onNavigateToExchange}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-left text-sm font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      <span aria-hidden="true">💱</span>
                      Swap currencies
                    </button>
                  )}
                  {onOpenAdvisor && (
                    <button
                      type="button"
                      onClick={onOpenAdvisor}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-left text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <span aria-hidden="true">💬</span>
                      Talk to Advisor
                    </button>
                  )}
                </div>
              )}

              {showTwoChainsBanner && (
                <div className="pt-3 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex -space-x-1.5 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-sm border-2 border-white dark:border-gray-900">
                      🌍
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm border-2 border-white dark:border-gray-900">
                      💰
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Celo for regional diversity, Arbitrum for yield.
                    </span>
                    <div className="text-gray-500 mt-0.5">
                      Bridged via LiFi when needed.
                    </div>
                  </div>
                </div>
              )}

              {isMiniPay && (
                <p className="pt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  You&apos;re using <strong>MiniPay</strong> — DiversiFi uses Celo
                  for your regional stablecoins. Connect a full wallet to
                  access Arbitrum RWA assets.
                </p>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <RegionalIconography region={userRegion} size="sm" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Home region
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {regions.map((region) => (
                    <button
                      key={region}
                      onClick={() => setUserRegion(region)}
                      className={`px-2.5 py-1 text-xs rounded-full transition-all font-bold ${
                        userRegion === region
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

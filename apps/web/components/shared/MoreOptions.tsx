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
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Region } from "@/hooks/use-user-region";
import type { UserExperienceMode } from "@/context/app/types";
import { exposureLabel, type Exposure } from "@diversifi/shared/src/config/exposures";
import {
  ANCHOR_CURRENCIES,
  ANCHOR_SOURCE_LABEL,
  type AnchorFx,
  type AnchorSource,
} from "@/lib/anchor-currency";
import RegionalIconography from "../regional/RegionalIconography";
import { FEELS, getFeel, setFeel, type Feel } from "@/lib/feel";

const FEEL_LABEL: Record<Feel, string> = {
  silent: "Silent",
  touch: "Touch",
  sound: "Sound",
};

const MODES: readonly UserExperienceMode[] = ["simple", "full"];
const MODE_LABEL: Record<UserExperienceMode, string> = {
  simple: "Simple",
  full: "Full",
};

export interface MoreOptionsProps {
  /** Render without card chrome — for use inside an InstrumentShell's
   *  status slot, so settings don't stack a second card under the object. */
  bare?: boolean;
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
  /**
   * Simple | Full — moved here 2026-09-28 from the always-visible header
   * (nav decluttering). A once-in-a-while preference belongs one tap
   * deep, not permanent chrome.
   */
  experienceMode?: UserExperienceMode;
  setExperienceMode?: (mode: UserExperienceMode) => void;
  /** The currency the user thinks in — names the plan reserve. */
  anchorCurrency?: Exposure;
  anchorSource?: AnchorSource;
  /** USD→anchor rate; null renders no rate line (never a guess). */
  anchorFx?: AnchorFx | null;
  onAnchorChange?: (currency: Exposure) => void;
}

function anchorRateLine(currency: Exposure, fx: AnchorFx | null | undefined): string | null {
  if (!fx || fx.source === "identity") return null;
  const rate = fx.rate.toLocaleString(undefined, { maximumFractionDigits: fx.rate < 10 ? 4 : 2 });
  return fx.source === "live"
    ? `1 USD ≈ ${rate} ${currency} · live rate${fx.date ? ` (${fx.date})` : ""}`
    : `1 USD ≈ ${rate} ${currency} · fallback table — live FX unavailable`;
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
  experienceMode,
  setExperienceMode,
  anchorCurrency,
  anchorSource,
  anchorFx,
  onAnchorChange,
  bare = false,
}: MoreOptionsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [feel, setFeelState] = React.useState<Feel>("touch");
  React.useEffect(() => setFeelState(getFeel()), []);
  const chooseFeel = (next: Feel) => {
    setFeel(next);
    setFeelState(next);
  };
  const onFeelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = FEELS[(FEELS.indexOf(feel) + step + FEELS.length) % FEELS.length];
    chooseFeel(next);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[FEELS.indexOf(next)]?.focus();
  };
  const modeGroupRef = React.useRef<HTMLDivElement>(null);

  const hasPowerActions =
    showPowerActions && (onNavigateToExchange || onOpenAdvisor);
  const hasModeToggle = Boolean(experienceMode && setExperienceMode);
  const hasAnchor = Boolean(anchorCurrency && onAnchorChange);
  const rateLine = anchorCurrency ? anchorRateLine(anchorCurrency, anchorFx) : null;

  const hasAnyContent =
    showTwoChainsBanner || isMiniPay || regions.length > 0 || hasPowerActions || hasModeToggle || hasAnchor;

  if (!hasAnyContent) return null;

  const focusModeOption = (index: number) => {
    modeGroupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const chooseMode = (index: number) => {
    setExperienceMode?.(MODES[index]);
    focusModeOption(index);
  };
  const onModeKeyDown = (e: React.KeyboardEvent) => {
    const index = MODES.indexOf(experienceMode!);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      chooseMode((index + 1) % MODES.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      chooseMode((index + MODES.length - 1) % MODES.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      chooseMode(0);
    } else if (e.key === "End") {
      e.preventDefault();
      chooseMode(MODES.length - 1);
    }
  };

  return (
    <section
      id={id}
      data-home-section={id}
      className={
        bare
          ? "mt-3 border-t border-gray-100 dark:border-gray-800 pt-1 scroll-mt-20"
          : "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 scroll-mt-20"
      }
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
              {hasModeToggle && (
                <div className="pt-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Experience
                  </span>
                  <div
                    ref={modeGroupRef}
                    role="radiogroup"
                    aria-label="Experience mode"
                    className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1"
                    onKeyDown={onModeKeyDown}
                  >
                    {MODES.map((mode) => {
                      const isSelected = experienceMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => setExperienceMode?.(mode)}
                          className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                            isSelected
                              ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          }`}
                        >
                          {MODE_LABEL[mode]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Feel
                </span>
                <div
                  role="radiogroup"
                  aria-label="Vibration and sound"
                  className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1"
                  onKeyDown={onFeelKeyDown}
                >
                  {FEELS.map((f) => {
                    const isSelected = feel === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => chooseFeel(f)}
                        className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                          isSelected
                            ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                      >
                        {FEEL_LABEL[f]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasAnchor && anchorCurrency && (
                <div className="pt-3" data-testid="anchor-currency-setting">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`${id}-anchor`}
                      className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                      Your currency
                    </label>
                    <select
                      id={`${id}-anchor`}
                      value={anchorCurrency}
                      onChange={(e) => onAnchorChange?.(e.target.value as Exposure)}
                      className="min-h-tap rounded-full bg-gray-100 dark:bg-gray-800 px-3 text-xs font-bold text-gray-900 dark:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                    >
                      {ANCHOR_CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code} · {exposureLabel(code)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-2xs text-gray-500 dark:text-gray-400">
                    {anchorSource ? `${ANCHOR_SOURCE_LABEL[anchorSource]} · ` : ""}
                    Names your plan&apos;s reserve.
                  </p>
                  {rateLine && (
                    <p data-testid="anchor-fx" className="text-2xs text-gray-500 dark:text-gray-400">
                      {rateLine}
                    </p>
                  )}
                </div>
              )}

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
                      Talk to Guardian
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
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors font-bold ${
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

              {/* Legal links render only once counsel has approved the pages
                  (NEXT_PUBLIC_LEGAL_APPROVED) — until then the drafts stay
                  reachable by URL but unlinked. */}
              {process.env.NEXT_PUBLIC_LEGAL_APPROVED === 'true' && (
                <nav
                  aria-label="Legal"
                  className="pt-3 flex items-center gap-3 text-2xs text-gray-500 dark:text-gray-400"
                >
                  <Link href="/terms" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">Terms</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">Privacy</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/risk" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">Risk</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/fees" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300">Fees</Link>
                </nav>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

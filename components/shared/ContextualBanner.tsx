/**
 * ContextualBanner — A single, priority-ordered slot for "look here" notices.
 *
 * Before this component, the home page had up to four competing full-bleed
 * banners (cold-start, daily-claim, goal-drift, demo) that all vied for the
 * user's attention. They never stacked well and made the page feel noisy.
 *
 * `useHomeSections()` resolves to exactly one `kind` and `ContextualBanner`
 * renders the right variant. Adding a new banner = one new variant here + one
 * entry in the hook. Nothing else has to change.
 *
 * The variants are visually distinct (color, icon, action) so the user
 * always knows what state they're in without reading a long explanation.
 */

import React from "react";
import { motion } from "framer-motion";
import type { Region } from "@/hooks/use-user-region";
import { Card, PrimaryButton, SecondaryButton } from "./TabComponents";
import { useColdStart } from "@/hooks/use-cold-start";
import type { TabId } from "@/constants/tabs";
import { ApacRailHonestyBanner } from "@/components/shared/ApacRailHonestyBanner";
import { NetworkOptimizedOnramp } from "../onramp";
import WalletButton from "../wallet/WalletButton";

export interface ContextualBannerProps {
  kind: "cold-start" | "demo" | "goal-drift" | "daily-claim" | "apac-rail" | "fx-corridor-hint" | null;
  isDemo: boolean;
  /** Total value of the portfolio, for the demo banner copy */
  demoValue?: number;
  /** Goal drift summary, e.g. "Hedge score 42% — below your 60% goal." */
  goalDriftMessage?: string;
  /** Goal alignment action label */
  goalDriftActionLabel?: string;
  /** Streak / claim text for the daily-claim variant */
  dailyClaimText?: string;
  userRegion: Region;
  chainId: number | null;
  address?: string | null;
  setActiveTab: (tab: TabId) => void;
  onDisableDemo?: () => void;
  onEnableDemo?: () => void;
  /**
   * Dismiss + scroll-to-FX-Corridor handler. Called when the user clicks
   * the `fx-corridor-hint` banner. Should both persist the dismissal
   * (so the hint doesn't reappear) AND scroll the business section
   * into view. Wired in ConnectedOverview.
   */
  onDismissFxCorridorHint?: () => void;
}

/**
 * Renders a single banner slot. If `kind` is null, renders nothing.
 * The component is pure presentational — the decision of *which* banner to
 * show lives in `useHomeSections()`.
 */
export function ContextualBanner({
  kind,
  isDemo,
  demoValue,
  goalDriftMessage,
  goalDriftActionLabel,
  dailyClaimText,
  userRegion,
  chainId,
  address,
  setActiveTab,
  onDisableDemo,
  onEnableDemo,
  onDismissFxCorridorHint,
}: ContextualBannerProps) {
  // Cold-start needs the coldStart hook for the contextual copy.
  // We always call the hook (Rules of Hooks) but only render the cold-start
  // variant when kind === "cold-start".
  const coldStart = useColdStart(chainId);

  if (!kind) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      {kind === "cold-start" && (
        <ColdStartVariant
          userRegion={userRegion}
          coldStart={coldStart}
          chainId={chainId}
          address={address}
          setActiveTab={setActiveTab}
          onEnableDemo={onEnableDemo}
        />
      )}
      {kind === "demo" && (
        <DemoVariant
          isDemo={isDemo}
          demoValue={demoValue}
          onDisableDemo={onDisableDemo}
        />
      )}
      {kind === "goal-drift" && (
        <GoalDriftVariant
          message={goalDriftMessage}
          actionLabel={goalDriftActionLabel}
          onAction={() => setActiveTab("exchange")}
        />
      )}
      {kind === "daily-claim" && (
        <DailyClaimVariant
          text={dailyClaimText}
          onAction={() => setActiveTab("protect")}
        />
      )}
      {kind === "apac-rail" && <ApacRailHonestyBanner variant="home" />}
      {kind === "fx-corridor-hint" && (
        <FxCorridorHintVariant onAction={() => onDismissFxCorridorHint?.()} />
      )}
    </motion.div>
  );
}

// ── Variants ─────────────────────────────────────────────────────────────

function ColdStartVariant({
  userRegion,
  coldStart,
  chainId,
  address,
  setActiveTab,
  onEnableDemo,
}: {
  userRegion: Region;
  coldStart: ReturnType<typeof useColdStart>;
  chainId: number | null;
  address?: string | null;
  setActiveTab: (tab: TabId) => void;
  onEnableDemo?: () => void;
}) {
  // Wrong-chain: primary action is to switch, not to fund.
  const isOnWrongChain =
    coldStart.suggestedChainId && !coldStart.isOnSupportedChain;

  return (
    <Card
      padding="p-0"
      className="overflow-hidden border-2 border-amber-200 dark:border-amber-900"
    >
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">{coldStart.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
              {coldStart.headline}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mt-1">
              {coldStart.body}
            </p>
            {coldStart.currentChainName && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-bold">
                Current network: {coldStart.currentChainName}
              </p>
            )}
          </div>
        </div>

        {isOnWrongChain ? (
          <PrimaryButton
            fullWidth
            onClick={() => setActiveTab("exchange")}
            icon={<span>{coldStart.emoji}</span>}
          >
            {coldStart.suggestedChainName === "Arbitrum"
              ? "Switch to Arbitrum to start"
              : `Switch to ${coldStart.suggestedChainName}`}
          </PrimaryButton>
        ) : (
          <div className="space-y-2">
            <NetworkOptimizedOnramp
              variant="white"
              defaultAmount="100"
              className="w-full"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              💳 Buy with card or bank transfer • Low KYC
            </p>
          </div>
        )}

        {/* "Or transfer from another wallet" — collapsed by default to keep
            the page scannable. The address copy is a power-user action. */}
        {address && (
          <details className="mt-2 group">
            <summary className="text-xs text-amber-700 dark:text-amber-300 cursor-pointer font-medium hover:text-amber-900 dark:hover:text-amber-100 list-none flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90">▸</span>
              Transfer from another wallet
            </summary>
            <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded-xl border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate flex-1">
                {address}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="p-1 px-2 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 transition-colors shrink-0"
              >
                Copy
              </button>
            </div>
          </details>
        )}

        {onEnableDemo && (
          <button
            onClick={onEnableDemo}
            className="w-full mt-2 py-2.5 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800 rounded-xl text-sm font-bold transition-colors"
          >
            🎮 Or explore with sample data
          </button>
        )}
      </div>
    </Card>
  );
}

function DemoVariant({
  isDemo,
  demoValue,
  onDisableDemo,
}: {
  isDemo: boolean;
  demoValue?: number;
  onDisableDemo?: () => void;
}) {
  return (
    <Card padding="p-0" className="overflow-hidden border-2 border-blue-500 dark:border-blue-600">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">🎮</span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">Preview Mode Active</h3>
              <p className="text-xs text-blue-100 truncate">
                {demoValue
                  ? `Sample portfolio • $${demoValue.toFixed(0)} on display`
                  : "Exploring with sample data"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {onDisableDemo && (
              <button
                onClick={onDisableDemo}
                className="px-3 min-h-[44px] py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Exit Demo
              </button>
            )}
            <WalletButton variant="inline" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function GoalDriftVariant({
  message,
  actionLabel = "Rebalance",
  onAction,
}: {
  message?: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <Card padding="p-0" className="overflow-hidden border-2 border-amber-200 dark:border-amber-900">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 flex items-center gap-3">
        <div className="text-2xl shrink-0">🎯</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Goal Drift
          </div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mt-0.5 truncate">
            {message || "Your portfolio has drifted from your protection goal."}
          </p>
        </div>
        <button
          onClick={onAction}
          className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel} →
        </button>
      </div>
    </Card>
  );
}

/**
 * FxCorridorHintVariant — One-time discovery hint for the FX Corridor
 * section. Shows when the user has set `moneyPurpose === 'upcoming_payment'`
 * but hasn't expanded the business section yet. Click → dismiss +
 * scroll. After dismiss, never reappears (persisted in localStorage by
 * the parent hook).
 *
 * Visual: a 1-line dense card (44px touch target) in blue, the same
 * gradient family as the cold-start variant but visually distinct so
 * the user can tell the two states apart without reading.
 */
function FxCorridorHintVariant({ onAction }: { onAction: () => void }) {
  return (
    <Card
      padding="p-0"
      className="overflow-hidden border-2 border-blue-200 dark:border-blue-900"
    >
      <button
        onClick={onAction}
        className="w-full flex items-center justify-between gap-3 p-3 min-h-[44px] bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-colors text-left"
        aria-label="Scroll to FX Corridor section"
        data-testid="fx-corridor-hint"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0" aria-hidden="true">💼</span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Business Mode Active
            </div>
            <div className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">
              Your FX Corridor dashboard is live below
            </div>
          </div>
        </div>
        <span className="text-blue-600 dark:text-blue-400 text-xs font-bold whitespace-nowrap shrink-0">
          View ↓
        </span>
      </button>
    </Card>
  );
}

function DailyClaimVariant({
  text,
  onAction,
}: {
  text?: string;
  onAction: () => void;
}) {
  return (
    <button
      onClick={onAction}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.99] transition-[transform,box-shadow]"
      aria-label="Claim your daily GoodDollar reward"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0 animate-bounce">🎁</span>
        <div className="text-left min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide">
            Daily Reward Ready
          </div>
          <div className="text-xs text-emerald-100 font-medium truncate">
            {text || "Tap to claim — keeps your streak alive"}
          </div>
        </div>
      </div>
      <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
        Claim Now
      </div>
    </button>
  );
}

/**
 * GuardianBoundsSheet — the "Limits & controls" inspector body.
 *
 * One job: what Guardian may do with your money, and how to stop it.
 * The signed limit rows, run/pause, the plan it follows, and the optional
 * wallet-enforced cap. Notifications, voice and integrations are NOT
 * limits — they live behind one quiet link (`onOpenSettings`) so the
 * trust moment isn't buried under a settings form.
 */

import React from "react";
import { LoopResultSummary } from "./LoopResultSummary";
import type {
  GuardianLoopResult,
  GuardianSessionInfo,
} from "@/hooks/use-session-key";
import type { useVault } from "@/hooks/use-vault";
import { MIN_AUTO_SAVER_FUNDS_USD } from "@/constants/guardian-limits";

export function GuardianBoundsSheet({
  hasValidPermission,
  isAutonomous = false,
  dailyLimit,
  sessionInfo,
  permissionExpiry,
  isRunningLoop,
  onRunNow,
  loopResult,
  sessionKeyError,
  isRevoking,
  onRevoke,
  onSetLimit,
  vault,
  onChangeStrategy,
  shieldPlan,
  shieldPlanName,
  onFollowShieldPlan,
  walletStableBalanceUSD,
  isMiniPay,
  onNavigateToFund,
  isOnGrantEligibleChain,
  grantAvailable,
  grantStatus,
  grantError,
  onOpenGrantModal,
  onSwitchToGrantChain,
  onOpenSettings,
}: {
  hasValidPermission: boolean;
  /** GUARDIAN tier — Guardian may act without a per-move signature. */
  isAutonomous?: boolean;
  dailyLimit: number;
  sessionInfo: GuardianSessionInfo | null;
  permissionExpiry: string | null;
  isRunningLoop: boolean;
  onRunNow: () => void;
  loopResult: GuardianLoopResult | null;
  sessionKeyError: string | null;
  isRevoking: boolean;
  onRevoke: () => void;
  /** Opens the daily-limit setup when no limit is signed yet. */
  onSetLimit: () => void;
  vault: ReturnType<typeof useVault>;
  onChangeStrategy: () => void;
  /** The plan chosen on Shield (StrategyContext). */
  shieldPlan?: string | null;
  shieldPlanName?: string | null;
  /** Point Guardian at the Shield plan (user-initiated; may sign). */
  onFollowShieldPlan?: () => void;
  walletStableBalanceUSD: number;
  isMiniPay?: boolean;
  onNavigateToFund?: () => void;
  isOnGrantEligibleChain: boolean;
  /** False when no Guardian session account is configured — hides the grant CTA. */
  grantAvailable: boolean;
  grantStatus: 'idle' | 'requesting' | 'granted' | 'error';
  grantError: string | null;
  onOpenGrantModal: () => void;
  onSwitchToGrantChain: () => void;
  /** Opens notifications & integrations — the non-limit preferences. */
  onOpenSettings: () => void;
}) {
  const planMismatch = Boolean(
    vault.vault?.strategy && shieldPlan && vault.vault.strategy !== shieldPlan,
  );
  const isWaitingForFunds =
    hasValidPermission && walletStableBalanceUSD < MIN_AUTO_SAVER_FUNDS_USD;

  return (
    <div className="space-y-6">
      {hasValidPermission ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAutonomous
              ? "Guardian can move savings on its own within this limit. Your wallet enforces the cap on-chain."
              : "Guardian proposes moves within this limit. You approve each one in your wallet."}
          </p>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Daily limit</span>
            <span className="font-bold">${dailyLimit}/day</span>
          </div>
          {sessionInfo && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Used today</span>
                <span className="font-bold tabular-nums">${sessionInfo.spentTodayUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Left today</span>
                <span className="font-bold tabular-nums">${sessionInfo.remainingTodayUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Moves so far</span>
                <span className="font-bold tabular-nums">{sessionInfo.executionCount}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Expires</span>
            <span className="font-bold">{permissionExpiry}</span>
          </div>

          {isWaitingForFunds && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 space-y-1.5">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Waiting for funds — Guardian needs at least ${MIN_AUTO_SAVER_FUNDS_USD} in stables on this network to propose a move.
              </p>
              {isMiniPay ? (
                <p className="text-2xs font-bold text-amber-800 dark:text-amber-200">
                  Tip: tap &quot;Add Cash&quot; in your MiniPay wallet.
                </p>
              ) : onNavigateToFund ? (
                <button
                  type="button"
                  onClick={onNavigateToFund}
                  className="min-h-tap w-full text-xs font-bold text-amber-800 dark:text-amber-100 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors"
                >
                  Add funds
                </button>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={onRunNow}
            disabled={isRunningLoop}
            className="min-h-tap w-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {isRunningLoop ? "Checking…" : "Check for a move now"}
          </button>
          {loopResult && <LoopResultSummary loopResult={loopResult} />}
          {sessionKeyError && (
            <div className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
              {sessionKeyError}
            </div>
          )}
          <button
            type="button"
            onClick={onRevoke}
            disabled={isRevoking}
            className="min-h-tap w-full text-sm font-bold text-red-500 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRevoking ? "Pausing…" : "Pause Guardian"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No daily limit yet. Guardian can explain and suggest, but it can&apos;t propose a move until you set one.
          </p>
          <button
            type="button"
            onClick={onSetLimit}
            className="min-h-tap w-full text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            Set daily limit
          </button>
        </div>
      )}

      {/* The plan Guardian follows. Same noun as Shield ("Protection plan"). */}
      {vault.vault?.strategy && (
        <div className="flex items-center justify-between gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-gray-500">Protection plan</p>
            <p className="font-bold capitalize truncate">
              {vault.vault.strategy.replace(/-/g, ' ')}
            </p>
          </div>
          {planMismatch && onFollowShieldPlan ? (
            <button
              type="button"
              onClick={onFollowShieldPlan}
              className="min-h-tap px-3 text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0"
            >
              Follow {shieldPlanName ?? "Shield plan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onChangeStrategy}
              className="min-h-tap px-3 text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0"
            >
              Change plan
            </button>
          )}
        </div>
      )}
      {planMismatch && (
        <p className="-mt-4 text-2xs text-amber-700 dark:text-amber-300" data-testid="guardian-plan-mismatch">
          Your Shield plan is {shieldPlanName ?? shieldPlan} — Guardian is still proposing for this one.
        </p>
      )}

      {/* Optional wallet-enforced cap (ERC-7715). Only offered once a
          limit is signed — the grant attaches to that permission. */}
      {hasValidPermission && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <p className="text-2xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Optional · Let Guardian act for you
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Skip the per-move signature: Guardian may move up to ${dailyLimit}/day on its own, and MetaMask enforces that cap on-chain — not just us.
          </p>
          {!grantAvailable ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Not available on this deployment yet.
            </p>
          ) : grantStatus === 'granted' ? (
            <p className="text-xs font-bold text-green-700 dark:text-green-400">
              ✓ Guardian can act for you — your wallet enforces the cap
            </p>
          ) : !isOnGrantEligibleChain ? (
            <button
              type="button"
              onClick={onSwitchToGrantChain}
              className="min-h-tap w-full text-xs font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors"
            >
              Switch to a supported network
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenGrantModal}
                disabled={grantStatus === 'requesting'}
                className="min-h-tap w-full text-xs font-bold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {grantStatus === 'requesting' ? 'Waiting for MetaMask…' : 'Let Guardian act (MetaMask)'}
              </button>
              {grantError && (
                <p className="text-xs text-red-500" role="alert">{grantError}</p>
              )}
            </>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-tap w-full text-left text-sm font-semibold text-blue-600 dark:text-blue-400"
        >
          Notifications &amp; integrations →
        </button>
      </div>
    </div>
  );
}

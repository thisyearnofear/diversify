/**
 * GuardianBoundsSheet — the "Limits & controls" inspector body: the
 * permission rows, run/pause controls, vault, WDK status, stronger
 * protection, and the automation settings — moved verbatim from
 * AgentTierStatus's setup tab.
 */

import React from "react";
import GuardianWDKStatus from "./GuardianWDKStatus";
import AutomationSettings from "./AutomationSettings";
import { LoopResultSummary } from "./LoopResultSummary";
import type {
  GuardianLoopResult,
  GuardianSessionInfo,
} from "@/hooks/use-session-key";
import type { useVault } from "@/hooks/use-vault";
import { MIN_AUTO_SAVER_FUNDS_USD } from "@/hooks/use-guardian-instrument";

export function GuardianBoundsSheet({
  autonomousStatus,
  hasValidPermission,
  guardianActive,
  dailyLimit,
  sessionInfo,
  permissionExpiry,
  isRunningLoop,
  onRunNow,
  loopResult,
  sessionKeyError,
  isRevoking,
  onRevoke,
  vault,
  onChangeStrategy,
  hasTokenVault,
  walletStableBalanceUSD,
  isMiniPay,
  onNavigateToFund,
  isOnGrantEligibleChain,
  grantAvailable,
  grantStatus,
  grantError,
  onOpenGrantModal,
  onSwitchToGrantChain,
  config,
  onConfigChange,
}: {
  autonomousStatus: { walletType?: string } | null;
  hasValidPermission: boolean;
  guardianActive: boolean;
  dailyLimit: number;
  sessionInfo: GuardianSessionInfo | null;
  permissionExpiry: string | null;
  isRunningLoop: boolean;
  onRunNow: () => void;
  loopResult: GuardianLoopResult | null;
  sessionKeyError: string | null;
  isRevoking: boolean;
  onRevoke: () => void;
  vault: ReturnType<typeof useVault>;
  onChangeStrategy: () => void;
  hasTokenVault: boolean;
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
  config?: Parameters<typeof AutomationSettings>[0]["config"];
  onConfigChange?: (config: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        {/* Permission info — Guardian runs on the user's wallet under signed session permissions */}
        {hasValidPermission ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Daily limit</span>
              <span className="font-bold">${dailyLimit}/day</span>
            </div>
            {sessionInfo && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Spent today</span>
                  <span className="font-bold text-amber-600">${sessionInfo.spentTodayUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Remaining</span>
                  <span className="font-bold text-green-600">${sessionInfo.remainingTodayUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Saves so far</span>
                  <span className="font-bold">{sessionInfo.executionCount}</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Expires</span>
              <span className="font-bold">{permissionExpiry}</span>
            </div>
            {sessionInfo && sessionInfo.recentExecutions.length > 0 && (
              <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <div className="text-[11px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-300">
                  Recent saves
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {sessionInfo.recentExecutions.length} move{sessionInfo.recentExecutions.length === 1 ? '' : 's'} recorded
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={onRunNow}
                disabled={isRunningLoop}
                className="w-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2 transition-colors disabled:opacity-50"
              >
                {isRunningLoop ? "Running…" : "Run Auto-Saver now"}
              </button>
            </div>
            {loopResult && <LoopResultSummary loopResult={loopResult} />}
            {sessionKeyError && (
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2" role="alert">
                {sessionKeyError}
              </div>
            )}
            <button
              onClick={onRevoke}
              disabled={isRevoking}
              className="w-full text-sm font-bold text-red-500 border border-red-200 dark:border-red-800 rounded-xl py-2 mt-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRevoking ? "Pausing…" : "Pause Auto-Saver"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Guardian profile (shown when a strategy is saved) */}
      {vault.vault && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
          {vault.vault.strategy && (
            <div className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-purple-200/50 dark:border-purple-800/50">
              <span className="text-gray-500">Strategy</span>
              <span className="font-bold text-purple-700 dark:text-purple-300 capitalize flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-purple-500" aria-hidden="true" />
                {vault.vault.strategy.replace(/-/g, ' ')}
              </span>
            </div>
          )}
          <button
            onClick={onChangeStrategy}
            className="w-full mt-3 text-xs font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg py-2 transition-colors"
          >
            Change Strategy
          </button>
        </div>
      )}

      <GuardianWDKStatus
        isGuardianActive={hasValidPermission || guardianActive}
        watchedAssets={["USDC", "EURC", "PAXG"]}
        watchedNetworks={["Celo", "Arbitrum"]}
        latestAdvice={
          sessionInfo?.latestRecommendation
            ? {
                oneLiner:
                  sessionInfo.latestRecommendation.oneLiner ||
                  sessionInfo.latestRecommendation.reasoning,
                capturedAt: sessionInfo.latestRecommendation.capturedAt,
              }
            : null
        }
        hasTokenVault={hasTokenVault}
        walletStableBalanceUSD={walletStableBalanceUSD}
        minRequiredFundsUSD={MIN_AUTO_SAVER_FUNDS_USD}
        onAddFunds={onNavigateToFund}
        isMiniPay={isMiniPay}
      />

      {/* Stronger protection via MetaMask — opens a confirmation
          modal so the user sees the limit BEFORE the wallet pops. */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-full">
            Optional
          </span>
          <span className="text-[11px] text-gray-400 uppercase tracking-[0.16em]">
            Stronger protection
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Have your wallet co-sign an on-chain spending cap via an ERC-7715 delegation. Best if you already use MetaMask.
        </p>
        {!grantAvailable ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Stronger protection isn&apos;t enabled on this deployment yet.
          </p>
        ) : grantStatus === 'granted' ? (
          <div className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
            Stronger protection is active
          </div>
        ) : !isOnGrantEligibleChain ? (
          <button
            type="button"
            onClick={onSwitchToGrantChain}
            className="w-full text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl py-2.5 transition-colors"
          >
            Switch to a supported network to enable
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenGrantModal}
              disabled={grantStatus === 'requesting'}
              className="w-full text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {grantStatus === 'requesting' ? 'Waiting for MetaMask…' : 'Add stronger protection (MetaMask)'}
            </button>
            {grantError && (
              <p className="text-xs text-red-500 mt-2">{grantError}</p>
            )}
          </>
        )}
      </div>

      <AutomationSettings
        config={config}
        onConfigChange={onConfigChange}
        autonomousStatus={autonomousStatus as never}
      />
    </div>
  );
}

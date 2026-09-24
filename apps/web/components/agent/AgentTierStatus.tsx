/**
 * Guardian status primitives — the compact status chip plus the
 * tier-snapshot hooks other surfaces (Shield, ActionableRecommendation)
 * use to read Guardian state without mounting a second set of polling
 * hooks. The Guardian tab's instrument lives in
 * `use-guardian-instrument.ts` + `GuardianObject.tsx`.
 */

import React, { useMemo } from "react";
import RiveGuardian, { type GuardianPosture } from '@/components/shared/RiveGuardian';
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
} from '@diversifi/shared/src/types/guardian-protection';
import { useSessionKey } from "../../hooks/use-session-key";
import { useVault } from "../../hooks/use-vault";
import { useWalletContext } from "../wallet/WalletProvider";
import { useStrategy } from "@/context/app/StrategyContext";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
// Deep leaf import — NOT the barrel — keeps the agent-status stack out of
// first-load and avoids the no-restricted-imports lint warning.
import { GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import StatusBadge from "@/components/shared/StatusBadge";

export interface GuardianStatusChipProps {
  onSetup?: () => void;
  onDeposit?: () => void;
  onViewActivity?: () => void;
  className?: string;
}

/**
 * Guardian tier derivation from an already-fetched vault/session-key pair.
 * Use this (instead of `useGuardianTierSnapshot`) when the caller already
 * holds its own `useVault()`/`useSessionKey()` instances, so a second copy
 * of those hooks — each with its own polling — doesn't get mounted just to
 * read the derived state.
 */
export function useGuardianTierSnapshotFrom(
  vault: ReturnType<typeof useVault>,
  sessionKey: Pick<ReturnType<typeof useSessionKey>, "signedPermission" | "sessionInfo" | "deriveGuardianState">,
) {
  const { address } = useWalletContext();
  const { signedPermission, sessionInfo, deriveGuardianState } = sessionKey;

  const guardianState = useMemo(() => {
    const totalDepositedUSD = vault.vault?.totalDepositedUSD ?? 0;
    return deriveGuardianState({
      vault: vault.vault ? { totalDepositedUSD } : null,
      permission: signedPermission
        ? {
            status: 'active',
            expiresAt: signedPermission.permission.expiresAt,
            spentTodayUSD: sessionInfo?.spentTodayUSD ?? 0,
            dailyLimitUSD: signedPermission.permission.dailyLimitUSD,
          }
        : (sessionInfo && {
            status: sessionInfo.active ? 'active' : 'revoked',
            expiresAt: sessionInfo.dailyLimitUSD > 0 ? Math.floor(Date.now() / 1000) + 86400 : 0,
            spentTodayUSD: sessionInfo.spentTodayUSD,
            dailyLimitUSD: sessionInfo.dailyLimitUSD,
          }),
    });
  }, [deriveGuardianState, vault.vault, signedPermission, sessionInfo]);

  const copy = GUARDIAN_USER_COPY[guardianState];
  const isActive = guardianState === 'monitoring';
  const lastActivity = sessionInfo?.recentExecutions?.[0];

  return { address, guardianState, copy, isActive, lastActivity };
}

/**
 * Shared Guardian tier derivation for compact status surfaces that don't
 * already hold their own vault/session-key instances (e.g. GuardianStatusChip).
 * Mounts its own `useVault()`/`useSessionKey()` — callers that already have
 * these (e.g. ProtectionTab) should use `useGuardianTierSnapshotFrom` instead
 * to avoid a second set of instances polling in parallel.
 */
export function useGuardianTierSnapshot() {
  const vault = useVault();
  const sessionKey = useSessionKey();
  return useGuardianTierSnapshotFrom(vault, sessionKey);
}

/** Compact Auto-Saver status — one headline, one CTA. */
export function GuardianStatusChip({
  onSetup,
  onDeposit,
  onViewActivity,
  className = '',
}: GuardianStatusChipProps) {
  const { address, guardianState, copy, isActive, lastActivity } = useGuardianTierSnapshot();
  const { financialStrategy } = useStrategy();
  const archetype = useMemo(
    () => ARCHETYPES[strategyToArchetype(financialStrategy) ?? 'custom'],
    [financialStrategy],
  );

  // Sentinel posture from the shared tier state: monitoring protects,
  // authorized/funded watch for their next step, idle rests.
  const guardianPosture: GuardianPosture =
    guardianState === 'monitoring'
      ? 'acting'
      : guardianState === 'idle'
        ? 'resting'
        : 'watching';

  if (!address) return null;

  const handleCta = () => {
    if (guardianState === 'monitoring') {
      onViewActivity?.();
      return;
    }
    if (guardianState === 'authorized') {
      onDeposit?.();
      return;
    }
    onSetup?.();
  };

  const timeAgo = (isoOrMs: number) => {
    const t = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div
      className={`rounded-2xl border p-4 bg-white dark:bg-gray-900 shadow-sm ${className}`}
      style={{
        borderColor: `${archetype.accent}4d`,
      }}
      role="status"
      aria-label={`Guardian: ${copy.headline}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <RiveGuardian size={56} posture={guardianPosture} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">
              {copy.headline}
            </h3>
            <StatusBadge
              label={PROTECTION_STATE_LABELS[deriveProtectionLifecycleState(guardianState)]}
              tone={isActive ? 'ready' : guardianState === 'authorized' ? 'info' : 'warning'}
              compact
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
            {copy.description}
          </p>
          {isActive && lastActivity && (
            <p
              className="text-[10px] font-semibold mt-1.5"
              style={{ color: archetype.accent }}
            >
              Last action {timeAgo(lastActivity.timestamp)}
            </p>
          )}
        </div>
      </div>
      {(onSetup || onDeposit || onViewActivity) && (
        <button
          type="button"
          onClick={handleCta}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-colors text-white"
          style={{
            background: archetype.accent,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {copy.cta}
        </button>
      )}
    </div>
  );
}

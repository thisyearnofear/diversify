/**
 * Guardian Tier State Machine
 *
 * Pure helper that derives the user-visible Guardian state from the
 * underlying vault, permission, and session data. Single source of truth
 * shared between `useSessionKey`, `useVault`, and the Agent Tier card.
 *
 * The four states, in escalation order:
 *
 *   idle        — no vault yet
 *   authorized  — vault exists (or permission signed) but not yet funded
 *   funded      — vault has deposits but no live permission
 *   monitoring  — vault is funded AND the permission is currently valid
 *
 * "Valid" means: status === 'active', expiresAt is in the future
 * (or never-expires with 0), and the daily cap has not been fully spent.
 *
 * The function is pure — no React, no DOM — so it is unit-testable in
 * isolation and can be reused by any surface (UI, server-side cron
 * status page, docs).
 */

import type { Vault, VaultPermission } from './vault.service';

export type GuardianTierState = 'idle' | 'authorized' | 'funded' | 'monitoring';

export const GUARDIAN_TIER_STATE_LABELS: Record<GuardianTierState, string> = {
    idle: 'Get Started',
    authorized: 'Awaiting Deposit',
    funded: 'Funded',
    monitoring: 'Protecting',
};

export interface DeriveGuardianTierStateInput {
    vault: Pick<Vault, 'totalDepositedUSD'> | null | undefined;
    permission: Pick<
        VaultPermission,
        'status' | 'expiresAt' | 'spentTodayUSD' | 'dailyLimitUSD'
    > | null | undefined;
    /**
     * Override "now" for tests. Defaults to `Math.floor(Date.now() / 1000)`.
     */
    nowSeconds?: number;
}

export function isPermissionValidNow(
    permission: Pick<VaultPermission, 'status' | 'expiresAt' | 'spentTodayUSD' | 'dailyLimitUSD'> | null | undefined,
    nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
    if (!permission) return false;
    if (permission.status !== 'active') return false;
    if (permission.expiresAt > 0 && permission.expiresAt < nowSeconds) return false;
    if (permission.spentTodayUSD >= permission.dailyLimitUSD) return false;
    return true;
}

export function deriveGuardianTierState(
    input: DeriveGuardianTierStateInput,
): GuardianTierState {
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    const hasVault = !!input.vault;
    const hasDeposit = hasVault && (input.vault?.totalDepositedUSD ?? 0) > 0;
    const hasLivePermission = isPermissionValidNow(input.permission, now);

    if (hasDeposit && hasLivePermission) return 'monitoring';
    if (hasDeposit) return 'funded';
    // "authorized" means the user has done *some* setup — signed a permission
    // OR created a vault — but has not yet deposited. We treat a signed
    // permission (even if not yet valid in the strict sense) as a signal
    // of intent, so an expired permission still surfaces as "authorized"
    // rather than "idle" once a vault exists.
    if (hasVault || !!input.permission) return 'authorized';
    return 'idle';
}

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

/** Collapsed user-facing state — setup vs actively protecting. */
export type GuardianUserFacingState = 'setup' | 'active';

export function collapseGuardianTierForUser(state: GuardianTierState): GuardianUserFacingState {
    return state === 'monitoring' ? 'active' : 'setup';
}

export const GUARDIAN_USER_FACING_LABELS: Record<GuardianUserFacingState, string> = {
    setup: 'Not protecting yet',
    active: 'Protection on',
};

export const GUARDIAN_TIER_STATE_LABELS: Record<GuardianTierState, string> = {
    idle: 'Not set up',
    authorized: 'Approved',
    funded: 'Funded',
    monitoring: 'Protecting',
};

export const GUARDIAN_USER_COPY: Record<GuardianTierState, {
    headline: string;
    description: string;
    cta: string;
    hint: string;
}> = {
    idle: {
        headline: 'Set up Auto-Saver',
        description: 'Pick a strategy and set your daily limit to get started.',
        cta: 'Set up Auto-Saver',
        hint: 'Pick a strategy, set your daily limit, and deposit stablecoins.',
    },
    authorized: {
        headline: 'Add funds',
        description: 'Auto-Saver is approved — deposit stablecoins to start protection.',
        cta: 'Deposit now',
        hint: 'Auto-Saver is approved. Send stablecoins to start.',
    },
    funded: {
        headline: 'Turn on protection',
        description: 'Your funds are ready. Turn on Auto-Saver to start protecting your savings.',
        cta: 'Turn on Auto-Saver',
        hint: 'Funds are ready. Turn on Auto-Saver to start protecting your savings.',
    },
    monitoring: {
        headline: 'Protection on',
        description: 'Auto-Saver is watching markets and protecting your savings within your limits.',
        cta: 'View activity',
        hint: 'Auto-Saver is working within the limits you set.',
    },
};

/** User-facing wallet connect prompts — no chain names. */
export const WALLET_CONNECT_COPY = {
    activatePlan: (planName: string) =>
        `Connect your wallet to activate your ${planName} protection plan.`,
    generic:
        'Connect your wallet to see how your savings hold up against inflation.',
    startProtecting: 'Connect your wallet to start protecting your savings.',
} as const;

export type ProtectionUserGoal =
    | 'inflation_protection'
    | 'geographic_diversification'
    | 'rwa_access'
    | 'exploring';

export interface GoalScoresSlice {
    hedge: number;
    diversify: number;
    rwa: number;
}

/** Plain-language hero tips for beginner mode — no chain or token jargon. */
export function getBeginnerPrimaryTip(
    userGoal: ProtectionUserGoal | null | undefined,
    scores: GoalScoresSlice,
    missingRegions: string[] = [],
): string | null {
    if (!userGoal || userGoal === 'exploring') return null;

    if (userGoal === 'inflation_protection') {
        if (scores.hedge < 60) {
            return `Protection score ${Math.round(scores.hedge)}% — consider moving to more stable holdings.`;
        }
        if (scores.hedge >= 80) {
            return `Strong protection (${Math.round(scores.hedge)}%). Gold-backed savings can add long-term coverage.`;
        }
        return `Good protection (${Math.round(scores.hedge)}%). Reducing concentrated exposure would help.`;
    }

    if (userGoal === 'geographic_diversification') {
        if (scores.diversify < 60) {
            const missing = missingRegions.slice(0, 2).join(' and ');
            return missing
                ? `Diversification ${Math.round(scores.diversify)}% — add ${missing} exposure.`
                : `Diversification ${Math.round(scores.diversify)}% — spread across more regions.`;
        }
        if (scores.diversify >= 80) {
            return `Excellent spread (${Math.round(scores.diversify)}%) across regions.`;
        }
        return `Good diversification (${Math.round(scores.diversify)}%). Keep rebalancing as markets move.`;
    }

    if (userGoal === 'rwa_access') {
        if (scores.rwa === 0) {
            return 'No real-world assets yet — consider gold-backed or treasury-style holdings.';
        }
        if (scores.rwa < 80) {
            return `Real-asset score ${Math.round(scores.rwa)}% — add gold or yield-bearing savings.`;
        }
        return `Strong real-asset position (${Math.round(scores.rwa)}%).`;
    }

    return null;
}

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

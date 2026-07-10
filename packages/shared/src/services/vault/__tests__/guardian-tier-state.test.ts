import { describe, it, expect } from 'vitest';
import {
    deriveGuardianTierState,
    isPermissionValidNow,
    GUARDIAN_TIER_STATE_LABELS,
    collapseGuardianTierForUser,
    type GuardianTierState,
} from '../guardian-tier-state';

const NOW = 1_700_000_000;

const ACTIVE_PERMISSION = {
    status: 'active' as const,
    expiresAt: NOW + 86400, // 1 day from now
    spentTodayUSD: 0,
    dailyLimitUSD: 10,
};

describe('isPermissionValidNow', () => {
    it('returns true for an active permission that is not expired and not capped', () => {
        expect(isPermissionValidNow(ACTIVE_PERMISSION, NOW)).toBe(true);
    });

    it('returns false for a revoked permission', () => {
        expect(
            isPermissionValidNow({ ...ACTIVE_PERMISSION, status: 'revoked' }, NOW),
        ).toBe(false);
    });

    it('returns false for an expired permission', () => {
        expect(
            isPermissionValidNow({ ...ACTIVE_PERMISSION, expiresAt: NOW - 1 }, NOW),
        ).toBe(false);
    });

    it('returns false when the daily cap has been fully spent', () => {
        expect(
            isPermissionValidNow({ ...ACTIVE_PERMISSION, spentTodayUSD: 10, dailyLimitUSD: 10 }, NOW),
        ).toBe(false);
    });

    it('returns false for null / undefined', () => {
        expect(isPermissionValidNow(null, NOW)).toBe(false);
        expect(isPermissionValidNow(undefined, NOW)).toBe(false);
    });

    it('treats expiresAt === 0 as never-expiring', () => {
        expect(isPermissionValidNow({ ...ACTIVE_PERMISSION, expiresAt: 0 }, NOW)).toBe(true);
    });
});

describe('collapseGuardianTierForUser', () => {
    it('collapses setup states to "setup"', () => {
        const setupStates: GuardianTierState[] = ['idle', 'authorized', 'funded'];
        for (const state of setupStates) {
            expect(collapseGuardianTierForUser(state)).toBe('setup');
        }
    });

    it('maps monitoring to "active"', () => {
        expect(collapseGuardianTierForUser('monitoring')).toBe('active');
    });
});

describe('deriveGuardianTierState', () => {
    it('returns "idle" with no vault and no permission', () => {
        expect(deriveGuardianTierState({ vault: null, permission: null, nowSeconds: NOW })).toBe('idle');
    });

    it('returns "authorized" when a vault exists but no deposit and no permission', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 0 },
                permission: null,
                nowSeconds: NOW,
            }),
        ).toBe('authorized');
    });

    it('returns "authorized" when a signed permission exists but no vault', () => {
        expect(
            deriveGuardianTierState({
                vault: null,
                permission: ACTIVE_PERMISSION,
                nowSeconds: NOW,
            }),
        ).toBe('authorized');
    });

    it('returns "funded" when the vault has deposits but the permission is missing', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 500 },
                permission: null,
                nowSeconds: NOW,
            }),
        ).toBe('funded');
    });

    it('returns "funded" when the vault has deposits but the permission has expired', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 500 },
                permission: { ...ACTIVE_PERMISSION, expiresAt: NOW - 1 },
                nowSeconds: NOW,
            }),
        ).toBe('funded');
    });

    it('returns "monitoring" when the vault is funded and the permission is live', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 500 },
                permission: ACTIVE_PERMISSION,
                nowSeconds: NOW,
            }),
        ).toBe('monitoring');
    });

    it('returns "monitoring" for a never-expiring permission (expiresAt === 0)', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 500 },
                permission: { ...ACTIVE_PERMISSION, expiresAt: 0 },
                nowSeconds: NOW,
            }),
        ).toBe('monitoring');
    });

    it('downgrades "monitoring" to "funded" once the daily cap is hit', () => {
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 500 },
                permission: { ...ACTIVE_PERMISSION, spentTodayUSD: 10, dailyLimitUSD: 10 },
                nowSeconds: NOW,
            }),
        ).toBe('funded');
    });

    it('treats a signed but not-yet-funded vault as "authorized", not "monitoring"', () => {
        // Edge case: user has signed the permission and created a vault, but
        // the deposit hasn't landed yet. The state should show "authorized"
        // (intent) rather than "monitoring" (live autonomy).
        expect(
            deriveGuardianTierState({
                vault: { totalDepositedUSD: 0 },
                permission: ACTIVE_PERMISSION,
                nowSeconds: NOW,
            }),
        ).toBe('authorized');
    });
});

describe('GUARDIAN_TIER_STATE_LABELS', () => {
    it('has a label for every state in the union', () => {
        const states: GuardianTierState[] = ['idle', 'authorized', 'funded', 'monitoring'];
        for (const s of states) {
            expect(GUARDIAN_TIER_STATE_LABELS[s]).toBeTruthy();
        }
    });
});

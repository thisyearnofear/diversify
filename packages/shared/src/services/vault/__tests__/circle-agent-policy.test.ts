import { describe, expect, it } from 'vitest';
import {
  sessionPermissionToCirclePolicy,
  policyMatchesPermission,
} from '../circle-agent-policy';
import type { SessionPermission } from '../../erc7715-service';

function permission(overrides: Partial<SessionPermission> = {}): SessionPermission {
  return {
    sessionKeyAddress: '0xsession',
    userAddress: '0xuser',
    spendingLimitUSD: 500,
    dailyLimitUSD: 100,
    allowedActions: [],
    allowedTokens: ['USDC', 'EURC', 'PAXG'],
    expiresAt: 1_800_000_000,
    autonomyLevel: 'balanced' as SessionPermission['autonomyLevel'],
    chainId: 42161,
    nonce: 'abc',
    ...overrides,
  };
}

describe('sessionPermissionToCirclePolicy', () => {
  it('maps daily + total limits to USDC spend rules', () => {
    const policy = sessionPermissionToCirclePolicy(permission());
    expect(policy.spendLimits).toEqual([
      { asset: 'USDC', amount: '100', window: 'day' },
      { asset: 'USDC', amount: '500', window: 'total' },
    ]);
  });

  it('omits the total rule when spendingLimitUSD is 0 (daily cap governs)', () => {
    const policy = sessionPermissionToCirclePolicy(permission({ spendingLimitUSD: 0 }));
    expect(policy.spendLimits).toEqual([{ asset: 'USDC', amount: '100', window: 'day' }]);
  });

  it('carries the token allowlist, expiry, and chain through', () => {
    const policy = sessionPermissionToCirclePolicy(permission());
    expect(policy.tokenAllowlist).toEqual(['USDC', 'EURC', 'PAXG']);
    expect(policy.expiresAt).toBe(1_800_000_000);
    expect(policy.chainId).toBe(42161);
  });

  it('always enables sanctions screening', () => {
    expect(sessionPermissionToCirclePolicy(permission()).sanctionsScreening).toBe(true);
  });

  it('rejects an empty token allowlist (would block everything silently)', () => {
    expect(() => sessionPermissionToCirclePolicy(permission({ allowedTokens: [] }))).toThrow(/allowed token/);
  });

  it('rejects negative limits', () => {
    expect(() => sessionPermissionToCirclePolicy(permission({ dailyLimitUSD: -1 }))).toThrow(/non-negative/);
  });
});

describe('policyMatchesPermission', () => {
  it('returns true for a freshly-derived policy', () => {
    const perm = permission();
    expect(policyMatchesPermission(sessionPermissionToCirclePolicy(perm), perm)).toBe(true);
  });

  it('detects drift when the permission daily limit changes', () => {
    const policy = sessionPermissionToCirclePolicy(permission());
    expect(policyMatchesPermission(policy, permission({ dailyLimitUSD: 250 }))).toBe(false);
  });

  it('detects drift when the token allowlist changes', () => {
    const policy = sessionPermissionToCirclePolicy(permission());
    expect(policyMatchesPermission(policy, permission({ allowedTokens: ['USDC'] }))).toBe(false);
  });
});

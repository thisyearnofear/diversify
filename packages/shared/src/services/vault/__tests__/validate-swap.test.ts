import { describe, expect, it } from 'vitest';
import {
  VaultService,
  usdDebitOfAmountIn,
  type VaultPermission,
  type RebalanceRecommendation,
} from '../vault.service';

/**
 * Regression tests for the allowlist OR-bypass fix in validateSwap.
 *
 * The old check accepted a swap when EITHER tokenIn OR tokenOut was in the
 * allowlist. Because tokenIn is always the funding token (cUSD) and cUSD is
 * effectively always allowed, the OR let the agent acquire ANY destination
 * token regardless of the user's permission. The fix requires the DESTINATION
 * (tokenOut) to be explicitly allowed, with '*' as an opt-in wildcard.
 *
 * validateSwap is private but pure with respect to its arguments, so we bind
 * it off the prototype without running the constructor (mirrors the pattern in
 * guardian-recommendation.test.ts).
 */
function callValidateSwap(
  permission: VaultPermission,
  rec: RebalanceRecommendation,
): { allowed: boolean; reason?: string } {
  const svc = Object.create(VaultService.prototype) as any;
  return svc.validateSwap(permission, rec);
}

const basePermission = (overrides: Partial<VaultPermission> = {}): VaultPermission => ({
  _id: 'perm1',
  vaultId: 'vault1',
  userAddress: '0xuser',
  sessionKeyAddress: '0xsession',
  spendingLimitUSD: 1000,
  dailyLimitUSD: 100,
  allowedActions: ['swap'],
  allowedTokens: ['cEUR'],
  expiresAt: 0,
  autonomyLevel: 'GUARDIAN',
  chainId: 42220,
  nonce: '1',
  signature: '0xsig',
  spentTodayUSD: 0,
  spentDate: new Date().toISOString().slice(0, 10),
  totalSpentUSD: 0,
  firstAutoExecutionConfirmed: true,
  status: 'active',
  ...overrides,
});

const swap = (overrides: Partial<RebalanceRecommendation> = {}): RebalanceRecommendation => ({
  action: 'swap',
  urgency: 'high',
  tokenIn: 'cUSD',
  tokenInAddress: '0xcusd',
  tokenOut: 'cEUR',
  tokenOutAddress: '0xceur',
  amountIn: '10000000000000000000',
  reason: 'test',
  estimatedAmountUSD: 10,
  ...overrides,
});

describe('validateSwap allowlist', () => {
  it('allows a swap whose destination token is in the allowlist', () => {
    const result = callValidateSwap(basePermission({ allowedTokens: ['cEUR'] }), swap({ tokenOut: 'cEUR' }));
    expect(result.allowed).toBe(true);
  });

  it('BLOCKS a destination token not in the allowlist even though tokenIn (cUSD) is the funding token', () => {
    // The core bypass: cUSD funding source must NOT grant access to an
    // un-allowed destination like cREAL.
    const result = callValidateSwap(basePermission({ allowedTokens: ['cEUR'] }), swap({ tokenOut: 'cREAL' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not in allowed list/i);
  });

  it('does not let cUSD in the allowlist authorize an arbitrary destination', () => {
    // Even if cUSD is explicitly allowed, that should not authorize acquiring cREAL.
    const result = callValidateSwap(basePermission({ allowedTokens: ['cUSD'] }), swap({ tokenOut: 'cREAL' }));
    expect(result.allowed).toBe(false);
  });

  it('honors a "*" wildcard as opt-in to any destination token', () => {
    const result = callValidateSwap(basePermission({ allowedTokens: ['*'] }), swap({ tokenOut: 'KESm' }));
    expect(result.allowed).toBe(true);
  });

  it('matches the allowlist case-insensitively', () => {
    const result = callValidateSwap(basePermission({ allowedTokens: ['ceur'] }), swap({ tokenOut: 'cEUR' }));
    expect(result.allowed).toBe(true);
  });

  it('blocks when the action is not permitted', () => {
    const result = callValidateSwap(
      basePermission({ allowedActions: ['deposit'] }),
      swap({ tokenOut: 'cEUR' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not in allowed actions/i);
  });

  it('blocks when the daily limit would be exceeded', () => {
    const result = callValidateSwap(
      basePermission({ allowedTokens: ['cEUR'], dailyLimitUSD: 100, spentTodayUSD: 95 }),
      swap({ tokenOut: 'cEUR', estimatedAmountUSD: 10 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/daily limit/i);
  });

  it('blocks when the total spending limit would be exceeded', () => {
    const result = callValidateSwap(
      basePermission({ allowedTokens: ['cEUR'], spendingLimitUSD: 100, totalSpentUSD: 95 }),
      swap({ tokenOut: 'cEUR', estimatedAmountUSD: 10 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/total spending limit/i);
  });

  it('BLOCKS a swap whose real debit (amountIn) exceeds the daily limit even when the estimate understates it', () => {
    // The cap protects how much the Guardian can MOVE — amountIn is what
    // leaves the wallet. A $10 estimate paired with a $50 amountIn must not
    // pass the $5 remaining daily budget.
    const result = callValidateSwap(
      basePermission({ allowedTokens: ['cEUR'], dailyLimitUSD: 100, spentTodayUSD: 95 }),
      swap({
        tokenOut: 'cEUR',
        estimatedAmountUSD: 10,
        amountIn: '50000000000000000000', // 50 cUSD at 18 dp
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/daily limit/i);
    expect(result.reason).toContain('$50.00');
  });

  it('enforces the total limit on the real debit, not the estimate', () => {
    const result = callValidateSwap(
      basePermission({ allowedTokens: ['cEUR'], spendingLimitUSD: 100, totalSpentUSD: 95 }),
      swap({
        tokenOut: 'cEUR',
        estimatedAmountUSD: 10, // claims 95 + 10 = 105 — actually a lie
        amountIn: '20000000000000000000', // real debit is 20 → 95 + 20 = 115
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/total spending limit/i);
  });

  it('still allows a swap whose real debit fits the remaining daily budget', () => {
    const result = callValidateSwap(
      basePermission({ allowedTokens: ['cEUR'], dailyLimitUSD: 100, spentTodayUSD: 85 }),
      swap({
        tokenOut: 'cEUR',
        estimatedAmountUSD: 20, // overstated display estimate
        amountIn: '10000000000000000000', // actual debit is 10 → 85 + 10 ≤ 100
      }),
    );
    expect(result.allowed).toBe(true);
  });
});

describe('usdDebitOfAmountIn', () => {
  it('converts 18-dp cUSD wei to dollars', () => {
    expect(usdDebitOfAmountIn('cUSD', undefined, '10000000000000000000')).toBe(10);
  });

  it('treats USDC/USDT as 6-dp tokens', () => {
    expect(usdDebitOfAmountIn('USDC', undefined, '1000000')).toBe(1);
    expect(usdDebitOfAmountIn('USDT', undefined, '5000000')).toBe(5);
  });

  it('defaults unknown funding symbols to 18 decimals', () => {
    expect(usdDebitOfAmountIn('FOO', undefined, '3000000000000000000')).toBe(3);
  });

  it('returns null for a missing or zero amount', () => {
    expect(usdDebitOfAmountIn('cUSD', undefined, undefined)).toBeNull();
    expect(usdDebitOfAmountIn('cUSD', undefined, '0')).toBeNull();
    expect(usdDebitOfAmountIn('cUSD', undefined, 'not-a-number')).toBeNull();
  });
});

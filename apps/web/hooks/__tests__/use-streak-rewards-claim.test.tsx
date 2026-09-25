/**
 * claimG / verifyIdentity contract: no silent celebrations, no
 * post-await window.open fallbacks (popup-blocked), no fabricated
 * success when there is no wallet provider.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

const mockGetWalletProvider = vi.fn();
const mockClaimUBI = vi.fn();
const mockGetFVLink = vi.fn();
const hoist = vi.hoisted(() => ({ streakData: undefined as unknown }));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0x1111111111111111111111111111111111111111', isConnected: true }),
}));

vi.mock('@diversifi/shared/src/modules/wallet/core/provider-registry', () => ({
  getWalletProvider: (...args: unknown[]) => mockGetWalletProvider(...args),
  isFarcasterProvider: () => false,
}));

vi.mock('@diversifi/shared/src/services/gooddollar-service', () => ({
  GoodDollarService: {
    createReadOnly: () => ({ checkClaimEligibility: vi.fn().mockResolvedValue({ canClaim: true, claimAmount: '0.5' }) }),
    fromWeb3Provider: vi.fn(async () => ({
      claimUBI: mockClaimUBI,
      getFaceVerificationLink: mockGetFVLink,
    })),
  },
}));

vi.mock('@diversifi/shared/src/modules/rewards/streak/internal/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@diversifi/shared/src/modules/rewards/streak/internal/api')>();
  return {
    ...actual,
    fetchStreakFromApi: vi.fn().mockImplementation(async () => ({
      streak: hoist.streakData === undefined ? {
        walletAddress: '0x1111111111111111111111111111111111111111',
        startTime: Date.now() - 2 * 86400_000,
        lastActivity: Date.now(),
        daysActive: 2,
        gracePeriodsUsed: 0,
        totalSaved: 0,
      } : hoist.streakData,
      raw: {},
    })),
  };
});

vi.mock('@diversifi/shared/src/modules/rewards/streak/internal/onchain', () => ({
  fetchOnChainStatus: vi.fn().mockResolvedValue({
    isWhitelisted: true,
    entitlement: '0.5',
    alreadyClaimedOnChain: false,
    canClaimOnChain: true,
  }),
}));

import { StreakRewardsProvider, useStreakRewards } from '../use-streak-rewards';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StreakRewardsProvider, null, children);
}

async function mounted() {
  const utils = renderHook(() => useStreakRewards(), { wrapper });
  await waitFor(() => expect(utils.result.current.canClaim).toBe(true));
  return utils;
}

describe('useStreakRewards — claimG/verifyIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoist.streakData = undefined;
    mockGetWalletProvider.mockResolvedValue({ request: vi.fn() });
    mockClaimUBI.mockResolvedValue({ success: true, txHash: '0xabc' });
    mockGetFVLink.mockResolvedValue('https://fv.example/link');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('claimG fails honestly when there is no wallet provider (no window.open)', async () => {
    mockGetWalletProvider.mockResolvedValue(null);
    const openSpy = vi.fn();
    window.open = openSpy;
    const { result } = await mounted();
    let out: { success: boolean; error?: string } | undefined;
    await act(async () => {
      out = await result.current.claimG();
    });
    expect(out?.success).toBe(false);
    expect(out?.error).toContain('Connect a wallet');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('claimG never falls back to window.open on failure', async () => {
    mockClaimUBI.mockResolvedValue({ success: false, error: 'Verify once with GoodDollar to claim.' });
    const openSpy = vi.fn();
    window.open = openSpy;
    const { result } = await mounted();
    let out: { success: boolean; error?: string } | undefined;
    await act(async () => {
      out = await result.current.claimG();
    });
    expect(out?.success).toBe(false);
    expect(out?.error).toContain('Verify once');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('canClaim is true for a verified entitled wallet with zero streak', async () => {
    // The $1+ swap gate is gone: claiming needs only GoodDollar
    // verification + on-chain entitlement — the streak builds separately.
    hoist.streakData = null;
    const { result } = await mounted();
    expect(result.current.canClaim).toBe(true);
    expect(result.current.isEligible).toBe(false); // no streak, still claimable
  });

  it('verifyIdentity errors when the popup is missing (desktop)', async () => {
    const { result } = await mounted();
    let out: { success: boolean; error?: string } | undefined;
    await act(async () => {
      out = await result.current.verifyIdentity(null);
    });
    expect(out?.success).toBe(false);
    expect(out?.error).toContain('Pop-up blocked');
  });

  it('verifyIdentity routes the generated link into the caller-supplied popup', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
    const { result } = await mounted();
    let out: { success: boolean; url?: string } | undefined;
    await act(async () => {
      out = await result.current.verifyIdentity(popup);
    });
    expect(out?.success).toBe(true);
    expect(mockGetFVLink).toHaveBeenCalledWith(expect.any(String), true);
    expect(popup.location.href).toBe('https://fv.example/link');
  });
});

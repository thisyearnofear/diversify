/**
 * useClaimFlow — pins the error surfaces that used to be silent:
 *   - claim failure toasts (header-pill claims have no inline error area)
 *   - verify failure returns to 'idle', toasts, and closes the blank popup
 *   - the FV popup is opened synchronously in handleVerify (popup-blocker safe)
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

const mockClaimG = vi.fn();
const mockVerifyIdentity = vi.fn();
const mockShowToast = vi.fn();
const streakState = { canClaim: true, isWhitelisted: true };

vi.mock('../use-streak-rewards', () => ({
  useStreakRewards: () => ({
    canClaim: streakState.canClaim,
    isWhitelisted: streakState.isWhitelisted,
    estimatedReward: '0.25 G$',
    streak: { daysActive: 3 },
    claimG: mockClaimG,
    verifyIdentity: mockVerifyIdentity,
    refresh: vi.fn(),
    recordActivity: vi.fn(),
    recordSwap: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ chainId: 42220 }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/components/rewards/ClaimCelebration', () => ({
  default: () => React.createElement('div', { 'data-testid': 'celebration' }),
}));

import { useClaimFlow } from '../use-claim-flow';

describe('useClaimFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streakState.canClaim = true;
    streakState.isWhitelisted = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('toasts the error when a claim fails', async () => {
    mockClaimG.mockResolvedValue({ success: false, error: 'Already claimed — next claim tomorrow.' });
    const { result } = renderHook(() => useClaimFlow());
    await act(async () => {
      await result.current.handleClaim();
    });
    expect(result.current.claimStatus).toBe('error');
    expect(result.current.claimError).toBe('Already claimed — next claim tomorrow.');
    expect(mockShowToast).toHaveBeenCalledWith('Already claimed — next claim tomorrow.', 'error');
    act(() => {
      vi.advanceTimersByTime(6_500);
    });
    expect(result.current.claimStatus).toBe('idle');
  });

  it('opens the FV popup synchronously and moves to awaiting on success', async () => {
    // isWhitelisted false → the awaiting state persists until the
    // post-FV recheck flips it.
    streakState.isWhitelisted = false;
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };
    const openSpy = vi.fn().mockReturnValue(popup);
    vi.stubGlobal('open', openSpy);
    window.open = openSpy;
    mockVerifyIdentity.mockResolvedValue({ success: true, url: 'https://fv.example/link' });

    const { result } = renderHook(() => useClaimFlow());
    await act(async () => {
      await result.current.handleVerify();
    });
    expect(openSpy).toHaveBeenCalledWith('', 'faceVerification', expect.stringContaining('width='));
    expect(mockVerifyIdentity).toHaveBeenCalledWith(popup);
    expect(result.current.verifyStatus).toBe('awaiting');
  });

  it('returns to idle, toasts, and closes the blank popup when verify fails', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };
    const openSpy = vi.fn().mockReturnValue(popup);
    window.open = openSpy;
    mockVerifyIdentity.mockResolvedValue({ success: false, error: 'Pop-up blocked — allow pop-ups to verify.' });

    const { result } = renderHook(() => useClaimFlow());
    await act(async () => {
      await result.current.handleVerify();
    });
    expect(result.current.verifyStatus).toBe('idle');
    expect(popup.close).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Pop-up blocked — allow pop-ups to verify.', 'error');
  });
});

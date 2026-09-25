/**
 * ClaimRail — the persistent daily-G$ line in Home's status tier.
 *
 * Pins the state machine: claimable is the only state that earns the
 * emerald accent; verify and unlock states carry their next action;
 * claimed is quiet confirmation; loading and outside-providers render
 * nothing. The dismiss mechanic is gone — a claimable state can never
 * be hidden behind localStorage.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ClaimRail } from '../ClaimRail';

const mockHandleClaim = vi.fn();
const mockHandleVerify = vi.fn();

let streakState: Record<string, unknown> = {};
let flowState: Record<string, unknown> = {};

vi.mock('@/hooks/use-streak-rewards', () => ({
  useStreakRewards: () => streakState,
}));

vi.mock('@/hooks/claim-flow-context', () => ({
  useClaimFlowContext: () => flowState,
}));

afterEach(() => {
  cleanup();
  streakState = {};
  flowState = {};
  vi.clearAllMocks();
});

const baseFlow = {
  claimStatus: 'idle',
  claimError: null,
  verifyStatus: 'idle',
  handleClaim: mockHandleClaim,
  handleVerify: mockHandleVerify,
};

describe('ClaimRail', () => {
  it('shows the claimable line and calls the shared claim flow', () => {
    streakState = { canClaim: true, isEligible: true, isWhitelisted: true, estimatedReward: '1.23 G$', isLoading: false };
    flowState = { ...baseFlow };
    render(<ClaimRail />);
    const rail = screen.getByTestId('claim-rail');
    expect(rail).toHaveTextContent('Claim Daily G$');
    expect(rail).toHaveTextContent('1.23 G$');
    fireEvent.click(rail);
    expect(mockHandleClaim).toHaveBeenCalledTimes(1);
  });

  it('shows "Claiming…" while the shared flow is in flight', () => {
    streakState = { canClaim: true, isEligible: true, isWhitelisted: true, isLoading: false };
    flowState = { ...baseFlow, claimStatus: 'claiming' };
    render(<ClaimRail />);
    expect(screen.getByTestId('claim-rail')).toHaveTextContent('Claiming your daily G$');
  });

  it('surfaces the claim error inline', () => {
    streakState = { canClaim: true, isEligible: true, isWhitelisted: true, isLoading: false };
    flowState = { ...baseFlow, claimStatus: 'error', claimError: 'Claim failed. Please try again.' };
    render(<ClaimRail />);
    const rail = screen.getByTestId('claim-rail');
    expect(rail).toHaveTextContent('Claim failed. Please try again.');
    // The auto-open is popup-blocked post-await — the escape hatch is a
    // real user-gesture link to the GoodDollar wallet.
    const link = rail.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', expect.stringContaining('wallet.gooddollar.org'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('offers one-time verification to any unverified wallet — no streak needed', () => {
    streakState = { canClaim: false, isEligible: false, isWhitelisted: false, isLoading: false };
    flowState = { ...baseFlow };
    render(<ClaimRail />);
    const rail = screen.getByTestId('claim-rail');
    expect(rail).toHaveTextContent('Verify once to unlock daily G$');
    fireEvent.click(rail);
    expect(mockHandleVerify).toHaveBeenCalledTimes(1);
  });

  it('shows the awaiting state while verification is open', () => {
    streakState = { canClaim: false, isEligible: true, isWhitelisted: false, isLoading: false };
    flowState = { ...baseFlow, verifyStatus: 'awaiting' };
    render(<ClaimRail />);
    expect(screen.getByTestId('claim-rail')).toHaveTextContent('Verification in progress');
  });

  it('confirms quietly when the chain says today is claimed', () => {
    streakState = { canClaim: false, isEligible: true, isWhitelisted: true, alreadyClaimedOnChain: true, isLoading: false };
    flowState = { ...baseFlow };
    render(<ClaimRail />);
    const rail = screen.getByTestId('claim-rail');
    expect(rail).toHaveTextContent('claimed');
    expect(rail.tagName).toBe('P'); // no action — nothing to do
  });

  it('shows a claimable verified wallet even with zero streak', () => {
    // The $1+ swap gate is gone — claiming needs only verification + entitlement.
    streakState = { canClaim: true, isEligible: false, isWhitelisted: true, alreadyClaimedOnChain: false, estimatedReward: '0.31 G$', isLoading: false };
    flowState = { ...baseFlow };
    render(<ClaimRail />);
    const rail = screen.getByTestId('claim-rail');
    expect(rail).toHaveTextContent('Claim Daily G$');
    fireEvent.click(rail);
    expect(mockHandleClaim).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a verified wallet with no streak and nothing claimable', () => {
    streakState = { canClaim: false, isEligible: false, isWhitelisted: true, alreadyClaimedOnChain: false, isLoading: false };
    flowState = { ...baseFlow };
    render(<ClaimRail />);
    expect(screen.queryByTestId('claim-rail')).toBeNull();
  });

  it('renders nothing while loading or in an unexplained state', () => {
    streakState = { isLoading: true };
    flowState = { ...baseFlow };
    const { container, unmount } = render(<ClaimRail />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    // Eligible + whitelisted + can't claim + not claimed — contract edge.
    streakState = { canClaim: false, isEligible: true, isWhitelisted: true, alreadyClaimedOnChain: false, isLoading: false };
    const { container: edge } = render(<ClaimRail />);
    expect(edge).toBeEmptyDOMElement();
  });
});

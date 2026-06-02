/**
 * useClaimFlow - Direct-claim state machine for GoodDollar $G.
 *
 * Extracted from <StreakRewardsCard> so the same claim/verify/celebrate
 * lifecycle is shared by:
 *   - <StreakRewardsCard>     (main card on the home tab)
 *   - <ProtectionTab>         (claim CTA from the protection dashboard)
 *   - <SwapTab>               (post-swap claim suggestion)
 *   - <AIChat>                (agent-triggered claim action)
 *
 * Each consumer:
 *   1. Calls useClaimFlow() to get the state and handlers
 *   2. Renders its own claim/verify CTA using the state
 *   3. Renders <ClaimFlowOverlay flow={flow} /> somewhere in the tree
 *
 * The celebration overlay is portal-rendered, so it can be placed anywhere
 * in the JSX (e.g. alongside the trigger button) and still overlay correctly.
 */

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStreakRewards } from './use-streak-rewards';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { NETWORKS } from '@/config';

// Lazy-load the celebration so consumers that don't reach success never
// pay the bundle cost.
const ClaimCelebration = dynamic(() => import('@/components/rewards/ClaimCelebration'), {
  ssr: false,
});

export type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';
export type VerifyStatus = 'idle' | 'opening' | 'awaiting';

export interface ClaimFlow {
  /** Current state of the claim lifecycle. */
  claimStatus: ClaimStatus;
  /** Last error message, cleared on next claim or after 6s. */
  claimError: string | null;
  /** Set when claimStatus === 'success'. Drives the celebration overlay. */
  lastClaim: { txHash?: string; amount: string } | null;
  /** Current state of the FV redirect lifecycle. */
  verifyStatus: VerifyStatus;
  /** True when the user can claim right now. */
  canClaim: boolean;
  /** True when the user is verified (whitelisted) on the GoodDollar protocol. */
  isWhitelisted: boolean;
  /** Estimated reward string (e.g. "1.23 G$"). */
  estimatedReward: string;
  /** True when the underlying streak state is loading. */
  isLoading: boolean;
  /** Current streak length in days, for the celebration copy. */
  streakDays: number;
  /** Initiate a direct claim. Idempotent if already claiming. */
  handleClaim: () => Promise<void>;
  /** Open the Face Verification flow. */
  handleVerify: () => Promise<void>;
  /** Close the celebration overlay and reset to idle. */
  handleClaimSuccessClose: () => void;
}

export interface UseClaimFlowOptions {
  /** Called after a successful on-chain claim. Use for side effects like
   *  awarding XP, refreshing stats, or closing the surrounding drawer. */
  onClaimSuccess?: () => void;
}

export function useClaimFlow(options: UseClaimFlowOptions = {}): ClaimFlow {
  const { onClaimSuccess } = options;
  const { chainId } = useWalletContext();
  const {
    canClaim,
    isWhitelisted,
    estimatedReward,
    streak,
    claimG,
    verifyIdentity,
    refresh,
    recordActivity,
    isLoading,
  } = useStreakRewards();

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [lastClaim, setLastClaim] = useState<{ txHash?: string; amount: string } | null>(null);

  const handleVerify = useCallback(async () => {
    setVerifyStatus('opening');
    try {
      await verifyIdentity();
    } catch {
      setVerifyStatus('idle');
      return;
    }
    // Move to awaiting state. We re-check verification on tab focus and
    // every 30s; the user gets a manual "Check now" affordance too.
    setVerifyStatus('awaiting');
  }, [verifyIdentity]);

  // Re-check verification when the user returns to the tab (FV popup closes)
  // and on a 30s poll while we're awaiting approval. Stops automatically
  // once isWhitelisted becomes true.
  useEffect(() => {
    if (verifyStatus !== 'awaiting') return;
    if (isWhitelisted) {
      setVerifyStatus('idle');
      return;
    }
    let cancelled = false;
    const recheck = () => {
      if (cancelled) return;
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(recheck, 30_000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [verifyStatus, isWhitelisted, refresh]);

  // Direct claim — no intermediate modal. Sets inline state and shows the
  // celebration overlay on success.
  const handleClaim = useCallback(async () => {
    if (!canClaim || claimStatus === 'claiming') return;
    setClaimStatus('claiming');
    setClaimError(null);
    try {
      const result = await claimG();
      if (result.success) {
        setLastClaim({
          txHash: result.txHash,
          amount: result.amount && result.amount !== '0' ? `${result.amount} G$` : estimatedReward,
        });
        setClaimStatus('success');
        // Log the claim to the user's cross-chain activity
        if (chainId) {
          await recordActivity({
            action: 'claim',
            chainId,
            networkType: NETWORKS.CELO_MAINNET.chainId === chainId ? 'mainnet' : 'testnet',
            txHash: result.txHash,
            usdValue: parseFloat(estimatedReward.replace(/[^0-9.]/g, '')) || 0,
          });
        }
        onClaimSuccess?.();
      } else {
        setClaimError(result.error || 'Claim failed. Please try again.');
        setClaimStatus('error');
        setTimeout(() => {
          setClaimStatus((s) => (s === 'error' ? 'idle' : s));
          setClaimError(null);
        }, 6_000);
      }
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Unexpected error');
      setClaimStatus('error');
      setTimeout(() => {
        setClaimStatus((s) => (s === 'error' ? 'idle' : s));
        setClaimError(null);
      }, 6_000);
    }
  }, [canClaim, claimStatus, claimG, estimatedReward, recordActivity, chainId, onClaimSuccess]);

  const handleClaimSuccessClose = useCallback(() => {
    setClaimStatus('idle');
    setLastClaim(null);
  }, []);

  return {
    claimStatus,
    claimError,
    lastClaim,
    verifyStatus,
    canClaim,
    isWhitelisted,
    estimatedReward,
    isLoading,
    streakDays: streak?.daysActive || 0,
    handleClaim,
    handleVerify,
    handleClaimSuccessClose,
  };
}

/**
 * <ClaimFlowOverlay flow={flow} /> — renders the success celebration when
 * the flow's claimStatus transitions to 'success'. Mount it once in the
 * consumer's JSX; it self-renders only when there's something to show.
 */
export function ClaimFlowOverlay({ flow }: { flow: ClaimFlow }) {
  if (flow.claimStatus !== 'success' || !flow.lastClaim) return null;
  return (
    <ClaimCelebration
      amount={flow.lastClaim.amount}
      txHash={flow.lastClaim.txHash}
      streakDays={flow.streakDays}
      onClose={flow.handleClaimSuccessClose}
    />
  );
}

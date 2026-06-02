/**
 * useStreakRewards - GoodDollar $G streak tracking with MongoDB persistence
 *
 * Single source of truth via React context. The provider is mounted once
 * (in components/app/ProviderTree) so 11+ components share one state slice,
 * one polling timer, and one set of contract reads instead of each spinning
 * up its own.
 *
 * Use `useStreakRewards()` from any component — it reads the shared context.
 *
 * Unlock Criteria: Any swap of $1+ unlocks daily G$ claim
 *
 * Core Principles:
 * - DRY: Centralized streak logic
 * - MODULAR: Works with or without backend
 * - RESILIENT: Falls back to localStorage if API fails
 * - NEUTRAL: No judgment on swap strategy
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWalletContext } from '../components/wallet/WalletProvider';

import type { StreakActions, StreakData, StreakState } from '../modules/rewards/streak/types';
import { STREAK_CONFIG } from '../modules/rewards/streak/types';
import {
  calculateStreakState,
  clearLocalStreak,
  getLocalStreak,
  safeParseJson,
  saveLocalStreak,
} from '../modules/rewards/streak/utils';
import { diffAchievements } from '../modules/rewards/streak/achievements';
import { fetchStreakFromApi } from '../modules/rewards/streak/internal/api';
import { fetchOnChainStatus } from '../modules/rewards/streak/internal/onchain';
import {
  computeEligibleForGraduation,
  patchActivity,
  type RecordActivityParams,
} from '../modules/rewards/streak/internal/activity';
import { computeNextLocalStreak } from '../modules/rewards/streak/internal/local-fallback';

const INITIAL_STATE: StreakState = {
  streak: null,
  canClaim: false,
  isEligible: false,
  isWhitelisted: true,
  entitlement: '0',
  alreadyClaimedOnChain: false,
  nextClaimTime: null,
  estimatedReward: '~$0.25',
  isLoading: false,
  error: null,
  usingFallback: false,
  crossChainActivity: {
    testnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0, chainsUsed: [], totalSimulations: 0, simulatedAlpha: 0 },
    mainnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0 },
    graduation: { isGraduated: false, testnetActionsBeforeGraduation: 0 },
  },
  achievements: [],
  newlyEarnedAchievements: [],
  eligibleForGraduation: false,
};

const StreakRewardsContext = createContext<(StreakState & StreakActions) | null>(null);

export function StreakRewardsProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useWalletContext();
  const [state, setState] = useState<StreakState>(INITIAL_STATE);

  // Fetch streak from API or fallback to localStorage.
  // Memoized on (address, isConnected) so the polling effect re-subscribes
  // only when the wallet identity changes.
  const refresh = useCallback(async () => {
    if (!address || !isConnected) {
      setState((prev) => ({ ...prev, ...calculateStreakState(null), isLoading: false, error: null }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const onChainStatus = await fetchOnChainStatus(address);

      let realEntitlement = '~$0.25';
      try {
        const { GoodDollarService } = await import('@diversifi/shared');
        const service = GoodDollarService.createReadOnly();
        const eligibility = await service.checkClaimEligibility(address);
        if (eligibility.claimAmount && parseFloat(eligibility.claimAmount) > 0) {
          realEntitlement = `${parseFloat(eligibility.claimAmount).toFixed(2)} G$`;
        }
      } catch (err) {
        console.warn('[StreakRewards] Could not fetch real entitlement:', err);
      }

      const { streak, raw } = await fetchStreakFromApi(address);
      const streakState = calculateStreakState(streak);

      const testnetSwaps = raw.crossChainActivity?.testnet?.totalSwaps || 0;
      const isGraduated = raw.crossChainActivity?.graduation?.isGraduated || false;
      const eligibleForGraduation = !isGraduated && testnetSwaps >= 3;

      setState((prev) => {
        const nextAchievements = raw.achievements || [];
        const { newlyEarned } = diffAchievements(prev.achievements, nextAchievements);

        return {
          ...prev,
          ...streakState,
          ...onChainStatus,
          estimatedReward: realEntitlement,
          crossChainActivity: raw.crossChainActivity || prev.crossChainActivity,
          achievements: nextAchievements,
          newlyEarnedAchievements: newlyEarned,
          eligibleForGraduation,
          canClaim: (streakState.canClaim || false) && onChainStatus.canClaimOnChain,
          isLoading: false,
          error: null,
          usingFallback: false,
        };
      });

      if (streak) {
        saveLocalStreak(address, streak);
      }
    } catch (err) {
      console.warn('[StreakRewards] API failed, using localStorage fallback:', err);
      const localStreak = getLocalStreak(address);
      setState((prev) => ({
        ...prev,
        ...calculateStreakState(localStreak),
        isLoading: false,
        error: 'Using offline mode',
        usingFallback: true,
      }));
    }
  }, [address, isConnected]);

  // Single poll timer + focus listener, regardless of how many components
  // subscribe to the context.
  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    const handleFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  const recordSwap = useCallback(
    async (amountUSD: number) => {
      if (!address) throw new Error('Wallet not connected');
      if (amountUSD < STREAK_CONFIG.MIN_SWAP_USD) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/streaks/${address}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountUSD }),
        });

        if (response.ok) {
          const data = (await safeParseJson(response)) || {};
          const streak: StreakData = {
            walletAddress: address,
            startTime: data.startTime,
            lastActivity: data.lastActivity,
            daysActive: data.daysActive,
            gracePeriodsUsed: data.gracePeriodsUsed,
            totalSaved: data.totalSaved,
          };
          setState((prev) => ({
            ...prev,
            ...calculateStreakState(streak),
            isLoading: false,
            error: null,
            usingFallback: false,
          }));
          saveLocalStreak(address, streak);
        } else {
          throw new Error('API request failed');
        }
      } catch (err) {
        console.warn('[StreakRewards] API save failed, using localStorage:', err);
        const current = getLocalStreak(address);
        const newStreak = computeNextLocalStreak({
          address,
          amountUSD,
          current,
          gracePeriodsPerWeek: STREAK_CONFIG.GRACE_PERIODS_PER_WEEK,
        });
        saveLocalStreak(address, newStreak);
        setState((prev) => ({
          ...prev,
          ...calculateStreakState(newStreak),
          isLoading: false,
          error: 'Saved locally (sync when online)',
          usingFallback: true,
        }));
      }
    },
    [address],
  );

  const claimG = useCallback(async (): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> => {
    if (!state.canClaim) {
      return { success: false, error: 'Not eligible to claim yet' };
    }
    try {
      const [{ GoodDollarService, getWalletProvider }] = await Promise.all([
        import('@diversifi/shared'),
      ]);
      const walletProvider = await getWalletProvider();
      if (!walletProvider) {
        window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
        return { success: true, error: 'Opened external claim page' };
      }
      const service = await GoodDollarService.fromWeb3Provider(walletProvider);
      const result = await service.claimUBI();
      if (result.success) {
        console.log('[StreakRewards] UBI claimed successfully:', result);
      } else {
        console.warn('[StreakRewards] Claim failed, opening external page');
        window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
      }
      return result;
    } catch (error) {
      console.error('[StreakRewards] Error claiming UBI:', error);
      window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
      return { success: false, error: 'Opened external claim page as fallback' };
    }
  }, [state.canClaim]);

  const verifyIdentity = useCallback(async (): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!address) return { success: false, error: 'Wallet not connected' };
    try {
      const [{ GoodDollarService, getWalletProvider }] = await Promise.all([
        import('@diversifi/shared'),
      ]);
      const walletProvider = await getWalletProvider();
      if (!walletProvider) {
        return { success: false, error: 'No wallet provider found. Please connect your wallet.' };
      }
      const service = await GoodDollarService.fromWeb3Provider(walletProvider);
      const callbackUrl = window.location.href;
      const url = await service.getFaceVerificationLink('DiversiFi User', callbackUrl);
      window.open(url, '_blank');
      return { success: true, url };
    } catch (error) {
      console.error('[StreakRewards] Error generating FV link:', error);
      return { success: false, error: 'Failed to start verification flow' };
    }
  }, [address]);

  const resetStreak = useCallback(async () => {
    if (!address) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await fetch(`/api/streaks/${address}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[StreakRewards] API reset failed:', err);
    }
    clearLocalStreak(address);
    setState((prev) => ({ ...prev, ...calculateStreakState(null), isLoading: false }));
  }, [address]);

  const recordActivity = useCallback(
    async (params: {
      action: 'swap' | 'claim' | 'graduation' | 'simulation';
      chainId: number;
      networkType: 'testnet' | 'mainnet';
      usdValue?: number;
      txHash?: string;
      simulatedAlpha?: number;
    }): Promise<boolean> => {
      if (!address) return false;
      try {
        const data = await patchActivity(address, params as RecordActivityParams);
        const eligibleForGraduation = computeEligibleForGraduation(data.crossChainActivity);
        setState((prev) => {
          const nextAchievements = data.achievements || prev.achievements;
          const { newlyEarned } = diffAchievements(prev.achievements, nextAchievements);
          return {
            ...prev,
            crossChainActivity: data.crossChainActivity || prev.crossChainActivity,
            achievements: nextAchievements,
            newlyEarnedAchievements: newlyEarned,
            eligibleForGraduation,
          };
        });
        return true;
      } catch (err) {
        console.warn('[StreakRewards] Activity recording failed:', err);
        return false;
      }
    },
    [address],
  );

  const value = useMemo<StreakState & StreakActions>(
    () => ({
      ...state,
      recordSwap,
      claimG,
      verifyIdentity,
      resetStreak,
      refresh,
      recordActivity,
    }),
    [state, recordSwap, claimG, verifyIdentity, resetStreak, refresh, recordActivity],
  );

  return <StreakRewardsContext.Provider value={value}>{children}</StreakRewardsContext.Provider>;
}

/**
 * Public hook — reads from the shared provider. All 11+ call sites use this
 * without changes; the provider lives once in components/app/ProviderTree.
 */
export function useStreakRewards(): StreakState & StreakActions {
  const ctx = useContext(StreakRewardsContext);
  if (!ctx) {
    throw new Error('useStreakRewards must be used inside <StreakRewardsProvider>');
  }
  return ctx;
}

// Re-exports for backwards compatibility
export { STREAK_CONFIG } from '../modules/rewards/streak/types';
export type { StreakData } from '../modules/rewards/streak/types';

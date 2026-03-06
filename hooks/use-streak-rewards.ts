/**
 * useStreakRewards - GoodDollar $G streak tracking with MongoDB persistence
 * 
 * How it works:
 * 1. Primary: MongoDB via API for cross-device persistence
 * 2. Fallback: localStorage if API is unavailable
 * 3. User claims $G directly on GoodDollar's wallet site
 * 
 * Unlock Criteria: Any swap of $1+ unlocks daily G$ claim
 * 
 * Core Principles:
 * - DRY: Centralized streak logic
 * - MODULAR: Works with or without backend
 * - RESILIENT: Falls back to localStorage if API fails
 * - NEUTRAL: No judgment on swap strategy (Africapitalism, diversification, yield, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
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
export function useStreakRewards(): StreakState & StreakActions {
  const { address, isConnected } = useWalletContext();
  const [state, setState] = useState<StreakState>({
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
      testnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0, chainsUsed: [] },
      mainnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0 },
      graduation: { isGraduated: false, testnetActionsBeforeGraduation: 0 },
    },
    achievements: [],
    newlyEarnedAchievements: [],
    eligibleForGraduation: false,
  });

  // Fetch streak from API or fallback to localStorage
  const refresh = useCallback(async () => {
    if (!address || !isConnected) {
      setState(prev => ({
        ...prev,
        ...calculateStreakState(null),
        isLoading: false,
        error: null,
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Check On-chain GoodDollar status
      const onChainStatus = await fetchOnChainStatus(address);
      
      // 2. Fetch real entitlement from contract
      let realEntitlement = '~$0.25'; // Default fallback
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

      // 3. Try API for streak data
      const { streak, raw } = await fetchStreakFromApi(address);

      const streakState = calculateStreakState(streak);

      // Calculate graduation eligibility
      const testnetSwaps = raw.crossChainActivity?.testnet?.totalSwaps || 0;
      const isGraduated = raw.crossChainActivity?.graduation?.isGraduated || false;
      const eligibleForGraduation = !isGraduated && testnetSwaps >= 3;

      setState(prev => {
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

      // Sync to localStorage as backup
      if (streak) {
        saveLocalStreak(address, streak);
      }
    } catch (err) {
      console.warn('[StreakRewards] API failed, using localStorage fallback:', err);

      // Fallback to localStorage
      const localStreak = getLocalStreak(address);
      setState(prev => ({
        ...prev,
        ...calculateStreakState(localStreak),
        isLoading: false,
        error: 'Using offline mode',
        usingFallback: true,
      }));
    }
  }, [address, isConnected]);

  // Record a swap activity
  const recordSwap = useCallback(async (amountUSD: number) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountUSD < STREAK_CONFIG.MIN_SWAP_USD) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try API first
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

        setState(prev => ({
          ...prev,
          ...calculateStreakState(streak),
          isLoading: false,
          error: null,
          usingFallback: false,
        }));

        // Sync to localStorage
        saveLocalStreak(address, streak);
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.warn('[StreakRewards] API save failed, using localStorage:', err);

      // Fallback: Calculate and save locally
      const current = getLocalStreak(address);
      const newStreak = computeNextLocalStreak({
        address,
        amountUSD,
        current,
        gracePeriodsPerWeek: STREAK_CONFIG.GRACE_PERIODS_PER_WEEK,
      });

      saveLocalStreak(address, newStreak);

      setState(prev => ({
        ...prev,
        ...calculateStreakState(newStreak),
        isLoading: false,
        error: 'Saved locally (sync when online)',
        usingFallback: true,
      }));
    }
  }, [address]);

  // Claim G$ tokens directly in-app
  const claimG = useCallback(async (): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> => {
    if (!state.canClaim) {
      return { success: false, error: 'Not eligible to claim yet' };
    }

    try {
      // Dynamic imports to avoid loading on every render
      const [{ GoodDollarService, getWalletProvider }] = await Promise.all([
        import('@diversifi/shared'),
      ]);

      // Use the provider registry (supports Farcaster, MiniPay, injected wallets)
      const walletProvider = await getWalletProvider();
      if (!walletProvider) {
        // Fallback to external URL if no provider
        window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
        return { success: true, error: 'Opened external claim page' };
      }

      const service = await GoodDollarService.fromWeb3Provider(walletProvider);
      const result = await service.claimUBI();

      if (result.success) {
        console.log('[StreakRewards] UBI claimed successfully:', result);
      } else {
        console.warn('[StreakRewards] Claim failed, opening external page');
        // Fallback to external URL on error
        window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
      }

      return result;
    } catch (error) {
      console.error('[StreakRewards] Error claiming UBI:', error);
      // Fallback to external URL on error
      window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
      return { success: false, error: 'Opened external claim page as fallback' };
    }
  }, [state.canClaim]);

  // Generate Face Verification link
  const verifyIdentity = useCallback(async (): Promise<{ success: boolean; url?: string; error?: string }> => {
    if (!address) return { success: false, error: 'Wallet not connected' };

    try {
      const [{ GoodDollarService, getWalletProvider }] = await Promise.all([
        import('@diversifi/shared'),
      ]);

      // Use the provider registry (supports Farcaster, MiniPay, injected wallets)
      const walletProvider = await getWalletProvider();
      if (!walletProvider) {
        return { success: false, error: 'No wallet provider found. Please connect your wallet.' };
      }

      const service = await GoodDollarService.fromWeb3Provider(walletProvider);
      
      // Generate link (redirect to current page)
      const callbackUrl = window.location.href;
      const url = await service.getFaceVerificationLink('DiversiFi User', callbackUrl);
      
      // Open in new window or redirect
      window.open(url, '_blank');
      
      return { success: true, url };
    } catch (error) {
      console.error('[StreakRewards] Error generating FV link:', error);
      return { success: false, error: 'Failed to start verification flow' };
    }
  }, [address]);

  // Reset streak (dev/testing)
  const resetStreak = useCallback(async () => {
    if (!address) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Try API
      await fetch(`/api/streaks/${address}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[StreakRewards] API reset failed:', err);
    }

    // Always clear localStorage
    clearLocalStreak(address);

    setState(prev => ({
      ...prev,
      ...calculateStreakState(null),
      isLoading: false,
    }));
  }, [address]);

  // Record cross-chain activity (consolidated from useCrossChainActivity)
  const recordActivity = useCallback(async (params: {
    action: 'swap' | 'claim' | 'graduation';
    chainId: number;
    networkType: 'testnet' | 'mainnet';
    usdValue?: number;
    txHash?: string;
  }): Promise<boolean> => {
    if (!address) return false;

    try {
      const data = await patchActivity(address, params as RecordActivityParams);

      const eligibleForGraduation = computeEligibleForGraduation(data.crossChainActivity);

      setState(prev => {
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
  }, [address]);

  // Initial load and polling (only when tab is visible)
  useEffect(() => {
    refresh();

    // Refresh every 5 minutes (reduced from 60 seconds)
    // Streak data doesn't change that frequently
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  return {
    ...state,
    recordSwap,
    claimG,
    verifyIdentity,
    resetStreak,
    refresh,
    recordActivity,
  };
}

// Re-export for backwards compatibility
export { STREAK_CONFIG } from '../modules/rewards/streak/types';
export type { StreakData } from '../modules/rewards/streak/types';

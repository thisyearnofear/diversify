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

// Configuration
const STREAK_CONFIG = {
  MIN_SWAP_USD: 1.00, // Any $1+ swap unlocks G$ claim
  GRACE_PERIODS_PER_WEEK: 1,
  G_CLAIM_URL: 'http://goodwallet.xyz?inviteCode=4AJXLg3ynL',
  G_TOKEN_ADDRESS: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', // Celo (checksummed)
} as const;

// LocalStorage fallback key
const STORAGE_KEY = 'diversifi_streak_v1';

interface StreakData {
  walletAddress: string;
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
  totalSaved: number;
}

interface StreakState {
  streak: StreakData | null;
  canClaim: boolean;
  isEligible: boolean;
  isWhitelisted: boolean;
  entitlement: string;
  alreadyClaimedOnChain: boolean;
  nextClaimTime: Date | null;
  estimatedReward: string;
  isLoading: boolean;
  error: string | null;
  usingFallback: boolean;
  // Cross-chain activity (consolidated from useCrossChainActivity)
  crossChainActivity: {
    testnet: {
      totalSwaps: number;
      totalClaims: number;
      totalVolume: number;
      chainsUsed: number[];
    };
    mainnet: {
      totalSwaps: number;
      totalClaims: number;
      totalVolume: number;
    };
    graduation: {
      isGraduated: boolean;
      graduatedAt?: Date;
      testnetActionsBeforeGraduation: number;
    };
  };
  achievements: string[];
  eligibleForGraduation: boolean;
}

interface StreakActions {
  recordSwap: (amountUSD: number) => Promise<void>;
  claimG: () => Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }>;
  verifyIdentity: () => Promise<{ success: boolean; url?: string; error?: string }>;
  resetStreak: () => Promise<void>;
  refresh: () => Promise<void>;
  // Cross-chain activity recording (consolidated)
  recordActivity: (params: {
    action: 'swap' | 'claim' | 'graduation';
    chainId: number;
    networkType: 'testnet' | 'mainnet';
    usdValue?: number;
    txHash?: string;
  }) => Promise<boolean>;
}

// Helper: Calculate reward estimate
function calculateReward(streakDays: number): string {
  const baseReward = 0.25;
  const multiplier = Math.min(1 + (streakDays * 0.02), 1.5);
  const estimated = baseReward * multiplier;
  return `~$${estimated.toFixed(2)}`;
}

// Helper: Safely parse JSON responses (handles empty bodies)
async function safeParseJson(response: Response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// Helper: Calculate streak state
function calculateStreakState(streak: StreakData | null): Partial<StreakState> {
  if (!streak) {
    return {
      streak: null,
      canClaim: false,
      isEligible: false,
      nextClaimTime: null,
      estimatedReward: '~$0.25',
    };
  }

  const today = Math.floor(Date.now() / 86400000);
  const lastActivityDay = Math.floor(streak.lastActivity / 86400000);
  const daysSinceActivity = today - lastActivityDay;

  const isStreakActive = daysSinceActivity <= 1;
  // User is eligible to claim if they have an active streak AND have performed qualifying activity
  const isEligible = isStreakActive && streak.daysActive > 0;

  // We'll determine actual claimability dynamically via GoodDollar service
  const canClaim = isEligible; // Will be updated based on actual GoodDollar eligibility

  const nextClaimTime = isEligible
    ? null
    : new Date((lastActivityDay + 1) * 86400000 + 86400000); // Next day after last activity

  return {
    streak,
    canClaim,
    isEligible,
    nextClaimTime,
    estimatedReward: calculateReward(streak.daysActive),
  };
}

// LocalStorage fallback functions
function getLocalStreak(address: string): StreakData | null {
  if (typeof window === 'undefined') return null;
  const key = `${STORAGE_KEY}_${address.toLowerCase()}`;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveLocalStreak(address: string, data: StreakData): void {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_KEY}_${address.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify(data));
}

function clearLocalStreak(address: string): void {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_KEY}_${address.toLowerCase()}`;
  localStorage.removeItem(key);
}

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
      let onChainStatus = { 
        isWhitelisted: true, 
        entitlement: '0', 
        alreadyClaimedOnChain: false,
        canClaimOnChain: false 
      };
      try {
        const { GoodDollarService } = await import('../services/gooddollar-service');
        // Use read-only provider for quick check
        const service = GoodDollarService.createReadOnly();
        const eligibility = await service.checkClaimEligibility(address);
        
        onChainStatus = {
          isWhitelisted: eligibility.isWhitelisted,
          entitlement: eligibility.claimAmount,
          alreadyClaimedOnChain: eligibility.alreadyClaimed,
          canClaimOnChain: eligibility.canClaim
        };
      } catch (e) {
        console.warn('[StreakRewards] On-chain check failed:', e);
      }

      // 2. Try API for streak data
      const response = await fetch(`/api/streaks/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = (await safeParseJson(response)) || {};

        // Convert API response to StreakData format
        const streak: StreakData | null = data.exists ? {
          walletAddress: data.walletAddress,
          startTime: data.startTime,
          lastActivity: data.lastActivity,
          daysActive: data.daysActive,
          gracePeriodsUsed: data.gracePeriodsUsed,
          totalSaved: data.totalSaved,
        } : null;

        const streakState = calculateStreakState(streak);

        // Calculate graduation eligibility
        const testnetSwaps = data.crossChainActivity?.testnet?.totalSwaps || 0;
        const isGraduated = data.crossChainActivity?.graduation?.isGraduated || false;
        const eligibleForGraduation = !isGraduated && testnetSwaps >= 3;

        setState(prev => ({
          ...prev,
          ...streakState,
          ...onChainStatus,
          crossChainActivity: data.crossChainActivity || prev.crossChainActivity,
          achievements: data.achievements || [],
          eligibleForGraduation,
          canClaim: (streakState.canClaim || false) && onChainStatus.canClaimOnChain,
          isLoading: false,
          error: null,
          usingFallback: false,
        }));

        // Sync to localStorage as backup
        if (streak) {
          saveLocalStreak(address, streak);
        }
      } else {
        throw new Error('API request failed');
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
      const today = Math.floor(Date.now() / 86400000);
      const current = getLocalStreak(address);

      let newStreak: StreakData;

      if (!current) {
        newStreak = {
          walletAddress: address,
          startTime: Date.now(),
          lastActivity: Date.now(),
          daysActive: 1,
          gracePeriodsUsed: 0,
          totalSaved: amountUSD,
        };
      } else {
        const lastDay = Math.floor(current.lastActivity / 86400000);

        if (today === lastDay) {
          newStreak = { ...current, totalSaved: current.totalSaved + amountUSD };
        } else if (today === lastDay + 1) {
          newStreak = {
            ...current,
            daysActive: current.daysActive + 1,
            lastActivity: Date.now(),
            totalSaved: current.totalSaved + amountUSD,
          };
        } else if (today <= lastDay + 2 && current.gracePeriodsUsed < 1) {
          newStreak = {
            ...current,
            daysActive: current.daysActive + 1,
            gracePeriodsUsed: current.gracePeriodsUsed + 1,
            lastActivity: Date.now(),
            totalSaved: current.totalSaved + amountUSD,
          };
        } else {
          newStreak = {
            walletAddress: address,
            startTime: Date.now(),
            lastActivity: Date.now(),
            daysActive: 1,
            gracePeriodsUsed: 0,
            totalSaved: amountUSD,
          };
        }
      }

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
      const [{ GoodDollarService }, { getWalletProvider }] = await Promise.all([
        import('../services/gooddollar-service'),
        import('../modules/wallet/core/provider-registry'),
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
      const [{ GoodDollarService }, { getWalletProvider }] = await Promise.all([
        import('../services/gooddollar-service'),
        import('../modules/wallet/core/provider-registry'),
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
      const response = await fetch(`/api/streaks/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const data = (await safeParseJson(response)) || {};
        
        // Update local state with new activity data
        const testnetSwaps = data.crossChainActivity?.testnet?.totalSwaps || 0;
        const isGraduated = data.crossChainActivity?.graduation?.isGraduated || false;
        const eligibleForGraduation = !isGraduated && testnetSwaps >= 3;

        setState(prev => ({
          ...prev,
          crossChainActivity: data.crossChainActivity || prev.crossChainActivity,
          achievements: data.achievements || prev.achievements,
          eligibleForGraduation,
        }));

        // Show achievement notifications for newly earned badges
        if (data.newAchievements?.length > 0) {
          console.log('[StreakRewards] New achievements earned:', data.newAchievements);
        }

        return true;
      }
      return false;
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

// Export config for use in other components
export { STREAK_CONFIG };
export type { StreakData };

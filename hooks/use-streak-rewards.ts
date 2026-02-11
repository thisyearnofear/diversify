/**
 * useStreakRewards - GoodDollar $G streak tracking (NO CONTRACT NEEDED)
 * 
 * How it works:
 * 1. We track "saves" (swaps of $10+) in localStorage
 * 2. User builds a streak by saving daily
 * 3. When streak is active, we show the GoodDollar claim link
 * 4. User claims $G directly on GoodDollar's wallet site
 * 
 * Core Principles:
 * - DRY: Centralized streak logic
 * - MODULAR: Works without any smart contracts
 * - CLEAN: Simple localStorage persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

// Configuration
const STREAK_CONFIG = {
  MIN_SAVE_USD: 10,
  GRACE_PERIODS_PER_WEEK: 1,
  G_CLAIM_URL: 'https://wallet.gooddollar.org/?utm_source=diversifi',
  G_TOKEN_ADDRESS: '0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9', // Celo
} as const;

interface StreakData {
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
  nextClaimTime: Date | null;
  estimatedReward: string;
}

interface StreakActions {
  recordSave: (amountUSD: number) => void;
  claimG: () => void;
  resetStreak: () => void;
  refresh: () => void;
}

// Simple storage helper
const STORAGE_KEY = 'diversifi_streak_v1';

function getStorageKey(address: string): string {
  return `${STORAGE_KEY}_${address.toLowerCase()}`;
}

function getStreakData(address: string): StreakData | null {
  if (typeof window === 'undefined') return null;
  
  const data = localStorage.getItem(getStorageKey(address));
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveStreakData(address: string, data: StreakData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(address), JSON.stringify(data));
}

function calculateStreakState(streak: StreakData | null): StreakState {
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
  
  // Streak is active if they saved today or yesterday
  const isStreakActive = daysSinceActivity <= 1;
  
  // Can claim if streak is active
  const canClaim = isStreakActive && streak.daysActive > 0;
  
  // Next claim is tomorrow
  const nextClaimTime = canClaim 
    ? null 
    : new Date((today + 1) * 86400000);

  return {
    streak,
    canClaim,
    isEligible: streak.daysActive > 0,
    nextClaimTime,
    estimatedReward: calculateReward(streak.daysActive),
  };
}

function calculateReward(streakDays: number): string {
  // GoodDollar UBI is typically $0.10-$0.50
  // We show higher estimates for longer streaks as encouragement
  const baseReward = 0.25;
  const multiplier = Math.min(1 + (streakDays * 0.02), 1.5);
  const estimated = baseReward * multiplier;
  return `~$${estimated.toFixed(2)}`;
}

// Cache for performance
const streakCache = new Map<string, { data: StreakState; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

export function useStreakRewards(): StreakState & StreakActions & { isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<StreakState>({
    streak: null,
    canClaim: false,
    isEligible: false,
    nextClaimTime: null,
    estimatedReward: '~$0.25',
  });

  const refresh = useCallback(() => {
    if (!address || !isConnected) {
      setState({
        streak: null,
        canClaim: false,
        isEligible: false,
        nextClaimTime: null,
        estimatedReward: '~$0.25',
      });
      return;
    }

    // Check cache
    const cacheKey = address.toLowerCase();
    const cached = streakCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(cached.data);
      return;
    }

    const streak = getStreakData(address);
    const newState = calculateStreakState(streak);
    
    setState(newState);
    streakCache.set(cacheKey, { data: newState, timestamp: Date.now() });
  }, [address, isConnected]);

  // Record a save activity
  const recordSave = useCallback((amountUSD: number) => {
    if (!address) return;
    if (amountUSD < STREAK_CONFIG.MIN_SAVE_USD) return;

    setIsLoading(true);
    
    const today = Math.floor(Date.now() / 86400000);
    const current = getStreakData(address);
    
    let newStreak: StreakData;
    
    if (!current) {
      // First save
      newStreak = {
        startTime: Date.now(),
        lastActivity: Date.now(),
        daysActive: 1,
        gracePeriodsUsed: 0,
        totalSaved: amountUSD,
      };
    } else {
      const lastDay = Math.floor(current.lastActivity / 86400000);
      
      if (today === lastDay) {
        // Already saved today - update amount
        newStreak = {
          ...current,
          lastActivity: Date.now(),
          totalSaved: current.totalSaved + amountUSD,
        };
      } else if (today === lastDay + 1) {
        // Consecutive day - streak continues
        newStreak = {
          ...current,
          daysActive: current.daysActive + 1,
          lastActivity: Date.now(),
          totalSaved: current.totalSaved + amountUSD,
        };
      } else if (today <= lastDay + 2 && current.gracePeriodsUsed < STREAK_CONFIG.GRACE_PERIODS_PER_WEEK) {
        // Used grace period (1 miss allowed per week)
        newStreak = {
          ...current,
          daysActive: current.daysActive + 1,
          gracePeriodsUsed: current.gracePeriodsUsed + 1,
          lastActivity: Date.now(),
          totalSaved: current.totalSaved + amountUSD,
        };
      } else {
        // Streak broken - start over
        newStreak = {
          startTime: Date.now(),
          lastActivity: Date.now(),
          daysActive: 1,
          gracePeriodsUsed: 0,
          totalSaved: amountUSD,
        };
      }
    }
    
    saveStreakData(address, newStreak);
    
    // Clear cache to force refresh
    streakCache.delete(address.toLowerCase());
    
    setIsLoading(false);
    refresh();
  }, [address, refresh]);

  // Open GoodDollar claim page
  const claimG = useCallback(() => {
    if (!state.canClaim) return;
    
    // Open GoodDollar wallet in new tab
    // User claims their UBI directly on GoodDollar's site
    window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
    
    // Note: We don't verify they claimed - we trust the user
    // In a future version, we could check their G$ balance on Celo
  }, [state.canClaim]);

  // Reset streak (for testing)
  const resetStreak = useCallback(() => {
    if (!address) return;
    localStorage.removeItem(getStorageKey(address));
    streakCache.delete(address.toLowerCase());
    refresh();
  }, [address, refresh]);

  // Initial load and polling
  useEffect(() => {
    refresh();
    
    // Refresh every 30 seconds to update claim eligibility
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  return {
    ...state,
    isLoading,
    recordSave,
    claimG,
    resetStreak,
    refresh,
  };
}

// Export config for use in other components
export { STREAK_CONFIG };
export type { StreakData };

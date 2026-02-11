/**
 * useStreakRewards - GoodDollar $G streak tracking with MongoDB persistence
 * 
 * How it works:
 * 1. Primary: MongoDB via API for cross-device persistence
 * 2. Fallback: localStorage if API is unavailable
 * 3. User claims $G directly on GoodDollar's wallet site
 * 
 * Core Principles:
 * - DRY: Centralized streak logic
 * - MODULAR: Works with or without backend
 * - RESILIENT: Falls back to localStorage if API fails
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../components/wallet/WalletProvider';

// Configuration
const STREAK_CONFIG = {
  MIN_SAVE_USD: 10,
  GRACE_PERIODS_PER_WEEK: 1,
  G_CLAIM_URL: 'https://wallet.gooddollar.org/?utm_source=diversifi',
  G_TOKEN_ADDRESS: '0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9', // Celo
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
  nextClaimTime: Date | null;
  estimatedReward: string;
  isLoading: boolean;
  error: string | null;
  usingFallback: boolean;
}

interface StreakActions {
  recordSave: (amountUSD: number) => Promise<void>;
  claimG: () => void;
  resetStreak: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Helper: Calculate reward estimate
function calculateReward(streakDays: number): string {
  const baseReward = 0.25;
  const multiplier = Math.min(1 + (streakDays * 0.02), 1.5);
  const estimated = baseReward * multiplier;
  return `~$${estimated.toFixed(2)}`;
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
  const canClaim = isStreakActive && streak.daysActive > 0;
  
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
    nextClaimTime: null,
    estimatedReward: '~$0.25',
    isLoading: false,
    error: null,
    usingFallback: false,
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
      // Try API first
      const response = await fetch(`/api/streaks/${address}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Convert API response to StreakData format
        const streak: StreakData | null = data.exists ? {
          walletAddress: data.walletAddress,
          startTime: data.startTime,
          lastActivity: data.lastActivity,
          daysActive: data.daysActive,
          gracePeriodsUsed: data.gracePeriodsUsed,
          totalSaved: data.totalSaved,
        } : null;

        setState(prev => ({
          ...prev,
          ...calculateStreakState(streak),
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

  // Record a save activity
  const recordSave = useCallback(async (amountUSD: number) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountUSD < STREAK_CONFIG.MIN_SAVE_USD) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try API first
      const response = await fetch(`/api/streaks/${address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUSD }),
      });

      if (response.ok) {
        const data = await response.json();
        
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

  // Open GoodDollar claim page
  const claimG = useCallback(() => {
    if (!state.canClaim) return;
    window.open(STREAK_CONFIG.G_CLAIM_URL, '_blank');
  }, [state.canClaim]);

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

  // Initial load and polling
  useEffect(() => {
    refresh();
    
    // Refresh every 60 seconds
    const interval = setInterval(refresh, 60000);
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
    recordSave,
    claimG,
    resetStreak,
    refresh,
  };
}

// Export config for use in other components
export { STREAK_CONFIG };
export type { StreakData };

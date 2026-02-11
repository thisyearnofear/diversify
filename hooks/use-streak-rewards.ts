/**
 * useStreakRewards - Single source of truth for GoodDollar $G streak tracking
 * 
 * Core Principles:
 * - DRY: Centralized streak logic used across all components
 * - MODULAR: Independent of UI, composable with any component
 * - CLEAN: Clear separation between on-chain data and UI state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';

// Minimal contract ABI - only what we need
const STREAK_VERIFIER_ABI = [
  'function streaks(address) view returns (uint256 startTime, uint256 lastActivity, uint16 daysActive, uint16 gracePeriodsUsed)',
  'function lastClaimDay(address) view returns (uint256)',
  'function canClaim(address) view returns (bool)',
  'function recordClaim(address) external',
  'event ActivityRecorded(address indexed user, uint256 amount, uint16 streakDays)',
  'event StreakBroken(address indexed user, uint256 previousStreak)',
];

// Configuration
const STREAK_CONFIG = {
  CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000', // TODO: Deploy and update
  MIN_SAVE_USD: 10,
  GRACE_PERIODS: 1,
  CHAIN_ID: 42220, // Celo mainnet
  G_TOKEN_ADDRESS: '0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9',
} as const;

interface StreakData {
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
}

interface StreakState {
  streak: StreakData | null;
  canClaim: boolean;
  lastClaimDay: number;
  isEligible: boolean;
  nextClaimTime: Date | null;
  estimatedReward: string;
}

interface StreakActions {
  recordSave: (amountUSD: number) => Promise<void>;
  claimG: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Cache to prevent unnecessary re-fetches
const streakCache = new Map<string, { data: StreakState; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function useStreakRewards(): StreakState & StreakActions & { isLoading: boolean; error: Error | null } {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<StreakState>({
    streak: null,
    canClaim: false,
    lastClaimDay: 0,
    isEligible: false,
    nextClaimTime: null,
    estimatedReward: '~$0.25',
  });

  // Use ref to prevent duplicate fetches
  const isFetchingRef = useRef(false);

  const fetchStreakData = useCallback(async () => {
    if (!address || !isConnected || isFetchingRef.current) return;
    
    // Check cache
    const cacheKey = `${address}-${chainId}`;
    const cached = streakCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(cached.data);
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual contract call once deployed
      // For now, simulate with localStorage fallback for development
      const mockData = getMockStreakData(address);
      
      const today = Math.floor(Date.now() / 86400000);
      const canClaim = mockData.lastActivity >= today - 1 && mockData.lastClaimDay < today;
      
      const newState: StreakState = {
        streak: mockData,
        canClaim,
        lastClaimDay: mockData.lastClaimDay,
        isEligible: mockData.daysActive > 0,
        nextClaimTime: canClaim ? null : new Date((today + 1) * 86400000),
        estimatedReward: calculateReward(mockData.daysActive),
      };

      setState(newState);
      streakCache.set(cacheKey, { data: newState, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch streak data'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [address, isConnected, chainId]);

  // Record a save activity
  const recordSave = useCallback(async (amountUSD: number) => {
    if (!address) throw new Error('Wallet not connected');
    if (amountUSD < STREAK_CONFIG.MIN_SAVE_USD) {
      throw new Error(`Minimum save amount is $${STREAK_CONFIG.MIN_SAVE_USD}`);
    }

    setIsLoading(true);
    try {
      // TODO: Call contract method once deployed
      // await contract.recordSave(address, ethers.parseUnits(amountUSD.toString(), 18), Date.now());
      
      // For now, use localStorage mock
      saveMockActivity(address, amountUSD);
      
      // Refresh state
      await fetchStreakData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to record save'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, fetchStreakData]);

  // Claim G$ tokens
  const claimG = useCallback(async () => {
    if (!address) throw new Error('Wallet not connected');
    if (!state.canClaim) throw new Error('Cannot claim at this time');

    setIsLoading(true);
    try {
      // 1. Record claim in our contract (prevents double-claim)
      // await contract.recordClaim(address);
      recordMockClaim(address);

      // 2. Open GoodDollar wallet for actual claim
      window.open(
        `https://wallet.gooddollar.org/?claim=true&referrer=diversifi&streak=${state.streak?.daysActive || 0}`,
        '_blank'
      );

      // 3. Refresh state
      await fetchStreakData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to claim'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, state.canClaim, state.streak?.daysActive, fetchStreakData]);

  // Initial fetch and polling
  useEffect(() => {
    fetchStreakData();
    
    // Poll every 60 seconds
    const interval = setInterval(fetchStreakData, 60000);
    return () => clearInterval(interval);
  }, [fetchStreakData]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => fetchStreakData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStreakData]);

  return {
    ...state,
    isLoading,
    error,
    recordSave,
    claimG,
    refresh: fetchStreakData,
  };
}

// Helper to calculate estimated reward based on streak
function calculateReward(streakDays: number): string {
  // GoodDollar UBI is typically $0.10-$0.50, can vary
  const baseReward = 0.25;
  const multiplier = Math.min(1 + (streakDays * 0.05), 2); // Max 2x
  const estimated = baseReward * multiplier;
  return `~$${estimated.toFixed(2)}`;
}

// Mock implementations for development (remove after contract deployment)
const STORAGE_KEY = 'diversifi_streak_mock';

interface MockStreakData {
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
  lastClaimDay: number;
}

function getMockStreakData(address: string): MockStreakData {
  if (typeof window === 'undefined') {
    return { startTime: 0, lastActivity: 0, daysActive: 0, gracePeriodsUsed: 0, lastClaimDay: 0 };
  }
  
  const data = localStorage.getItem(`${STORAGE_KEY}_${address}`);
  if (data) {
    return JSON.parse(data);
  }
  
  return { startTime: 0, lastActivity: 0, daysActive: 0, gracePeriodsUsed: 0, lastClaimDay: 0 };
}

function saveMockActivity(address: string, amountUSD: number) {
  const today = Math.floor(Date.now() / 86400000);
  const current = getMockStreakData(address);
  
  const lastDay = Math.floor(current.lastActivity / 86400000);
  
  let newData: MockStreakData;
  
  if (today === lastDay) {
    // Already active today
    newData = { ...current, lastActivity: Date.now() };
  } else if (today === lastDay + 1) {
    // Consecutive day
    newData = {
      ...current,
      daysActive: current.daysActive + 1,
      lastActivity: Date.now(),
      startTime: current.startTime || Date.now(),
    };
  } else if (today <= lastDay + 2 && current.gracePeriodsUsed < 1) {
    // Used grace period
    newData = {
      ...current,
      daysActive: current.daysActive + 1,
      gracePeriodsUsed: current.gracePeriodsUsed + 1,
      lastActivity: Date.now(),
    };
  } else {
    // Streak broken
    newData = {
      startTime: Date.now(),
      lastActivity: Date.now(),
      daysActive: 1,
      gracePeriodsUsed: 0,
      lastClaimDay: current.lastClaimDay,
    };
  }
  
  localStorage.setItem(`${STORAGE_KEY}_${address}`, JSON.stringify(newData));
}

function recordMockClaim(address: string) {
  const current = getMockStreakData(address);
  const today = Math.floor(Date.now() / 86400000);
  
  localStorage.setItem(
    `${STORAGE_KEY}_${address}`,
    JSON.stringify({ ...current, lastClaimDay: today })
  );
}

// Export config for use in other components
export { STREAK_CONFIG };
export type { StreakData, StreakState };

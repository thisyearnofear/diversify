export const STREAK_STORAGE_KEY = 'diversifi_streak_v1' as const;

export const STREAK_CONFIG = {
  MIN_SWAP_USD: 1.0,
  GRACE_PERIODS_PER_WEEK: 1,
  G_CLAIM_URL: 'https://wallet.gooddollar.org?inviteCode=4AJXLg3ynL',
  G_TOKEN_ADDRESS: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', // Celo (checksummed)
} as const;

export interface StreakData {
  walletAddress: string;
  startTime: number;
  lastActivity: number;
  daysActive: number;
  gracePeriodsUsed: number;
  totalSaved: number;
}

export interface CrossChainActivityState {
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
}

export interface StreakState {
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
  crossChainActivity: CrossChainActivityState;
  achievements: string[];
  /** Achievement IDs that were earned since the last refresh/recordActivity call */
  newlyEarnedAchievements: string[];
  eligibleForGraduation: boolean;
}

export interface StreakActions {
  recordSwap: (amountUSD: number) => Promise<void>;
  claimG: () => Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }>;
  verifyIdentity: () => Promise<{ success: boolean; url?: string; error?: string }>;
  resetStreak: () => Promise<void>;
  refresh: () => Promise<void>;
  recordActivity: (params: {
    action: 'swap' | 'claim' | 'graduation';
    chainId: number;
    networkType: 'testnet' | 'mainnet';
    usdValue?: number;
    txHash?: string;
  }) => Promise<boolean>;
}

import type { TabId } from '@/constants/tabs';

export type TreasuryIntentSource = 'home' | 'shield' | 'exchange' | 'guardian';

/** Where a swap hand-off came from — carried to the receipt so it can lead back. */
export interface HandoffOrigin {
  source: TreasuryIntentSource;
  asset?: string;
  label?: string;
}

export interface SwapPrefill {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  reason?: string;
  fromChainId?: number;
  toChainId?: number;
  phoneNumber?: string;
  recipientAddress?: string;
  origin?: HandoffOrigin;
}

export interface GuidedTourState {
  tourId: string;
  currentStep: number;
  totalSteps: number;
  highlightSection?: string;
}

export type UserExperienceMode = 'beginner' | 'intermediate' | 'advanced';

// Deep leaf re-export from shared package to ensure consistency — bypasses
// the barrel so this type-only import doesn't pull the AI/swap/ethers stack
// into first-load.
export type { FinancialStrategy } from '@diversifi/shared/src/types/strategy';
import type { FinancialStrategy as FinancialStrategyType } from '@diversifi/shared/src/types/strategy';

// Nullable version for local state
export type NullableFinancialStrategy = FinancialStrategyType | null;

export interface UserActivity {
  swapCount: number;
  lastSwapDate: number | null;
  hasViewedProtection: boolean;
  hasViewedAnalytics: boolean;
}

export interface DemoModeState {
  isActive: boolean;
  mockAddress: string;
  mockChainId: number;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export type NavigationState = {
  activeTab: TabId;
  visitedTabs: TabId[];
  chainId: number | null;
  swapPrefill: SwapPrefill | null;
};

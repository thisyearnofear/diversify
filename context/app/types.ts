import type { TabId } from '@/constants/tabs';

export interface SwapPrefill {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  reason?: string;
  fromChainId?: number;
  toChainId?: number;
  phoneNumber?: string;
  recipientAddress?: string;
}

export interface GuidedTourState {
  tourId: string;
  currentStep: number;
  totalSteps: number;
  highlightSection?: string;
}

export type UserExperienceMode = 'beginner' | 'intermediate' | 'advanced';

// Re-export from shared package to ensure consistency
export type { FinancialStrategy } from '@diversifi/shared';
import type { FinancialStrategy as FinancialStrategyType } from '@diversifi/shared';

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

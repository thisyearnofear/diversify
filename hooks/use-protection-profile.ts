/**
 * Protection Profile Hook
 * 
 * Manages the 3-step profile setup flow with proper edit functionality.
 * Separates the UI flow state (editing/viewing) from the persisted config.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FinancialStrategy } from '@diversifi/shared';

// ============================================================================
// TYPES
// ============================================================================

export type UserGoal = 
  | 'inflation_protection' 
  | 'geographic_diversification' 
  | 'rwa_access' 
  | 'exploring';

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';
export type TimeHorizon = '1 month' | '3 months' | '1 year';

export interface ProtectionConfig {
  userGoal: UserGoal | null;
  userRegion: string | null;
  riskTolerance: RiskTolerance | null;
  timeHorizon: TimeHorizon | null;
  /** Protection philosophy — single source of truth (replaces `financialStrategy` localStorage key). */
  philosophy: FinancialStrategy | null;
}

export type ProfileMode = 'editing' | 'viewing' | 'complete';

export interface ProtectionProfileState {
  // UI Flow State
  mode: ProfileMode;
  currentStep: number; // 0, 1, 2 (only relevant when editing)
  
  // Persisted Config
  config: ProtectionConfig;
  
  // Computed
  isComplete: boolean;
  canEdit: boolean;
  progressPercent: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'diversifi-protection-profile-v2';

const DEFAULT_CONFIG: ProtectionConfig = {
  userGoal: null,
  userRegion: null,
  riskTolerance: null,
  timeHorizon: null,
  philosophy: null,
};

const LEGACY_STRATEGY_KEY = 'financialStrategy';

const PHILOSOPHY_DEFAULT_GOAL: Partial<Record<FinancialStrategy, UserGoal>> = {
  africapitalism: 'geographic_diversification',
  buen_vivir: 'geographic_diversification',
  pan_caribbean: 'inflation_protection',
  confucian: 'inflation_protection',
  gotong_royong: 'geographic_diversification',
  islamic: 'inflation_protection',
  global: 'geographic_diversification',
  custom: 'exploring',
  inflation_protection: 'inflation_protection',
  geographic_diversification: 'geographic_diversification',
  rwa_access: 'rwa_access',
  exploring: 'exploring',
};

/**
 * Map a protection philosophy (financial strategy) to profile defaults.
 * Called when StrategyModal onboarding completes so GuidedTour step 4
 * does not re-ask region/goal.
 */
export function deriveProfileFromPhilosophy(
  strategy: FinancialStrategy | null,
  region?: string | null,
): Partial<ProtectionConfig> {
  if (!strategy) {
    return region ? { userRegion: region } : {};
  }

  return {
    philosophy: strategy,
    userGoal: PHILOSOPHY_DEFAULT_GOAL[strategy] ?? 'inflation_protection',
    userRegion: region ?? null,
    riskTolerance: 'Balanced',
    timeHorizon: '1 year',
  };
}

export const USER_GOALS: Array<{
  value: UserGoal;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: 'inflation_protection',
    label: 'Hedge Inflation',
    icon: '🛡️',
    description: 'Protect against currency devaluation',
  },
  {
    value: 'geographic_diversification',
    label: 'Diversify Regions',
    icon: '🌍',
    description: 'Spread risk across economies',
  },
  {
    value: 'rwa_access',
    label: 'Access Gold/RWA',
    icon: '🥇',
    description: 'Hold real-world assets',
  },
  {
    value: 'exploring',
    label: 'Just Exploring',
    icon: '🔍',
    description: 'Learn about protection',
  },
];

export const RISK_LEVELS: Array<{
  value: RiskTolerance;
  label: string;
  icon: string;
}> = [
  { value: 'Conservative', label: 'Conservative', icon: '🛡️' },
  { value: 'Balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'Aggressive', label: 'Aggressive', icon: '🚀' },
];

export const TIME_HORIZONS: Array<{
  value: TimeHorizon;
  label: string;
  description: string;
}> = [
  { value: '1 month', label: 'Short', description: '< 3 months' },
  { value: '3 months', label: 'Medium', description: '3-12 months' },
  { value: '1 year', label: 'Long', description: '> 1 year' },
];

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function migrateLegacyPhilosophy(config: ProtectionConfig): ProtectionConfig {
  if (config.philosophy) return config;
  try {
    const legacy = localStorage.getItem(LEGACY_STRATEGY_KEY) as FinancialStrategy | null;
    if (legacy) {
      const migrated = { ...config, philosophy: legacy };
      saveConfig(migrated);
      localStorage.removeItem(LEGACY_STRATEGY_KEY);
      return migrated;
    }
  } catch {
    // Ignore storage errors
  }
  return config;
}

function loadConfig(): ProtectionConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateLegacyPhilosophy({
        userGoal: parsed.userGoal || null,
        userRegion: parsed.userRegion || null,
        riskTolerance: parsed.riskTolerance || null,
        timeHorizon: parsed.timeHorizon || null,
        philosophy: parsed.philosophy || null,
      });
    }
  } catch {
    // Ignore storage errors
  }
  return migrateLegacyPhilosophy({ ...DEFAULT_CONFIG });
}

/** Read persisted philosophy without React (StrategyContext, API helpers). */
export function loadPhilosophy(): FinancialStrategy | null {
  return loadConfig().philosophy;
}

/** Persist philosophy into the protection profile (removes legacy key). */
export function savePhilosophy(strategy: FinancialStrategy | null): void {
  const config = loadConfig();
  saveConfig({ ...config, philosophy: strategy });
  try {
    localStorage.removeItem(LEGACY_STRATEGY_KEY);
  } catch {
    // Ignore storage errors
  }
}

function saveConfig(config: ProtectionConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useProtectionProfile() {
  // Config is the source of truth for persisted data
  const [config, setConfig] = useState<ProtectionConfig>(DEFAULT_CONFIG);
  
  // UI flow state
  const [mode, setMode] = useState<ProfileMode>('editing');
  const [currentStep, setCurrentStep] = useState(0);
  
  // Load from storage on mount
  useEffect(() => {
    const loaded = loadConfig();
    setConfig(loaded);
    
    // If config is complete, start in viewing mode
    const isComplete = loaded.userGoal && loaded.riskTolerance && loaded.timeHorizon;
    setMode(isComplete ? 'complete' : 'editing');
    setCurrentStep(isComplete ? 0 : 0);
  }, []);

  // Save to storage when config changes
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Computed values
  const isComplete = useMemo(() => {
    return !!(config.userGoal && config.riskTolerance && config.timeHorizon);
  }, [config]);

  const progressPercent = useMemo(() => {
    let completed = 0;
    if (config.userGoal) completed++;
    if (config.riskTolerance) completed++;
    if (config.timeHorizon) completed++;
    return (completed / 3) * 100;
  }, [config]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Start editing the profile from the beginning
   */
  const startEditing = useCallback(() => {
    setMode('editing');
    setCurrentStep(0);
  }, []);

  /**
   * Start editing from a specific step
   */
  const editFromStep = useCallback((step: number) => {
    setMode('editing');
    setCurrentStep(Math.max(0, Math.min(2, step)));
  }, []);

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= 2) {
        // Complete the flow
        setMode('complete');
        return 0;
      }
      return prev + 1;
    });
  }, []);

  /**
   * Go to previous step
   */
  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  /**
   * Skip to the end (complete without finishing steps)
   */
  const skipToEnd = useCallback(() => {
    setMode('complete');
    setCurrentStep(0);
  }, []);

  /**
   * Complete the editing flow
   */
  const completeEditing = useCallback(() => {
    setMode('complete');
    setCurrentStep(0);
  }, []);

  /**
   * Update a config value
   */
  const updateConfig = useCallback(<K extends keyof ProtectionConfig>(
    key: K,
    value: ProtectionConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Set multiple config values at once
   */
  const setMultipleConfig = useCallback((updates: Partial<ProtectionConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset profile to defaults
   */
  const resetProfile = useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG });
    setMode('editing');
    setCurrentStep(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Check if current step is valid (has required selection)
   */
  const isStepValid = useCallback((step?: number): boolean => {
    const checkStep = step ?? currentStep;
    
    switch (checkStep) {
      case 0:
        return config.userGoal !== null;
      case 1:
        return config.riskTolerance !== null;
      case 2:
        return config.timeHorizon !== null;
      default:
        return false;
    }
  }, [config, currentStep]);

  /**
   * Get the label for current goal
   */
  const currentGoalLabel = useMemo(() => {
    return USER_GOALS.find(g => g.value === config.userGoal)?.label || 'diversification';
  }, [config.userGoal]);

  /**
   * Get the icon for current goal
   */
  const currentGoalIcon = useMemo(() => {
    return USER_GOALS.find(g => g.value === config.userGoal)?.icon || '❓';
  }, [config.userGoal]);

  return {
    // State
    mode,
    currentStep,
    config,
    isComplete,
    progressPercent,
    
    // Step validation
    isStepValid,
    canProceed: isStepValid(),
    
    // Display values
    currentGoalLabel,
    currentGoalIcon,
    currentRiskLabel: config.riskTolerance || 'Balanced',
    currentTimeHorizonLabel: config.timeHorizon || '3 months',
    
    // Actions
    startEditing,
    editFromStep,
    nextStep,
    prevStep,
    skipToEnd,
    completeEditing,
    updateConfig,
    setMultipleConfig,
    resetProfile,
    
    // Direct setters for convenience
    setUserGoal: useCallback((goal: UserGoal) => updateConfig('userGoal', goal), [updateConfig]),
    setRiskTolerance: useCallback((risk: RiskTolerance) => updateConfig('riskTolerance', risk), [updateConfig]),
    setTimeHorizon: useCallback((time: TimeHorizon) => updateConfig('timeHorizon', time), [updateConfig]),
    
    // Alias for updateConfig (backwards compatibility)
    updateProfile: updateConfig,
  };
}

export default useProtectionProfile;

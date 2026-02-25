import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserActivity, UserExperienceMode } from './types';

type ExperienceContextValue = {
  experienceMode: UserExperienceMode;
  userActivity: UserActivity;
  setExperienceMode: (mode: UserExperienceMode) => void;
  recordSwap: () => void;
  shouldShowAdvancedFeatures: () => boolean;
  shouldShowIntermediateFeatures: () => boolean;
};

const ExperienceContext = createContext<ExperienceContextValue | undefined>(undefined);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [experienceMode, setExperienceModeState] = useState<UserExperienceMode>('beginner');
  const [userActivity, setUserActivity] = useState<UserActivity>({
    swapCount: 0,
    lastSwapDate: null,
    hasViewedProtection: false,
    hasViewedAnalytics: false,
  });

  useEffect(() => {
    const savedMode = localStorage.getItem('experienceMode') as UserExperienceMode | null;
    const savedActivity = localStorage.getItem('userActivity');

    let nextMode: UserExperienceMode = 'beginner';
    let nextActivity: UserActivity = {
      swapCount: 0,
      lastSwapDate: null,
      hasViewedProtection: false,
      hasViewedAnalytics: false,
    };

    if (savedMode && ['beginner', 'intermediate', 'advanced'].includes(savedMode)) {
      nextMode = savedMode;
    }

    if (savedActivity) {
      try {
        nextActivity = JSON.parse(savedActivity);
      } catch {
        // ignore
      }
    }

    // auto-upgrade
    if (nextMode === 'beginner' && nextActivity.swapCount >= 3) nextMode = 'intermediate';
    if (nextMode === 'intermediate' && nextActivity.swapCount >= 10) nextMode = 'advanced';

    setExperienceModeState(nextMode);
    setUserActivity(nextActivity);
  }, []);

  const setExperienceMode = useCallback((mode: UserExperienceMode) => {
    setExperienceModeState(mode);
    localStorage.setItem('experienceMode', mode);
  }, []);

  const recordSwap = useCallback(() => {
    setUserActivity((prev) => {
      const nextActivity: UserActivity = {
        ...prev,
        swapCount: prev.swapCount + 1,
        lastSwapDate: Date.now(),
      };

      let nextMode = experienceMode;
      if (nextMode === 'beginner' && nextActivity.swapCount >= 3) nextMode = 'intermediate';
      else if (nextMode === 'intermediate' && nextActivity.swapCount >= 10) nextMode = 'advanced';

      localStorage.setItem('userActivity', JSON.stringify(nextActivity));
      if (nextMode !== experienceMode) {
        setExperienceModeState(nextMode);
        localStorage.setItem('experienceMode', nextMode);
      }

      return nextActivity;
    });
  }, [experienceMode]);

  const shouldShowAdvancedFeatures = useCallback(() => experienceMode === 'advanced', [experienceMode]);
  const shouldShowIntermediateFeatures = useCallback(
    () => experienceMode === 'intermediate' || experienceMode === 'advanced',
    [experienceMode],
  );

  const value = useMemo<ExperienceContextValue>(
    () => ({
      experienceMode,
      userActivity,
      setExperienceMode,
      recordSwap,
      shouldShowAdvancedFeatures,
      shouldShowIntermediateFeatures,
    }),
    [
      experienceMode,
      userActivity,
      setExperienceMode,
      recordSwap,
      shouldShowAdvancedFeatures,
      shouldShowIntermediateFeatures,
    ],
  );

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error('useExperience must be used within ExperienceProvider');
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserActivity, UserExperienceMode } from './types';

type ExperienceContextValue = {
  experienceMode: UserExperienceMode;
  userActivity: UserActivity;
  hydrated: boolean;
  setExperienceMode: (mode: UserExperienceMode) => void;
  recordSwap: () => void;
};

const ExperienceContext = createContext<ExperienceContextValue | undefined>(undefined);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [experienceMode, setExperienceModeState] = useState<UserExperienceMode>('simple');
  const [hydrated, setHydrated] = useState(false);
  const [userActivity, setUserActivity] = useState<UserActivity>({
    swapCount: 0,
    lastSwapDate: null,
    hasViewedProtection: false,
    hasViewedAnalytics: false,
  });

  useEffect(() => {
    const savedMode = localStorage.getItem('experienceMode');
    const savedActivity = localStorage.getItem('userActivity');

    let nextMode: UserExperienceMode = 'simple';
    let nextActivity: UserActivity = {
      swapCount: 0,
      lastSwapDate: null,
      hasViewedProtection: false,
      hasViewedAnalytics: false,
    };

    // Migrate the saved mode: beginner → simple, intermediate/advanced →
    // full (intermediate and advanced showed the same dock once Learn
    // was retired). Rewrite storage in the new form.
    if (savedMode === 'beginner' || savedMode === 'simple') {
      nextMode = 'simple';
    } else if (savedMode === 'intermediate' || savedMode === 'advanced' || savedMode === 'full') {
      nextMode = 'full';
    }

    if (savedActivity) {
      try {
        nextActivity = JSON.parse(savedActivity);
      } catch {
        // ignore
      }
    }

    // auto-upgrade
    if (nextMode === 'simple' && nextActivity.swapCount >= 3) nextMode = 'full';
    if (savedMode !== nextMode) {
      localStorage.setItem('experienceMode', nextMode);
    }

    setExperienceModeState(nextMode);
    setUserActivity(nextActivity);
    setHydrated(true);
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
      if (nextMode === 'simple' && nextActivity.swapCount >= 3) nextMode = 'full';

      localStorage.setItem('userActivity', JSON.stringify(nextActivity));
      if (nextMode !== experienceMode) {
        setExperienceModeState(nextMode);
        localStorage.setItem('experienceMode', nextMode);
      }

      return nextActivity;
    });
  }, [experienceMode]);

  const value = useMemo<ExperienceContextValue>(
    () => ({
      experienceMode,
      userActivity,
      hydrated,
      setExperienceMode,
      recordSwap,
    }),
    [
      experienceMode,
      userActivity,
      hydrated,
      setExperienceMode,
      recordSwap,
    ],
  );

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error('useExperience must be used within ExperienceProvider');
  return ctx;
}

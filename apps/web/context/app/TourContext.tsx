import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { GuidedTourState, SwapPrefill } from './types';
import type { TabId } from '@/constants/tabs';
import { useNavigation } from './NavigationContext';

type TourContextValue = {
  guidedTour: GuidedTourState | null;
  startTour: (tourId: string, totalSteps: number, initialTab: TabId, section?: string) => void;
  nextTourStep: (nextTab: TabId, section?: string, prefill?: SwapPrefill) => void;
  exitTour: () => void;
  dismissTour: (tourId: string) => void;
  isTourDismissed: (tourId: string) => boolean;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { setActiveTab, setSwapPrefill } = useNavigation();
  const [guidedTour, setGuidedTour] = useState<GuidedTourState | null>(null);

  const startTour = useCallback(
    (tourId: string, totalSteps: number, initialTab: TabId, section?: string) => {
      setActiveTab(initialTab);
      setGuidedTour({
        tourId,
        currentStep: 0,
        totalSteps,
        highlightSection: section,
      });
    },
    [setActiveTab],
  );

  const nextTourStep = useCallback(
    (nextTab: TabId, section?: string, prefill?: SwapPrefill) => {
      setGuidedTour((prev) => {
        if (!prev) return prev;
        const nextStep = prev.currentStep + 1;
        return {
          ...prev,
          currentStep: nextStep,
          highlightSection: section,
        };
      });

      setActiveTab(nextTab);
      if (prefill) setSwapPrefill(prefill);
    },
    [setActiveTab, setSwapPrefill],
  );

  const exitTour = useCallback(() => {
    setGuidedTour(null);
  }, []);

  const dismissTour = useCallback(
    (tourId: string) => {
      try {
        const dismissed = JSON.parse(localStorage.getItem('dismissedTours') || '[]');
        localStorage.setItem('dismissedTours', JSON.stringify([...dismissed, tourId]));
      } catch (e) {
        console.error('Failed to dismiss tour:', e);
      }
      exitTour();
    },
    [exitTour],
  );

  const isTourDismissed = useCallback((tourId: string): boolean => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('dismissedTours') || '[]');
      return dismissed.includes(tourId);
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      guidedTour,
      startTour,
      nextTourStep,
      exitTour,
      dismissTour,
      isTourDismissed,
    }),
    [guidedTour, startTour, nextTourStep, exitTour, dismissTour, isTourDismissed],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

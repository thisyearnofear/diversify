/** First-run guided tour id — keep in sync with `components/tour/TourTrigger.tsx`. */
export const FIRST_RUN_TOUR_ID = 'first-time-user-tour';

/** Step count for the first-run tour — keep in sync with `components/tour/GuidedTour.tsx`. */
export const FIRST_RUN_TOUR_STEP_COUNT = 3;

/** Mark the post-philosophy tour as dismissed so it never stacks on StrategyModal. */
export function dismissFirstRunTour(): void {
  if (typeof window === 'undefined') return;
  try {
    const dismissed: string[] = JSON.parse(
      localStorage.getItem('dismissedTours') || '[]',
    );
    if (!dismissed.includes(FIRST_RUN_TOUR_ID)) {
      localStorage.setItem(
        'dismissedTours',
        JSON.stringify([...dismissed, FIRST_RUN_TOUR_ID]),
      );
    }
  } catch {
    // Ignore storage errors
  }
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('onboardingCompleted') === 'true';
}

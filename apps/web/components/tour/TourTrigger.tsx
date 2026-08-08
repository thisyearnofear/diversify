import { useEffect } from "react";
import { useTour } from "@/context/app/TourContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useStrategy } from "@/context/app/StrategyContext";
import {
  FIRST_RUN_TOUR_ID,
  FIRST_RUN_TOUR_STEP_COUNT,
} from "@/constants/onboarding";

/**
 * TourTrigger — Auto-starts the first-run tour on first-time visit.
 *
 * Skipped when philosophy onboarding (StrategyModal) already completed —
 * that flow calls `dismissFirstRunTour()` on finish.
 */
function migrateOldDismiss(): void {
    if (typeof window === "undefined") return;
    try {
        const oldKey = "inlineOnboardingDismissed";
        if (localStorage.getItem(oldKey) && !localStorage.getItem("dismissedTours")) {
            localStorage.setItem("dismissedTours", JSON.stringify([FIRST_RUN_TOUR_ID]));
            localStorage.removeItem(oldKey);
        }
    } catch {
        // Ignore storage errors
    }
}

export default function TourTrigger() {
    const { startTour, isTourDismissed } = useTour();
    const { userActivity } = useExperience();
    const { address } = useWalletContext();
    const { financialStrategy } = useStrategy();

    useEffect(() => {
        migrateOldDismiss();
    }, []);

    useEffect(() => {
        if (financialStrategy) return;
        if (address) return;
        if (userActivity.swapCount > 0) return;
        if (isTourDismissed(FIRST_RUN_TOUR_ID)) return;

        const timer = setTimeout(() => {
            startTour(FIRST_RUN_TOUR_ID, FIRST_RUN_TOUR_STEP_COUNT, "overview", "welcome");
        }, 800);

        return () => clearTimeout(timer);
    }, [address, userActivity.swapCount, isTourDismissed, startTour, financialStrategy]);

    return null;
}

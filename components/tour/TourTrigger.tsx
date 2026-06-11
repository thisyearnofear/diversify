import { useEffect } from "react";
import { useTour } from "@/context/app/TourContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useWalletContext } from "../wallet/WalletProvider";

const TOUR_ID = "first-time-user-tour";

/**
 * TourTrigger — Auto-starts the first-run tour on first-time visit.
 *
 * Consolidates InlineOnboarding's localStorage key into the tour's dismiss
 * system via migration: if a user previously dismissed InlineOnboarding,
 * we migrate that to the tour dismiss key so they don't see the tour.
 */
function migrateOldDismiss(): void {
    if (typeof window === "undefined") return;
    try {
        const oldKey = "inlineOnboardingDismissed";
        if (localStorage.getItem(oldKey) && !localStorage.getItem("dismissedTours")) {
            localStorage.setItem("dismissedTours", JSON.stringify([TOUR_ID]));
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

    // Migrate old InlineOnboarding dismiss key on mount
    useEffect(() => {
        migrateOldDismiss();
    }, []);

    useEffect(() => {
        if (
            !address && // Not connected yet
            userActivity.swapCount === 0 && // Never made a swap
            !isTourDismissed(TOUR_ID) // Haven't dismissed the tour
        ) {
            const timer = setTimeout(() => {
                startTour(TOUR_ID, 5, "overview", "welcome");
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [address, userActivity.swapCount, isTourDismissed, startTour]);

    return null;
}

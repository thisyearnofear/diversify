import { useEffect } from "react";
import { useAppState } from "@/context/AppStateContext";
import { useWalletContext } from "../wallet/WalletProvider";

const TOUR_ID = "first-time-user-tour";

export default function TourTrigger() {
    const { startTour, isTourDismissed, userActivity } = useAppState();
    const { address } = useWalletContext();

    useEffect(() => {
        // ENHANCED: Show tour immediately for first-time users (no delay - urgency!)
        if (
            !address && // Not connected yet
            userActivity.swapCount === 0 && // Never made a swap
            !isTourDismissed(TOUR_ID) // Haven't dismissed the tour
        ) {
            // Shorter delay - create urgency
            const timer = setTimeout(() => {
                startTour(TOUR_ID, 4, "overview", "welcome");
            }, 800);

            return () => clearTimeout(timer);
        }
    }, [address, userActivity.swapCount, isTourDismissed, startTour]);

    return null;
}

import React, { useState, useEffect } from "react";
import { useAppState } from "../../context/AppStateContext";

export default function ExperienceModeNotification() {
    const { experienceMode, userActivity, setExperienceMode } = useAppState();
    const [showNotification, setShowNotification] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Show notification when user is ready to upgrade
        if (dismissed) return;

        if (experienceMode === "beginner" && userActivity.swapCount >= 2 && userActivity.swapCount < 3) {
            setShowNotification(true);
        } else if (experienceMode === "intermediate" && userActivity.swapCount >= 8 && userActivity.swapCount < 10) {
            setShowNotification(true);
        } else {
            setShowNotification(false);
        }
    }, [experienceMode, userActivity.swapCount, dismissed]);

    const handleUpgrade = () => {
        if (experienceMode === "beginner") {
            setExperienceMode("intermediate");
        } else if (experienceMode === "intermediate") {
            setExperienceMode("advanced");
        }
        setShowNotification(false);
        setDismissed(true);
    };

    const handleDismiss = () => {
        setShowNotification(false);
        setDismissed(true);
    };

    if (!showNotification) return null;

    const getNotificationContent = () => {
        if (experienceMode === "beginner") {
            return {
                title: "Ready for More Features?",
                description: "You've completed a few swaps! Unlock regional insights and inflation protection features.",
                buttonText: "Upgrade to Standard Mode",
            };
        }
        return {
            title: "Unlock Advanced Features",
            description: "You're getting the hang of it! Enable cross-chain bridging and advanced settings.",
            buttonText: "Upgrade to Advanced Mode",
        };
    };

    const content = getNotificationContent();

    return (
        <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🎉</span>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                            {content.title}
                        </h4>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        {content.description}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleUpgrade}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                            {content.buttonText}
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

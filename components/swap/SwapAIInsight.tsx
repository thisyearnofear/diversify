import React from "react";
import { useExperience } from "../../context/app/ExperienceContext";

interface SwapAIInsightProps {
    toToken: string;
    inflationDifference: number;
    onAskAI: () => void;
}

const SwapAIInsight: React.FC<SwapAIInsightProps> = ({
    toToken,
    inflationDifference,
    onAskAI
}) => {
    const { experienceMode } = useExperience();
    const isBeginner = experienceMode === "beginner";

    if (inflationDifference <= 0) return null;

    return (
        <section
            className={`mb-3 rounded-2xl border p-3 ${isBeginner 
                ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800" 
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"}`}
            aria-label="Swap insight"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-blue-600 dark:text-blue-400 text-base flex-shrink-0" aria-hidden="true">
                        {isBeginner ? "🛡️" : "💡"}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            {isBeginner 
                                ? `Shielding with ${toToken} preserves more value`
                                : `Swapping to ${toToken} could save ~${(inflationDifference * 10).toFixed(0)} over 6 months`}
                        </p>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                            {inflationDifference.toFixed(1)}% {isBeginner ? "better protection" : "lower inflation"}
                        </p>
                    </div>
                </div>
                {!isBeginner && (
                    <button
                        onClick={onAskAI}
                        className="flex-shrink-0 whitespace-nowrap rounded-lg bg-blue-100 px-2.5 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700 dark:focus-visible:ring-offset-gray-900"
                    >
                        Ask AI
                    </button>
                )}
            </div>
        </section>
    );
};

export default SwapAIInsight;

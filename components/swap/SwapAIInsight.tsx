import React from "react";
import { useAppState } from "../../context/AppStateContext";

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
    const { experienceMode } = useAppState();
    const isBeginner = experienceMode === "beginner";

    if (inflationDifference <= 0) return null;

    return (
        <div className={`p-2 mb-3 rounded-xl border ${isBeginner 
            ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800" 
            : "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-500 rounded-r"}`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">
                        {isBeginner ? "🛡️" : "💡"}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-blue-800 dark:text-blue-200 ${isBeginner ? "text-[11px]" : "text-xs"}`}>
                            {isBeginner 
                                ? `Shielding with ${toToken} preserves more value`
                                : `Swapping to ${toToken} could save ~${(inflationDifference * 10).toFixed(0)} over 6 months`}
                        </p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">
                            {inflationDifference.toFixed(1)}% {isBeginner ? "better protection" : "lower inflation"}
                        </p>
                    </div>
                </div>
                {!isBeginner && (
                    <button
                        onClick={onAskAI}
                        className="text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors flex-shrink-0 whitespace-nowrap"
                    >
                        More →
                    </button>
                )}
            </div>
        </div>
    );
};

export default SwapAIInsight;

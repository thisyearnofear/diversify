import React from "react";

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
    if (inflationDifference <= 0) return null;

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-500 p-2 mb-3 rounded-r">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-blue-600 dark:text-blue-400 text-sm flex-shrink-0">💡</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                            Swapping to {toToken} could save ~${(inflationDifference * 10).toFixed(0)} over 6 months
                        </p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">
                            {inflationDifference.toFixed(1)}% lower inflation
                        </p>
                    </div>
                </div>
                <button
                    onClick={onAskAI}
                    className="text-blue-600 dark:text-blue-300 text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors flex-shrink-0 whitespace-nowrap"
                >
                    More →
                </button>
            </div>
        </div>
    );
};

export default SwapAIInsight;

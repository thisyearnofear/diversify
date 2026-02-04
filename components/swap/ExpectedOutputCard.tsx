import React from "react";
import RegionalIconography from "../regional/RegionalIconography";
import { REGION_COLORS } from "../../config";
import type { Region } from "../../hooks/use-user-region";

interface ExpectedOutputCardProps {
    expectedOutput: string | null;
    amount: string;
    fromToken: string;
    toToken: string;
    toTokenRegion?: string;
    mounted: boolean;
}

const ExpectedOutputCard: React.FC<ExpectedOutputCardProps> = ({
    expectedOutput,
    amount,
    fromToken,
    toToken,
    toTokenRegion,
    mounted,
}) => {
    if (!mounted || !expectedOutput || Number.parseFloat(expectedOutput) <= 0) {
        return null;
    }

    const rate = Number.parseFloat(expectedOutput) / Number.parseFloat(amount);

    return (
        <div className="relative mt-3 p-3 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 shadow-md">
            <div className="relative">
                <div className="text-xs font-bold mb-1.5 flex items-center text-gray-900 dark:text-gray-100">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-4 mr-1 text-blue-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Expected Output
                </div>
                <div className="bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="font-medium flex items-center justify-between gap-2">
                        <div className="flex-1">
                            <span className="text-xs text-gray-800 dark:text-gray-200 font-medium block">
                                You&#39;ll receive ~
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="font-bold text-xl text-blue-700 dark:text-blue-400" suppressHydrationWarning>
                                    {Number.parseFloat(expectedOutput).toFixed(4)}
                                </span>
                                <span className="font-bold text-sm text-blue-700 dark:text-blue-400">
                                    {toToken}
                                </span>
                            </div>
                        </div>
                        {toTokenRegion && (
                            <div
                                className="size-6 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                                style={{
                                    backgroundColor: toTokenRegion
                                        ? REGION_COLORS[toTokenRegion as keyof typeof REGION_COLORS]
                                        : undefined,
                                }}
                            >
                                <RegionalIconography
                                    region={toTokenRegion as Region}
                                    size="sm"
                                    className="text-white scale-75"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-1.5 text-[10px] text-gray-600 dark:text-gray-400" suppressHydrationWarning>
                    Rate: 1 {fromToken} ≈ {rate.toFixed(4)} {toToken}
                </div>
            </div>
        </div>
    );
};

export default ExpectedOutputCard;

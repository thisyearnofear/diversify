import React from "react";
import RegionalIconography from "../regional/RegionalIconography";
import { RegionalPattern } from "../regional/RegionalIconography";
import { REGION_COLORS } from "../../config";
import type { Region } from "../../hooks/use-user-region";

interface SwapActionButtonProps {
    isLoading: boolean;
    status: string;
    fromToken: string;
    toToken: string;
    fromTokenRegion?: string;
    toTokenRegion?: string;
    disabled: boolean;
    onClick: () => void;
    isBeginner?: boolean;
    zapMode?: boolean; // When true, changes button text to 'Deposit'
    disabledReason?: string | null;
    helperText?: string;
    /** When true, renders as a fixed bottom button on mobile for always-visible CTA */
    stickyMobile?: boolean;
}

const SwapActionButton: React.FC<SwapActionButtonProps> = ({
    isLoading,
    status,
    fromToken,
    toToken,
    fromTokenRegion,
    toTokenRegion,
    disabled,
    onClick,
    isBeginner = false,
    zapMode = false,
    disabledReason,
    helperText,
    stickyMobile = false,
}) => {
    // Common button content
    const buttonContent = (
        <>
            {toTokenRegion && !isLoading && (
                <div className="absolute inset-0 opacity-20">
                    <RegionalPattern region={toTokenRegion as Region} />
                </div>
            )}
            <div className="relative">
                {isLoading ? (
                    <span className="flex items-center justify-center">
                        <svg
                            className="animate-spin -ml-1 mr-3 size-6 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <span className="text-lg">
                            {status === "approving"
                                ? "Approving..."
                                : status === "swapping"
                                    ? zapMode ? "Executing..." : "Swapping..."
                                    : "Processing..."}
                        </span>
                    </span>
                ) : (
                    <div className="flex items-center justify-center">
                        {fromTokenRegion && toTokenRegion && (
                            <div className="flex items-center mr-3">
                                <div
                                    className="size-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                                    style={{
                                        backgroundColor: fromTokenRegion
                                            ? REGION_COLORS[fromTokenRegion as keyof typeof REGION_COLORS]
                                            : undefined,
                                    }}
                                >
                                    <RegionalIconography
                                        region={fromTokenRegion as Region}
                                        size="sm"
                                        className="text-white"
                                    />
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="size-6 mx-1 text-white"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <div
                                    className="size-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                                    style={{
                                        backgroundColor: toTokenRegion
                                            ? REGION_COLORS[toTokenRegion as keyof typeof REGION_COLORS]
                                            : undefined,
                                    }}
                                >
                                    <RegionalIconography
                                        region={toTokenRegion as Region}
                                        size="sm"
                                        className="text-white"
                                    />
                                </div>
                            </div>
                        )}
                        <span className="font-bold text-lg">{isBeginner ? "Protect My Savings" : zapMode ? "Zap & Deposit" : "Swap Tokens"}</span>
                        {fromToken && toToken && fromToken !== toToken && (
                            <span className="ml-3 text-sm bg-white px-3 py-1 rounded-full font-bold shadow-sm text-blue-700">
                                {fromToken} → {toToken}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    // Sticky mobile: fixed bottom button with safe-area support (mobile only)
    if (stickyMobile) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="p-3">
                    <button
                        onClick={onClick}
                        aria-disabled={disabled || isLoading}
                        aria-describedby={disabledReason || helperText ? "swap-cta-helper-mobile" : undefined}
                        className="relative w-full py-4 px-6 min-h-[56px] border-2 border-blue-700 rounded-xl shadow-lg text-base font-bold text-white overflow-hidden bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] motion-reduce:transition-none"
                        disabled={disabled || isLoading}
                    >
                        {buttonContent}
                    </button>
                    {(disabledReason || helperText) && (
                        <p
                            id="swap-cta-helper-mobile"
                            className={`mt-2 text-xs leading-5 ${disabledReason ? "text-amber-700 dark:text-amber-300" : "text-gray-600 dark:text-gray-400"}`}
                        >
                            {disabledReason || helperText}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Default: inline button (desktop behavior)
    return (
        <div className="pt-4">
            <button
                onClick={onClick}
                aria-disabled={disabled || isLoading}
                aria-describedby={disabledReason || helperText ? "swap-cta-helper" : undefined}
                className="relative w-full py-4 px-6 min-h-[56px] border-2 border-blue-700 rounded-lg shadow-lg text-base font-bold text-white overflow-hidden bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                disabled={disabled || isLoading}
            >
                {buttonContent}
            </button>
            {(disabledReason || helperText) && (
                <p
                    id="swap-cta-helper"
                    className={`mt-2 text-sm leading-6 ${disabledReason ? "text-amber-700 dark:text-amber-300" : "text-gray-600 dark:text-gray-400"}`}
                >
                    {disabledReason || helperText}
                </p>
            )}
        </div>
    );
};

export default SwapActionButton;

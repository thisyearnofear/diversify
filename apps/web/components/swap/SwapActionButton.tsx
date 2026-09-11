import React from "react";
import { haptic } from "@/lib/haptics";

interface SwapActionButtonProps {
    isLoading: boolean;
    status: string;
    disabled: boolean;
    onClick: () => void;
    isBeginner?: boolean;
    zapMode?: boolean; // When true, changes button text to 'Deposit'
    disabledReason?: string | null;
    /** When true, renders as a fixed bottom button on mobile for always-visible CTA.
     *  Never used in instrument mode — the tab dock owns the bottom edge there. */
    stickyMobile?: boolean;
}

/**
 * The Exchange tab's one CTA. Same quiet primary treatment as every other
 * instrument (bg-blue-600 rounded-xl, no border, no shadow stack, no
 * decoration overlay) — the ticket rows above already carry the pair and
 * the route, so the button only names the action (design-language §2/§3).
 */
const SwapActionButton: React.FC<SwapActionButtonProps> = ({
    isLoading,
    status,
    disabled,
    onClick,
    isBeginner = false,
    zapMode = false,
    disabledReason,
    stickyMobile = false,
}) => {
    const label = isLoading
        ? status === "approving"
            ? "Approving…"
            : status === "swapping"
                ? zapMode ? "Executing…" : "Swapping…"
                : "Processing…"
        : isBeginner
            ? "Protect My Savings"
            : zapMode
                ? "Zap & Deposit"
                : "Swap Tokens";

    const buttonContent = isLoading ? (
        <span className="flex items-center justify-center">
            <svg
                className="animate-spin -ml-1 mr-2 size-5 text-white"
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
            <span>{label}</span>
        </span>
    ) : (
        <span>{label}</span>
    );

    const buttonClass =
        "relative w-full min-h-[44px] py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none";

    // Sticky mobile: fixed bottom button with safe-area support (mobile only,
    // non-instrument contexts — in instrument mode the dock owns the bottom edge)
    if (stickyMobile) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="p-3">
                    <button
                        type="button"
                        onClick={() => { haptic("medium"); onClick(); }}
                        aria-disabled={disabled || isLoading}
                        aria-describedby={disabledReason ? "swap-cta-helper-mobile" : undefined}
                        className={buttonClass}
                        disabled={disabled || isLoading}
                    >
                        {buttonContent}
                    </button>
                    {disabledReason && (
                        <p
                            id="swap-cta-helper-mobile"
                            className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
                        >
                            {disabledReason}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Default: inline button
    return (
        <div className="pt-4">
            <button
                type="button"
                onClick={() => { haptic("medium"); onClick(); }}
                aria-disabled={disabled || isLoading}
                aria-describedby={disabledReason ? "swap-cta-helper" : undefined}
                className={buttonClass}
                disabled={disabled || isLoading}
            >
                {buttonContent}
            </button>
            {disabledReason && (
                <p
                    id="swap-cta-helper"
                    className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-300"
                >
                    {disabledReason}
                </p>
            )}
        </div>
    );
};

export default SwapActionButton;

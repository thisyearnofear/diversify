import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";

export interface GuardarianOnrampProps {
    mode?: "buy" | "sell";
    className?: string;
    compact?: boolean;
    variant?: "default" | "white" | "outline";
    defaultAmount?: string;
    defaultCurrency?: string;
}

// Guardarian widget configuration
// Partner signup required at guardarian.com/integrate-us
const GUARDARIAN_WIDGET_BASE = "https://guardarian.com/transaction";

function getNetworkParam(chainId: number | null): string {
    switch (chainId) {
        case 42161:
            return "arbitrum";
        case 1:
            return "ethereum";
        case 137:
            return "polygon";
        case 8453:
            return "base";
        case 42220:
            return "celo";
        default:
            return "arbitrum"; // Default to Arbitrum for better ARB support
    }
}

function getDefaultCrypto(chainId: number | null): string {
    switch (chainId) {
        case 42161:
            return "ARB";
        case 1:
            return "ETH";
        case 137:
            return "MATIC";
        case 8453:
            return "ETH";
        case 42220:
            return "CELO";
        default:
            return "ARB";
    }
}

export function GuardarianOnramp({
    mode = "buy",
    className = "",
    compact = false,
    variant = "default",
    defaultAmount = "100",
    defaultCurrency = "USD",
}: GuardarianOnrampProps) {
    const { address, chainId } = useWalletContext();
    const [isOpen, setIsOpen] = useState(false);
    const [widgetUrl, setWidgetUrl] = useState("");

    // Generate widget URL with parameters
    useEffect(() => {
        if (!address) return;

        const params = new URLSearchParams({
            // Core transaction params
            side: mode,
            amount: defaultAmount,
            fiat_currency: defaultCurrency,
            crypto_currency: getDefaultCrypto(chainId),
            network: getNetworkParam(chainId),

            // Wallet integration
            payout_address: address,

            // UX optimizations
            theme: "auto", // Adapts to user's system theme
            no_kyc: "true", // Enable low-KYC flow for small amounts

            // Redirect handling
            redirect_url: window.location.origin,
        });

        setWidgetUrl(`${GUARDARIAN_WIDGET_BASE}?${params.toString()}`);
    }, [address, chainId, mode, defaultAmount, defaultCurrency]);

    const getModeLabel = () => {
        switch (mode) {
            case "buy":
                return "Buy Crypto";
            case "sell":
                return "Sell Crypto";
        }
    };

    const getModeIcon = () => {
        switch (mode) {
            case "buy":
                return "⚡";
            case "sell":
                return "💰";
        }
    };

    const getButtonStyles = () => {
        if (variant === "white") {
            return "bg-white text-blue-600 hover:bg-blue-50 shadow-md border-transparent";
        }

        if (variant === "outline") {
            return "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800";
        }

        // Primary gradient for buy (Guardarian brand-aligned)
        if (mode === "buy") {
            return "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 border-transparent";
        }

        // Sell gradient
        return "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 border-transparent";
    };

    const openModal = () => {
        if (widgetUrl) {
            setIsOpen(true);
        }
    };

    const closeModal = () => {
        setIsOpen(false);
    };

    if (!address) {
        return (
            <button
                disabled
                className={`opacity-50 cursor-not-allowed ${className}`}
                title="Connect wallet first"
            >
                {getModeIcon()} {getModeLabel()}
            </button>
        );
    }

    // Compact button style
    if (compact) {
        return (
            <>
                <button
                    onClick={openModal}
                    className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
                >
                    <span>{getModeIcon()}</span>
                    <span>{getModeLabel()}</span>
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                        No KYC
                    </span>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <GuardarianModal widgetUrl={widgetUrl} onClose={closeModal} />
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Full button style
    return (
        <>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openModal}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${getButtonStyles()} ${className}`}
            >
                <span className="text-lg">{getModeIcon()}</span>
                <span>{getModeLabel()}</span>
                <span className="text-xs opacity-80 ml-1">No KYC</span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <GuardarianModal widgetUrl={widgetUrl} onClose={closeModal} />
                )}
            </AnimatePresence>
        </>
    );
}

// Modal component for iframe embed
interface GuardarianModalProps {
    widgetUrl: string;
    onClose: () => void;
}

function GuardarianModal({ widgetUrl, onClose }: GuardarianModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [showFallback, setShowFallback] = useState(false);

    // Safety timeout
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) setShowFallback(true);
        }, 6000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-white leading-tight">
                                Guardarian
                            </span>
                            <span className="text-[10px] text-green-600 dark:text-green-400">
                                No KYC • Up to €700
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Widget iframe container */}
                <div className="flex-1 relative w-full min-h-0 bg-gray-50 dark:bg-gray-900">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4" />
                            <p className="text-sm text-gray-500 font-medium">
                                Loading instant exchange...
                            </p>
                            <p className="text-xs text-gray-400 mt-2 max-w-[200px]">
                                No KYC required for amounts under €700
                            </p>

                            {showFallback && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-6"
                                >
                                    <a
                                        href={widgetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        <span>Open in browser</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                            />
                                        </svg>
                                    </a>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {hasError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            <span className="text-4xl mb-4">⚠️</span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Unable to load exchange
                            </h3>
                            <p className="text-sm text-gray-500 mb-6 max-w-[240px]">
                                Your browser might be blocking the embedded view.
                            </p>
                            <a
                                href={widgetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                            >
                                Open in New Window
                            </a>
                        </div>
                    ) : (
                        <iframe
                            src={widgetUrl}
                            title="Guardarian Exchange"
                            className={`w-full h-full border-0 transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
                            allow="payment; microphone; camera; clipboard-write"
                            onLoad={() => setIsLoading(false)}
                            onError={() => {
                                setHasError(true);
                                setIsLoading(false);
                            }}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 safe-area-pb">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5 text-green-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                            <span>Instant • No KYC</span>
                        </div>
                        <a
                            href="https://guardarian.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-500 transition-colors flex items-center gap-1"
                        >
                            <span>Info</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Convenience exports
export function BuyCryptoButtonGuardarian(props: Omit<GuardarianOnrampProps, "mode">) {
    return <GuardarianOnramp {...props} mode="buy" />;
}

export function SellCryptoButtonGuardarian(props: Omit<GuardarianOnrampProps, "mode">) {
    return <GuardarianOnramp {...props} mode="sell" />;
}

export default GuardarianOnramp;
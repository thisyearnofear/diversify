import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { GuardarianOnramp } from "./GuardarianOnramp";
import { MtPelerinOnramp } from "./MtPelerinOnramp";

export interface UnifiedOnrampProps {
    mode?: "buy" | "sell";
    className?: string;
    compact?: boolean;
    variant?: "default" | "white" | "outline";
    defaultAmount?: string;
    showProviderChoice?: boolean;
}

type OnrampProvider = "guardarian" | "mtpelerin";

export function UnifiedOnramp({
    mode = "buy",
    className = "",
    compact = false,
    variant = "default",
    defaultAmount = "100",
    showProviderChoice = false,
}: UnifiedOnrampProps) {
    const { address, chainId } = useWalletContext();
    const [selectedProvider, setSelectedProvider] = useState<OnrampProvider>("guardarian");
    const [showProviders, setShowProviders] = useState(false);

    const amount = parseFloat(defaultAmount || "100");
    const isSmallAmount = amount <= 700; // €700 Guardarian no-KYC limit

    // Network-specific provider optimization
    const getOptimalProvider = (): OnrampProvider => {
        // Both providers support Celo and Arbitrum, but optimize based on strengths
        switch (chainId) {
            case 42161: // Arbitrum - Guardarian excels with ARB support and no-KYC
                return "guardarian";
            case 42220: // Celo - For small amounts use Guardarian (no-KYC), larger amounts prefer Mt Pelerin
                return isSmallAmount ? "guardarian" : "mtpelerin";
            default:
                return "guardarian"; // Default to Guardarian for other networks
        }
    };

    // Auto-select optimal provider on network/amount change
    React.useEffect(() => {
        if (!showProviderChoice) {
            setSelectedProvider(getOptimalProvider());
        }
    }, [chainId, isSmallAmount, showProviderChoice]);

    // Get network-specific provider descriptions
    const getProviderDescription = (provider: OnrampProvider) => {
        if (provider === "guardarian") {
            switch (chainId) {
                case 42161: // Arbitrum
                    return "Recommended • ARB Support";
                case 42220: // Celo
                    return isSmallAmount ? "No KYC • Up to €700" : "No KYC • Up to €700";
                default:
                    return "No KYC • Up to €700";
            }
        } else {
            switch (chainId) {
                case 42161: // Arbitrum
                    return "Swiss Regulated";
                case 42220: // Celo
                    return isSmallAmount ? "Swiss Regulated" : "Recommended • Higher Limits";
                default:
                    return "Swiss Regulated";
            }
        }
    };

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

    // If amount is small or no provider choice needed, use optimal provider
    if (!showProviderChoice || isSmallAmount) {
        const optimalProvider = getOptimalProvider();
        return optimalProvider === "guardarian" ? (
            <GuardarianOnramp
                mode={mode}
                className={className}
                compact={compact}
                variant={variant}
                defaultAmount={defaultAmount}
            />
        ) : (
            <MtPelerinOnramp
                mode={mode}
                className={className}
                compact={compact}
                variant={variant}
            />
        );
    }

    // Compact dropdown style with provider selection
    if (compact) {
        return (
            <div className="relative">
                <button
                    onClick={() => setShowProviders(!showProviders)}
                    className={`flex items-center justify-between gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
                >
                    <div className="flex items-center gap-2">
                        <span>{getModeIcon()}</span>
                        <span>{getModeLabel()}</span>
                    </div>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform ${showProviders ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </button>

                <AnimatePresence>
                    {showProviders && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                        >
                            <GuardarianOnramp
                                mode={mode}
                                compact
                                className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            />
                            <MtPelerinOnramp
                                mode={mode}
                                compact
                                className="last:border-b-0"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Full button with provider selection
    return (
        <div className="flex items-center gap-2">
            {selectedProvider === "guardarian" ? (
                <GuardarianOnramp
                    mode={mode}
                    className={className}
                    variant={variant}
                    defaultAmount={defaultAmount}
                />
            ) : (
                <MtPelerinOnramp
                    mode={mode}
                    className={className}
                    variant={variant}
                />
            )}

            {showProviderChoice && (
                <div className="relative">
                    <button
                        onClick={() => setShowProviders(!showProviders)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Choose provider"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                            />
                        </svg>
                    </button>

                    <AnimatePresence>
                        {showProviders && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                            >
                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            setSelectedProvider("guardarian");
                                            setShowProviders(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selectedProvider === "guardarian"
                                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }`}
                                    >
                                        <span className="text-lg">⚡</span>
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">Guardarian</span>
                                            <span className="text-xs text-green-600 dark:text-green-400">
                                                {getProviderDescription("guardarian")}
                                            </span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSelectedProvider("mtpelerin");
                                            setShowProviders(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${selectedProvider === "mtpelerin"
                                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }`}
                                    >
                                        <span className="text-lg">🏦</span>
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">Mt Pelerin</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {getProviderDescription("mtpelerin")}
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

// Smart convenience exports that auto-select best provider
export function SmartBuyCryptoButton(props: Omit<UnifiedOnrampProps, "mode">) {
    return <UnifiedOnramp {...props} mode="buy" />;
}

export function SmartSellCryptoButton(props: Omit<UnifiedOnrampProps, "mode">) {
    return <UnifiedOnramp {...props} mode="sell" />;
}

export default UnifiedOnramp;
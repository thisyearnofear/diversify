import React from "react";
import { motion } from "framer-motion";

export interface GuardarianOnrampProps {
    mode?: "buy" | "sell";
    className?: string;
    compact?: boolean;
    variant?: "default" | "white" | "outline";
    defaultAmount?: string;
    defaultCurrency?: string;
}

// Guardarian - simple link to their website
const GUARDARIAN_URL = "https://guardarian.com";

export function GuardarianOnramp({
    mode = "buy",
    className = "",
    compact = false,
    variant = "default",
}: GuardarianOnrampProps) {
    // Open Guardarian in new tab
    const openGuardarian = () => {
        window.open(GUARDARIAN_URL, '_blank');
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

    // Compact button style
    if (compact) {
        return (
            <button
                onClick={openGuardarian}
                className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
            >
                <span>{getModeIcon()}</span>
                <span>{getModeLabel()}</span>
                <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                    No KYC
                </span>
            </button>
        );
    }

    // Full button style
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openGuardarian}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${getButtonStyles()} ${className}`}
        >
            <span className="text-lg">{getModeIcon()}</span>
            <span>{getModeLabel()}</span>
            <span className="text-xs opacity-80 ml-1">No KYC</span>
        </motion.button>
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

import React from "react";
import { useWalletContext } from "../wallet/WalletProvider";
import { UnifiedOnramp, UnifiedOnrampProps } from "./UnifiedOnramp";

interface NetworkOptimizedOnrampProps extends Omit<UnifiedOnrampProps, "showProviderChoice"> {
    showNetworkInfo?: boolean;
}

export function NetworkOptimizedOnramp({
    showNetworkInfo = true,
    ...props
}: NetworkOptimizedOnrampProps) {
    const { chainId } = useWalletContext();

    const getNetworkInfo = () => {
        const amount = parseFloat(props.defaultAmount || "100");
        const isSmallAmount = amount <= 700;

        switch (chainId) {
            case 42161: // Arbitrum
                return {
                    network: "Arbitrum",
                    provider: "Guardarian",
                    reason: "Optimized for ARB with no-KYC support",
                    icon: "⚡",
                };
            case 42220: // Celo
                return {
                    network: "Celo",
                    provider: isSmallAmount ? "Guardarian" : "Mt Pelerin",
                    reason: isSmallAmount
                        ? "No-KYC for amounts under €700"
                        : "Swiss regulation for larger amounts",
                    icon: isSmallAmount ? "⚡" : "🏦",
                };
            default:
                return {
                    network: "Other",
                    provider: "Guardarian",
                    reason: "Default provider with broad network support",
                    icon: "⚡",
                };
        }
    };

    const networkInfo = getNetworkInfo();

    return (
        <div className="space-y-3">
            {showNetworkInfo && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                    <span className="text-lg">{networkInfo.icon}</span>
                    <div className="flex-1">
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                            {networkInfo.provider} recommended
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 ml-1">
                            for {networkInfo.network}
                        </span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                        {networkInfo.reason}
                    </span>
                </div>
            )}

            <UnifiedOnramp
                {...props}
                showProviderChoice={false} // Auto-select optimal provider
            />
        </div>
    );
}

export default NetworkOptimizedOnramp;
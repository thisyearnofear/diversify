import React from "react";
import { NETWORKS } from "../../config";

interface ChainBreakdown {
    chainId: number;
    chainName: string;
    totalValue: number;
    tokenCount: number;
}

interface MultichainPortfolioBreakdownProps {
    regionData: Array<{ region: string; value: number; color: string }>;
    totalValue: number;
    chainBreakdown?: ChainBreakdown[];
}

interface NetworkMetadata {
    color: string;
    darkColor?: string;
    icon: string;
    description: string;
    regions: string[];
    features: string[];
}

// Network metadata for display
const NETWORK_INFO: Record<number, NetworkMetadata> = {
    [NETWORKS.CELO_MAINNET.chainId]: {
        color: "#FCFF52",
        darkColor: "#E2E600",
        icon: "🌱",
        description: "Regional Stablecoins & Mobile Money",
        regions: ["Africa", "LatAm", "Asia", "Europe"],
        features: [
            "15+ regional stablecoins",
            "Ultra-low fees (<$0.001)",
            "Mobile-first design",
            "Real-world payments"
        ]
    },
    [NETWORKS.ARBITRUM_ONE.chainId]: {
        color: "#D69E2E",
        darkColor: "#F6AD55",
        icon: "🥇",
        description: "RWA & Yield-Bearing Assets",
        regions: ["Commodities", "USA", "Europe", "Global"],
        features: [
            "Tokenized gold (PAXG)",
            "Treasury yields (USDY ~5%)",
            "DeFi lending yields",
            "Deep liquidity"
        ]
    },
    [NETWORKS.RH_TESTNET.chainId]: {
        color: "#22C55E",
        darkColor: "#4ADE80",
        icon: "🏦",
        description: "Tokenized Stock RWAs (Testnet)",
        regions: ["USA"],
        features: [
            "Stock tokens (TSLA, AMZN)",
            "Arbitrum Orbit L2",
            "Zero real-money risk",
            "Equity diversification"
        ]
    },
};

export default function MultichainPortfolioBreakdown({
    regionData,
    totalValue,
    chainBreakdown = [],
}: MultichainPortfolioBreakdownProps) {
    // Calculate network allocations from actual chain data
    const networkAllocations = React.useMemo(() => {
        const allocations: Record<string, {
            percentage: number;
            usdValue: number;
            chainId: number;
            tokenCount: number;
        }> = {};

        // Use real chain breakdown data if available
        if (chainBreakdown.length > 0) {
            chainBreakdown.forEach(chain => {
                const percentage = totalValue > 0 ? (chain.totalValue / totalValue) * 100 : 0;
                allocations[chain.chainName] = {
                    percentage,
                    usdValue: chain.totalValue,
                    chainId: chain.chainId,
                    tokenCount: chain.tokenCount,
                };
            });
        } else {
            // Fallback: derive from region data
            const celoRegions = ["Africa", "LatAm", "Asia", "Europe"];
            const arbitrumRegions = ["Commodities", "USA", "Europe", "Global"];

            let celoValue = 0;
            let arbitrumValue = 0;

            regionData.forEach(({ region, value }) => {
                const usdValue = value;
                if (celoRegions.includes(region)) {
                    celoValue += usdValue;
                } else if (arbitrumRegions.includes(region)) {
                    arbitrumValue += usdValue;
                }
            });

            if (celoValue > 0) {
                allocations["Celo"] = {
                    percentage: totalValue > 0 ? (celoValue / totalValue) * 100 : 0,
                    usdValue: celoValue,
                    chainId: NETWORKS.CELO_MAINNET.chainId,
                    tokenCount: 0,
                };
            }
            if (arbitrumValue > 0) {
                allocations["Arbitrum"] = {
                    percentage: totalValue > 0 ? (arbitrumValue / totalValue) * 100 : 0,
                    usdValue: arbitrumValue,
                    chainId: NETWORKS.ARBITRUM_ONE.chainId,
                    tokenCount: 0,
                };
            }
        }

        return allocations;
    }, [regionData, totalValue, chainBreakdown]);

    const networkEntries = Object.entries(networkAllocations)
        .filter(([, data]) => data.percentage > 0)
        .sort((a, b) => b[1].usdValue - a[1].usdValue);

    const activeChainCount = networkEntries.length;

    if (activeChainCount === 0) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">No multichain data available</p>
                <p className="text-xs text-gray-400 mt-1">
                    Deposit assets on Celo or Arbitrum to see your distribution
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Header - title and value already in DashboardCard */}
            <div className="flex items-center justify-end">
                <div className="flex -space-x-2">
                    {networkEntries.map(([name, data]) => {
                        const info = NETWORK_INFO[data.chainId];
                        return (
                            <div
                                key={name}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-white"
                                style={{ backgroundColor: info?.color || '#ccc' }}
                                title={name}
                            >
                                {info?.icon}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Network Breakdown */}
            <div className="space-y-3">
                {networkEntries.map(([network, data]) => {
                    const info = NETWORK_INFO[data.chainId];
                    if (!info) return null;

                    return (
                        <div key={network} className={`p-4 rounded-xl border-2 bg-gradient-to-br ${data.chainId === NETWORKS.CELO_MAINNET.chainId
                            ? 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
                            : data.chainId === NETWORKS.RH_TESTNET.chainId
                            ? 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800'
                            : 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800'
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                        style={{ backgroundColor: `${info.color}30` }}
                                    >
                                        {info.icon}
                                    </span>
                                    <div>
                                        <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                            {network}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{info.description}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-900 dark:text-white">{data.percentage.toFixed(1)}%</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">${data.usdValue.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Progress bar with gradient */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3">
                                <div
                                    className={`h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r ${data.chainId === NETWORKS.CELO_MAINNET.chainId
                                        ? 'from-green-500 to-emerald-500'
                                        : data.chainId === NETWORKS.RH_TESTNET.chainId
                                        ? 'from-emerald-500 to-teal-500'
                                        : 'from-blue-500 to-cyan-500'
                                        }`}
                                    style={{
                                        width: `${data.percentage}%`,
                                    }}
                                />
                            </div>

                            {/* Features */}
                            <div className="flex flex-wrap gap-1">
                                {info.features.map((feature, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[10px] px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700"
                                    >
                                        {feature}
                                    </span>
                                ))}
                            </div>

                            {/* Token count if available */}
                            {data.tokenCount > 0 && (
                                <div className="mt-2 text-[10px] text-gray-400">
                                    {data.tokenCount} token{data.tokenCount !== 1 ? 's' : ''} held
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Why Multichain */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800">
                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">Why Multichain?</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <li className="flex items-start gap-2">
                        <span>🌱</span>
                        <span><strong className="text-blue-900 dark:text-blue-200">Celo:</strong> Regional stablecoins and everyday payments</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>🥇</span>
                        <span><strong className="text-blue-900 dark:text-blue-200">Arbitrum:</strong> Yield-bearing assets and gold</span>
                    </li>
                    {networkAllocations['Robinhood Chain'] && (
                        <li className="flex items-start gap-2">
                            <span>🏦</span>
                            <span><strong className="text-blue-900 dark:text-blue-200">RH Chain:</strong> Tokenized equities (testnet)</span>
                        </li>
                    )}
                    <li className="flex items-start gap-2">
                        <span>🛡️</span>
                        <span><strong className="text-blue-900 dark:text-blue-200">Combined:</strong> Maximum protection through diversification</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

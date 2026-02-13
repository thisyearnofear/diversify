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

// Network metadata for display
const NETWORK_INFO: Record<number, {
    color: string;
    icon: string;
    description: string;
    regions: string[];
    features: string[];
}> = {
    [NETWORKS.CELO_MAINNET.chainId]: {
        color: "#FCFF52",
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
            {/* Summary Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-900">
                        {activeChainCount} Chain{activeChainCount !== 1 ? 's' : ''} Active
                    </h3>
                    <p className="text-xs text-gray-500">
                        ${totalValue.toFixed(2)} total value
                    </p>
                </div>
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
                        <div key={network} className={`p-4 rounded-xl border-2 bg-gradient-to-br ${network === 'Celo'
                            ? 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
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
                                        <span className="font-semibold text-gray-900 text-sm">{network}</span>
                                        <div className="text-xs text-gray-500">{info.description}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-900">{data.percentage.toFixed(1)}%</div>
                                    <div className="text-xs text-gray-500">${data.usdValue.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Progress bar with gradient */}
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3">
                                <div
                                    className={`h-2.5 rounded-full transition-all duration-500 bg-gradient-to-r ${network === 'Celo' ? 'from-green-500 to-emerald-500' : 'from-blue-500 to-cyan-500'
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
                                        className="text-[10px] px-2 py-0.5 bg-white rounded-full text-gray-600 border border-gray-100"
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
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <h4 className="text-xs font-bold text-blue-800 mb-2">Why Multichain?</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                    <li className="flex items-start gap-2">
                        <span>🌱</span>
                        <span><strong>Celo:</strong> Best for regional stablecoins and everyday payments</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>🥇</span>
                        <span><strong>Arbitrum:</strong> Best for yield-bearing assets and gold</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>🛡️</span>
                        <span><strong>Combined:</strong> Maximum protection through diversification</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

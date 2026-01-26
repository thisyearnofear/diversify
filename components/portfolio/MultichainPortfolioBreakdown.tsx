import React from "react";

interface MultichainPortfolioBreakdownProps {
    regionData: Array<{ region: string; value: number; color: string }>;
    totalValue: number;
}

// Network metadata for display
const NETWORK_INFO = {
    Celo: {
        color: "#FCFF52",
        icon: "🌱",
        description: "Regional Stablecoins",
        regions: ["Africa", "LatAm", "Asia"]
    },
    Arc: {
        color: "#3B82F6",
        icon: "⚡",
        description: "Global Stablecoins",
        regions: ["USA", "Europe"]
    },
    Arbitrum: {
        color: "#D69E2E",
        icon: "🥇",
        description: "Commodity Assets",
        regions: ["Commodities"]
    }
};

export default function MultichainPortfolioBreakdown({
    regionData,
    totalValue,
}: MultichainPortfolioBreakdownProps) {
    // Calculate network allocations based on region data
    const networkAllocations = React.useMemo(() => {
        const allocations = {
            Celo: 0,
            Arc: 0,
            Arbitrum: 0,
        };

        regionData.forEach(({ region, value }) => {
            if (NETWORK_INFO.Celo.regions.includes(region)) {
                allocations.Celo += value;
            } else if (NETWORK_INFO.Arc.regions.includes(region)) {
                allocations.Arc += value;
            } else if (NETWORK_INFO.Arbitrum.regions.includes(region)) {
                allocations.Arbitrum += value;
            }
        });

        return allocations;
    }, [regionData]);

    const networkEntries = Object.entries(networkAllocations).filter(([, value]) => value > 0);

    if (networkEntries.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                    Multichain Asset Distribution
                </h2>
                <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
                    Cross-Chain Portfolio
                </span>
            </div>

            {/* Network Breakdown */}
            <div className="space-y-3">
                {networkEntries.map(([network, percentage]) => {
                    const networkInfo = NETWORK_INFO[network as keyof typeof NETWORK_INFO];
                    const dollarValue = (totalValue * percentage) / 100;

                    return (
                        <div key={network} className="bg-gray-50 p-3 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                    <span className="text-lg mr-2">{networkInfo.icon}</span>
                                    <div>
                                        <span className="font-medium text-gray-900">{network} Network</span>
                                        <div className="text-xs text-gray-600">{networkInfo.description}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-gray-900">{percentage.toFixed(1)}%</div>
                                    <div className="text-sm text-gray-600">${dollarValue.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="h-2 rounded-full"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: networkInfo.color,
                                    }}
                                />
                            </div>

                            {/* Show regions for this network */}
                            <div className="mt-2 flex flex-wrap gap-1">
                                {regionData
                                    .filter(({ region }) => networkInfo.regions.includes(region))
                                    .map(({ region, value, color }) => (
                                        <span
                                            key={region}
                                            className="inline-flex items-center text-xs px-2 py-1 rounded-full border"
                                            style={{
                                                backgroundColor: `${color}20`,
                                                borderColor: color,
                                                color: color,
                                            }}
                                        >
                                            {region}: {value.toFixed(1)}%
                                        </span>
                                    ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Key Benefits */}
            <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">Multichain Advantages</h3>
                <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
                    <li>Access to best assets on each blockchain network</li>
                    <li>Reduced single-network risk through diversification</li>
                    <li>Commodity exposure via Arbitrum&apos;s liquid gold markets</li>
                    <li>Regional stablecoin access through Celo&apos;s ecosystem</li>
                    <li>Efficient bridging and cross-chain operations</li>
                </ul>
            </div>
        </div>
    );
}
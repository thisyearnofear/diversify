import React from 'react';
import { NETWORKS } from '../../config';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';

interface ChainSelectorProps {
    selectedChainId: number;
    onChainSelect: (chainId: number) => void;
    label: string;
    disabled?: boolean;
    className?: string;
    otherChainId?: number; // For bridge validation
    isBridgeMode?: boolean; // Whether this is for bridging
}

const ChainSelector: React.FC<ChainSelectorProps> = ({
    selectedChainId,
    onChainSelect,
    label,
    disabled = false,
    className = '',
    otherChainId,
    isBridgeMode = false,
}) => {
    const isDev = process.env.NODE_ENV === 'development';
    
    const allNetworks = [
        {
            ...NETWORKS.CELO_MAINNET,
            label: NETWORKS.CELO_MAINNET.name,
            icon: '🌍',
            color: 'green',
            isTestnet: false,
        },
        {
            ...NETWORKS.ALFAJORES,
            label: NETWORKS.ALFAJORES.name,
            icon: '🧪',
            color: 'amber',
            isTestnet: true,
        },
        {
            ...NETWORKS.ARBITRUM_ONE,
            label: NETWORKS.ARBITRUM_ONE.name,
            icon: '🔷',
            color: 'blue',
            isTestnet: false,
        },
        {
            ...NETWORKS.ARC_TESTNET,
            label: NETWORKS.ARC_TESTNET.name,
            icon: '⚡',
            color: 'purple',
            isTestnet: true,
        },
    ];
    
    // Filter out dev-only networks in production
    const networks = allNetworks.filter(n => {
        if (isDev) return true;
        if (n.chainId === NETWORKS.ALFAJORES.chainId && NETWORKS.ALFAJORES.devOnly) return false;
        if (n.chainId === NETWORKS.ARC_TESTNET.chainId && NETWORKS.ARC_TESTNET.devOnly) return false;
        return true;
    });

    // Helper function to check if a network combination is valid for bridging
    const isValidBridgeCombination = (chainId: number): boolean => {
        if (!isBridgeMode || !otherChainId) return true;

        const currentNetwork = networks.find(n => n.chainId === chainId);
        const otherNetwork = networks.find(n => n.chainId === otherChainId);

        if (!currentNetwork || !otherNetwork) return true;

        // Cannot bridge between testnet and mainnet
        return currentNetwork.isTestnet === otherNetwork.isTestnet;
    };

    const selectedNetwork = networks.find((n) => n.chainId === selectedChainId);

    return (
        <div className={`${className}`}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <select
                value={selectedChainId}
                onChange={(e) => onChainSelect(Number(e.target.value))}
                disabled={disabled}
                className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                }}
            >
                {networks.map((network) => {
                    const isValidForBridge = isValidBridgeCombination(network.chainId);
                    const isDisabledOption = isBridgeMode && !isValidForBridge;

                    return (
                        <option
                            key={network.chainId}
                            value={network.chainId}
                            disabled={isDisabledOption}
                            style={{
                                color: isDisabledOption ? '#9CA3AF' : 'inherit',
                                backgroundColor: isDisabledOption ? '#F3F4F6' : 'inherit'
                            }}
                        >
                            {network.icon} {network.label}
                            {isDisabledOption ? ' (Not available for bridging)' : ''}
                        </option>
                    );
                })}
            </select>

            {selectedNetwork && (
                <div className="mt-1 text-xs text-gray-500">
                    {ChainDetectionService.getNetworkName(selectedChainId)}
                </div>
            )}
        </div>
    );
};

export default ChainSelector;
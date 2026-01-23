import React from 'react';
import { NETWORKS } from '../config';
import { ChainDetectionService } from '../services/swap/chain-detection.service';

interface ChainSelectorProps {
    selectedChainId: number;
    onChainSelect: (chainId: number) => void;
    label: string;
    disabled?: boolean;
    className?: string;
}

const ChainSelector: React.FC<ChainSelectorProps> = ({
    selectedChainId,
    onChainSelect,
    label,
    disabled = false,
    className = '',
}) => {
    const networks = [
        {
            ...NETWORKS.CELO_MAINNET,
            label: 'Celo Mainnet',
            icon: '🌍',
            color: 'green',
        },
        {
            ...NETWORKS.ALFAJORES,
            label: 'Celo Alfajores',
            icon: '🧪',
            color: 'amber',
        },
        {
            ...NETWORKS.ARBITRUM_ONE,
            label: 'Arbitrum One',
            icon: '🔷',
            color: 'blue',
        },
        {
            ...NETWORKS.ARC_TESTNET,
            label: 'Arc Testnet',
            icon: '⚡',
            color: 'purple',
        },
    ];

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
                {networks.map((network) => (
                    <option key={network.chainId} value={network.chainId}>
                        {network.icon} {network.label}
                    </option>
                ))}
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
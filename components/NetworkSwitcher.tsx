import React, { useState } from 'react';
import { NETWORKS } from '../config';

interface NetworkSwitcherProps {
    currentChainId: number | null;
    onNetworkChange?: () => void;
    className?: string;
    compact?: boolean;
}

const NetworkSwitcher: React.FC<NetworkSwitcherProps> = ({
    currentChainId,
    onNetworkChange,
    className = '',
    compact = false,
}) => {
    const [isSwitching, setIsSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const networks = [
        {
            ...NETWORKS.CELO_MAINNET,
            label: 'Celo Mainnet',
            description: 'Production network',
            icon: '🌍',
            color: 'green',
        },
        {
            ...NETWORKS.ALFAJORES,
            label: 'Celo Alfajores',
            description: 'Testnet',
            icon: '🧪',
            color: 'amber',
        },
        {
            ...NETWORKS.ARC_TESTNET,
            label: 'Arc Testnet',
            description: 'Circle\'s testnet (Mainnet: 2026)',
            icon: '⚡',
            color: 'purple',
        },
        {
            ...NETWORKS.ARBITRUM_ONE,
            label: 'Arbitrum One',
            description: 'For RWA assets',
            icon: '🔷',
            color: 'blue',
        },
    ];

    const currentNetwork = networks.find((n) => n.chainId === currentChainId);

    const switchNetwork = async (chainId: number) => {
        if (!window.ethereum) {
            setError('No wallet detected');
            return;
        }

        setIsSwitching(true);
        setError(null);

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });

            // Call the callback if provided
            if (onNetworkChange) {
                onNetworkChange();
            }
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    const network = networks.find((n) => n.chainId === chainId);
                    if (!network) {
                        throw new Error('Network configuration not found');
                    }

                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: `0x${chainId.toString(16)}`,
                                chainName: network.name,
                                rpcUrls: [network.rpcUrl],
                                blockExplorerUrls: [network.explorerUrl],
                            },
                        ],
                    });

                    // Call the callback if provided
                    if (onNetworkChange) {
                        onNetworkChange();
                    }
                } catch (addError: any) {
                    setError(`Failed to add network: ${addError.message}`);
                }
            } else {
                setError(`Failed to switch network: ${switchError.message}`);
            }
        } finally {
            setIsSwitching(false);
        }
    };

    if (compact) {
        return (
            <div className={`relative ${className}`}>
                <select
                    value={currentChainId || ''}
                    onChange={(e) => switchNetwork(Number(e.target.value))}
                    disabled={isSwitching}
                    className="text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 pr-8 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
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
                {error && (
                    <div className="absolute top-full left-0 mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 whitespace-nowrap z-10">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
            <div className="p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-4 mr-1.5 text-gray-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                        />
                    </svg>
                    Network Switcher
                </h3>

                {currentNetwork && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                        <div className="text-xs text-blue-700 font-medium mb-1">Current Network</div>
                        <div className="flex items-center">
                            <span className="text-lg mr-2">{currentNetwork.icon}</span>
                            <div>
                                <div className="font-bold text-blue-900">{currentNetwork.label}</div>
                                <div className="text-xs text-blue-700">{currentNetwork.description}</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {networks.map((network) => {
                        const isActive = network.chainId === currentChainId;
                        const colorClasses = {
                            green: {
                                bg: 'bg-green-50 border-green-300',
                                hover: 'hover:bg-green-100',
                                text: 'text-green-900',
                                badge: 'bg-green-600 text-white',
                            },
                            amber: {
                                bg: 'bg-amber-50 border-amber-300',
                                hover: 'hover:bg-amber-100',
                                text: 'text-amber-900',
                                badge: 'bg-amber-600 text-white',
                            },
                            purple: {
                                bg: 'bg-purple-50 border-purple-300',
                                hover: 'hover:bg-purple-100',
                                text: 'text-purple-900',
                                badge: 'bg-purple-600 text-white',
                            },
                            blue: {
                                bg: 'bg-blue-50 border-blue-300',
                                hover: 'hover:bg-blue-100',
                                text: 'text-blue-900',
                                badge: 'bg-blue-600 text-white',
                            },
                        };

                        const colors = colorClasses[network.color as keyof typeof colorClasses];

                        return (
                            <button
                                key={network.chainId}
                                onClick={() => !isActive && switchNetwork(network.chainId)}
                                disabled={isActive || isSwitching}
                                className={`w-full p-3 rounded-md border-2 transition-all text-left ${isActive
                                        ? `${colors.bg} cursor-default`
                                        : `bg-white border-gray-200 ${colors.hover} cursor-pointer`
                                    } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">{network.icon}</span>
                                        <div>
                                            <div className={`font-bold ${isActive ? colors.text : 'text-gray-900'}`}>
                                                {network.label}
                                            </div>
                                            <div className={`text-xs ${isActive ? colors.text : 'text-gray-600'}`}>
                                                {network.description}
                                            </div>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors.badge}`}>
                                            Active
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-start">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="size-4 text-red-600 mr-2 mt-0.5 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span className="text-xs text-red-700">{error}</span>
                        </div>
                    </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                        <div className="flex items-start mb-1">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="size-3 mr-1 mt-0.5 text-gray-500 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span>
                                <strong>Arc Mainnet</strong> is not yet live. Expected launch: 2026
                            </span>
                        </div>
                        <div className="flex items-start">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="size-3 mr-1 mt-0.5 text-gray-500 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span>Switching networks will reload your balances</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkSwitcher;

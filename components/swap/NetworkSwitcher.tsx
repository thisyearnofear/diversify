import React, { useState } from 'react';
import { NETWORKS } from '../../config';
import { useWalletContext } from '../wallet/WalletProvider';

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
    const { switchNetwork: walletSwitchNetwork, isConnected } = useWalletContext();

    const allNetworks = [
        {
            ...NETWORKS.CELO_MAINNET,
            label: `${NETWORKS.CELO_MAINNET.name} (Stablecoins)`,
            description: 'Production network',
            icon: '🌍',
            color: 'green',
        },
        {
            ...NETWORKS.ALFAJORES,
            label: NETWORKS.ALFAJORES.name,
            description: 'Testnet',
            icon: '🧪',
            color: 'amber',
        },
        {
            ...NETWORKS.ARC_TESTNET,
            label: NETWORKS.ARC_TESTNET.name,
            description: 'Circle\'s testnet (Mainnet: 2026)',
            icon: '⚡',
            color: 'purple',
        },
        {
            ...NETWORKS.ARBITRUM_ONE,
            label: `${NETWORKS.ARBITRUM_ONE.name} (RWAs)`,
            description: 'For RWA assets',
            icon: '🔷',
            color: 'blue',
        },
        {
            ...NETWORKS.RH_TESTNET,
            label: `${NETWORKS.RH_TESTNET.name} (Stocks)`,
            description: 'Tokenized equities testnet',
            icon: '🏦',
            color: 'green',
        },
    ];

    // Split into mainnet and testnet (Test Drive) groups.
    // Testnet networks are ALWAYS shown in both dev and production so users
    // can access the Test Drive experience without manually adding chains.
    const mainnetNetworks = allNetworks.filter(n => {
        const cfg = Object.values(NETWORKS).find(net => net.chainId === n.chainId);
        return !(cfg && 'devOnly' in cfg && cfg.devOnly);
    });
    const testnetNetworks = allNetworks.filter(n => {
        const cfg = Object.values(NETWORKS).find(net => net.chainId === n.chainId);
        return cfg && 'devOnly' in cfg && cfg.devOnly;
    });
    // For compact select, show everything
    const networks = [...mainnetNetworks, ...testnetNetworks];

    const switchNetwork = async (chainId: number) => {
        if (!isConnected) {
            setError('No wallet connected');
            return;
        }

        setIsSwitching(true);
        setError(null);

        try {
            await walletSwitchNetwork(chainId);
            if (onNetworkChange) {
                onNetworkChange();
            }
        } catch (switchError: unknown) {
            const errorMessage = switchError instanceof Error ? switchError.message : 'Unknown error';
            setError(`Failed to switch network: ${errorMessage}`);
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
                    className="text-[10px] font-black uppercase tracking-tight bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 pr-6 text-gray-700 dark:text-gray-300 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 appearance-none cursor-pointer"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.25rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.2em 1.2em',
                    }}
                >
                    {networks.map((network) => (
                        <option key={network.chainId} value={network.chainId}>
                            {network.icon} {network.label.split(' ')[0]}
                        </option>
                    ))}
                </select>
                {error && (
                    <div className="absolute top-full right-0 mt-1 text-[8px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-800 whitespace-nowrap z-10">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Mainnet group */}
            <div className="grid grid-cols-2 gap-2">
                {mainnetNetworks.map((network) => {
                    const isActive = network.chainId === currentChainId;
                    const colorClasses: Record<string, { bg: string; hover: string; text: string }> = {
                        green: {
                            bg: 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/50',
                            hover: 'hover:bg-green-100/50 dark:hover:bg-green-900/20',
                            text: 'text-green-900 dark:text-green-100',
                        },
                        amber: {
                            bg: 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/50',
                            hover: 'hover:bg-amber-100/50 dark:hover:bg-amber-900/20',
                            text: 'text-amber-900 dark:text-amber-100',
                        },
                        purple: {
                            bg: 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-800/50',
                            hover: 'hover:bg-purple-100/50 dark:hover:bg-purple-900/20',
                            text: 'text-purple-900 dark:text-purple-100',
                        },
                        blue: {
                            bg: 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/50',
                            hover: 'hover:bg-blue-100/50 dark:hover:bg-blue-900/20',
                            text: 'text-blue-900 dark:text-blue-100',
                        },
                    };

                    const colors = colorClasses[network.color] || colorClasses.blue;

                    return (
                        <button
                            key={network.chainId}
                            onClick={() => !isActive && switchNetwork(network.chainId)}
                            disabled={isActive || isSwitching}
                            className={`p-2 rounded-xl border-2 transition-all text-left flex items-center justify-between ${isActive
                                ? `${colors.bg} ${colors.text} border-blue-500/50 cursor-default shadow-inner`
                                : `bg-white/40 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/50 ${colors.hover} text-gray-700 dark:text-gray-300 cursor-pointer`
                                } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl leading-none">{network.icon}</span>
                                <div>
                                    <div className="font-bold text-[10px] uppercase tracking-wider leading-none">
                                        {network.label.split(' ')[0]}
                                    </div>
                                    <div className="text-[9px] opacity-60 leading-none mt-0.5 truncate max-w-[80px]">
                                        {network.description}
                                    </div>
                                </div>
                            </div>
                            {isActive && (
                                <div className="size-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Test Drive group — always visible so users can enter without manual chain setup */}
            {testnetNetworks.length > 0 && (
                <>
                    <div className="flex items-center gap-2 mt-3 mb-2">
                        <span className="text-[9px] font-black text-violet-500 dark:text-violet-400 uppercase tracking-widest">🧪 Test Drive</span>
                        <div className="flex-1 h-px bg-violet-200 dark:bg-violet-900/40" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {testnetNetworks.map((network) => {
                            const isActive = network.chainId === currentChainId;
                            return (
                                <button
                                    key={network.chainId}
                                    onClick={() => !isActive && switchNetwork(network.chainId)}
                                    disabled={isActive || isSwitching}
                                    className={`p-2 rounded-xl border-2 transition-all text-left flex items-center justify-between ${isActive
                                        ? 'bg-violet-50/80 dark:bg-violet-900/20 border-violet-400/60 text-violet-900 dark:text-violet-100 cursor-default shadow-inner'
                                        : 'bg-white/40 dark:bg-gray-800/40 border-violet-100 dark:border-violet-900/30 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 text-gray-700 dark:text-gray-300 cursor-pointer'
                                        } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl leading-none">{network.icon}</span>
                                        <div>
                                            <div className="font-bold text-[10px] uppercase tracking-wider leading-none">
                                                {network.label.split(' ')[0]}
                                            </div>
                                            <div className="text-[9px] opacity-60 leading-none mt-0.5 truncate max-w-[80px]">
                                                {network.description}
                                            </div>
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="size-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {error && (
                <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-medium">
                    {error}
                </div>
            )}

            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-gray-500 dark:text-gray-500 bg-white/30 dark:bg-black/20 px-2 py-1.5 rounded-lg border border-gray-100/50 dark:border-white/5">
                <span className="shrink-0">🔄</span>
                <span>Switching networks will reload your balances</span>
            </div>
        </div>
    );
};

export default NetworkSwitcher;

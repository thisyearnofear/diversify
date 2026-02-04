/**
 * ChainBalancesHeader - Compact multichain balance overview for Swap tab
 * 
 * Shows user's balances across Celo and Arbitrum at a glance
 * Allows quick chain switching and provides visual balance indicators
 */

import React from 'react';
import { NETWORKS } from '../../config';

interface ChainBalance {
  chainId: number;
  chainName: string;
  totalValue: number;
  tokenCount: number;
  isActive: boolean;
}

interface ChainBalancesHeaderProps {
  chains: ChainBalance[];
  currentChainId: number | null;
  onSwitchChain: (chainId: number) => void;
  isLoading?: boolean;
}

const CHAIN_CONFIG: Record<number, {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  [NETWORKS.CELO_MAINNET.chainId]: {
    name: 'Celo',
    icon: '🌱',
    color: '#FCFF52',
    bgColor: 'bg-yellow-50',
    description: 'Regional stablecoins',
  },
  [NETWORKS.ARBITRUM_ONE.chainId]: {
    name: 'Arbitrum',
    icon: '🥇',
    color: '#D69E2E',
    bgColor: 'bg-amber-50',
    description: 'RWA & Yield',
  },
};

export default function ChainBalancesHeader({
  chains,
  currentChainId,
  onSwitchChain,
  isLoading = false,
}: ChainBalancesHeaderProps) {
  // Filter to only show chains with balances or the current chain
  const relevantChains = chains.filter(
    c => c.totalValue > 0 || c.chainId === currentChainId
  );

  // If no chains have balance, show both as empty states
  const displayChains = relevantChains.length > 0
    ? relevantChains
    : [
      { chainId: NETWORKS.CELO_MAINNET.chainId, chainName: 'Celo', totalValue: 0, tokenCount: 0, isActive: currentChainId === NETWORKS.CELO_MAINNET.chainId },
      { chainId: NETWORKS.ARBITRUM_ONE.chainId, chainName: 'Arbitrum', totalValue: 0, tokenCount: 0, isActive: currentChainId === NETWORKS.ARBITRUM_ONE.chainId },
    ];

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading balances...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Your Balances
        </h3>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Click to switch chain
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {displayChains.map((chain) => {
          const config = CHAIN_CONFIG[chain.chainId] || {
            name: chain.chainName || `Chain ${chain.chainId}`,
            icon: '🔗',
            color: '#A0AEC0', // Gray-400
            bgColor: 'bg-gray-50',
            description: 'Other Network',
          };
          const isCurrentChain = chain.chainId === currentChainId;
          const hasBalance = chain.totalValue > 0;

          return (
            <button
              key={chain.chainId}
              onClick={() => onSwitchChain(chain.chainId)}
              className={`relative p-2.5 rounded-lg border-2 text-left transition-all ${isCurrentChain
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
            >
              {/* Active indicator */}
              {isCurrentChain && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
              )}

              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${config.color}30` }}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {config.name}
                    </span>
                    {isCurrentChain && (
                      <span className="text-[8px] bg-blue-500 text-white px-1 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {config.description}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className={`text-sm font-bold ${hasBalance ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                  {hasBalance ? `$${chain.totalValue.toFixed(0)}` : '$0'}
                </span>
                {hasBalance && chain.tokenCount > 0 && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {chain.tokenCount} token{chain.tokenCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Total across chains */}
      {displayChains.some(c => c.totalValue > 0) && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total Value</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            ${displayChains.reduce((sum, c) => sum + c.totalValue, 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

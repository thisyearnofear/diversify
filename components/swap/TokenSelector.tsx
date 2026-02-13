import React, { useState } from "react";
import RegionalIconography from "../regional/RegionalIconography";
import type { Region } from "@/hooks/use-user-region";
import { REGION_COLORS, TOKEN_METADATA } from "../../config";
import type { UserExperienceMode, FinancialStrategy } from "@/context/AppStateContext";
import { StrategyService } from "@/services/strategy/strategy.service";


interface Token {
  symbol: string;
  name: string;
  icon?: string;
  region: string;
}

interface TokenSelectorProps {
  label: string;
  selectedToken: string;
  onTokenChange: (token: string) => void;
  amount?: string;
  onAmountChange?: (amount: string) => void;
  availableTokens: Token[];
  tokenRegion?: string;
  inflationRate?: number;
  disabled?: boolean;
  showAmountInput?: boolean;
  tokenBalances?: Record<string, { formattedBalance: string; value: number }>;
  currentChainId?: number;
  tokenChainId?: number;
  experienceMode?: UserExperienceMode;
  financialStrategy?: FinancialStrategy;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  label,
  selectedToken,
  onTokenChange,
  amount,
  onAmountChange,
  availableTokens,
  tokenRegion,
  inflationRate = 0,
  disabled = false,
  showAmountInput = true,
  tokenBalances = {},
  currentChainId,
  tokenChainId,
  experienceMode = "beginner",
  financialStrategy,
}) => {
  const isBeginnerMode = experienceMode === "beginner";
  const showRegionalInfo = experienceMode !== "beginner";

  // Check if token violates strategy
  const getComplianceInfo = (tokenSymbol: string) => {
    if (!financialStrategy) return { isCompliant: true };
    return StrategyService.getAssetCompliance(financialStrategy, tokenSymbol);
  };

  // Check if token is recommended for strategy
  const isRecommended = (tokenSymbol: string): boolean => {
    if (!financialStrategy) return false;
    const recommended = StrategyService.getRecommendedAssets(financialStrategy);
    return recommended.some(rec =>
      tokenSymbol.toUpperCase().includes(rec.toUpperCase()) ||
      rec.toUpperCase().includes(tokenSymbol.toUpperCase())
    );
  };

  // Get strategy badge for token
  const getStrategyBadge = (tokenSymbol: string): { emoji: string; label: string } | null => {
    if (!financialStrategy || !isRecommended(tokenSymbol)) return null;

    switch (financialStrategy) {
      case 'africapitalism':
        if (tokenSymbol.match(/KES|GHS|ZAR|NGN|XOF/i)) {
          return { emoji: '🌍', label: 'Builds Africa' };
        }
        break;
      case 'buen_vivir':
        if (tokenSymbol.match(/BRL|COP|MXN|ARS/i)) {
          return { emoji: '🌎', label: 'LatAm Unity' };
        }
        break;
      case 'confucian':
        if (tokenSymbol.match(/USD|EUR|USDY/i)) {
          return { emoji: '🏮', label: 'Stable Wealth' };
        }
        break;
      case 'gotong_royong':
        if (tokenSymbol.match(/PHP|IDR|THB|VND/i)) {
          return { emoji: '🤝', label: 'Community' };
        }
        break;
      case 'islamic':
        if (tokenSymbol.match(/PAXG|USDm|EURm/i)) {
          return { emoji: '☪️', label: 'Halal' };
        }
        break;
      case 'global':
        // All assets are good for global diversification
        return { emoji: '🌐', label: 'Diversifies' };
    }
    return null;
  };

  const selectedTokenCompliance = getComplianceInfo(selectedToken);
  const selectedTokenCompliant = selectedTokenCompliance.isCompliant;
  const selectedTokenBadge = getStrategyBadge(selectedToken);

  // Determine if this is a cross-chain scenario
  const isCrossChain = currentChainId && tokenChainId && currentChainId !== tokenChainId;

  // Get the current token balance if available
  const tokenBalance = tokenBalances[selectedToken];
  const hasBalance = tokenBalance && parseFloat(tokenBalance.formattedBalance) > 0;

  // Determine what to show for balance
  const getBalanceDisplay = () => {
    if (isCrossChain) {
      if (hasBalance) {
        return `${parseFloat(tokenBalance.formattedBalance).toFixed(4)} ${selectedToken}`;
      } else {
        return `— ${selectedToken}`;
      }
    } else {
      const balance = tokenBalance?.formattedBalance || "0";
      return `${parseFloat(balance).toFixed(4)} ${selectedToken}`;
    }
  };

  const getBalanceLabel = () => {
    if (isCrossChain) {
      return hasBalance ? "Balance (other chain):" : "Balance (switch to check):";
    }
    return "Balance:";
  };

  // Get region color for styling
  const regionColor = tokenRegion && tokenRegion !== 'Unknown'
    ? REGION_COLORS[tokenRegion as keyof typeof REGION_COLORS]
    : null;

  // Function to set max amount
  const setMaxAmount = () => {
    if (onAmountChange && hasBalance) {
      onAmountChange(tokenBalance.formattedBalance);
    }
  };

  // Simplified token display for beginners
  const getSimplifiedTokenName = (symbol: string) => {
    const metadata = TOKEN_METADATA[symbol];
    if (!metadata) return symbol;

    // For beginners, show friendly names without technical suffixes
    if (isBeginnerMode) {
      // Remove 'm' suffix from Mento tokens
      if (symbol.endsWith('m')) {
        const base = symbol.slice(0, -1);
        // Map to currency names
        const currencyNames: Record<string, string> = {
          'USD': 'US Dollar',
          'EUR': 'Euro',
          'BRL': 'Brazilian Real',
          'KES': 'Kenyan Shilling',
          'COP': 'Colombian Peso',
          'PHP': 'Philippine Peso',
          'GHS': 'Ghana Cedi',
          'XOF': 'CFA Franc',
          'GBP': 'British Pound',
          'ZAR': 'South African Rand',
          'CAD': 'Canadian Dollar',
          'AUD': 'Australian Dollar',
          'CHF': 'Swiss Franc',
          'JPY': 'Japanese Yen',
          'NGN': 'Nigerian Naira',
        };
        return currencyNames[base] || metadata.name;
      }
      // For other tokens, use friendly names
      if (symbol === 'USDC') return 'US Dollar';
      if (symbol === 'USDT') return 'US Dollar (Tether)';
      if (symbol === 'PAXG') return 'Gold';
    }

    return `${symbol} - ${metadata.name}`;
  };

  return (
    <div>
      <label className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
        <span className="mr-2">{label}</span>
        {showRegionalInfo && tokenRegion && tokenRegion !== 'Unknown' && (
          <div
            className="flex items-center px-2 py-1 rounded-md"
            style={{ backgroundColor: `${regionColor}30` }}
          >
            <RegionalIconography
              region={tokenRegion as Region}
              size="sm"
              className="mr-1"
            />
            <span
              className="text-xs font-bold"
              style={{ color: regionColor || '#374151' }}
            >
              {tokenRegion}
            </span>
          </div>
        )}
      </label>

      {/* Balance display - Essential for all users to understand their position */}
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={setMaxAmount}
          disabled={disabled || !hasBalance || Boolean(isCrossChain)}
          className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center transition-all ${isCrossChain && !hasBalance
            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            : hasBalance
              ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 border border-blue-100 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          title={isCrossChain ? "Balance on other chain" : "Click to use maximum amount"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-3 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          </svg>
          <span className="mr-1">{getBalanceLabel()}</span>
          {getBalanceDisplay()}
          {hasBalance && !isCrossChain && (
            <span className="ml-1.5 text-[8px] bg-blue-500 text-white px-1 rounded uppercase">MAX</span>
          )}
        </button>
      </div>

      <div className="flex space-x-2">
        <select
          value={selectedToken}
          onChange={(e) => {
            const newToken = e.target.value;
            onTokenChange(newToken);
          }}
          className={`${showAmountInput ? "w-1/3" : "w-full"
            } rounded-lg border-2 shadow-sm focus:ring-2 text-gray-900 dark:text-gray-100 font-semibold bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800 ${!selectedTokenCompliant ? 'border-red-500 dark:border-red-500' : ''
            }`}
          style={regionColor && selectedTokenCompliant ? {
            borderColor: regionColor,
          } : {}}
          disabled={disabled}
        >
          {availableTokens.map((token) => {
            const displayName = getSimplifiedTokenName(token.symbol);
            const compliance = getComplianceInfo(token.symbol);
            const badge = getStrategyBadge(token.symbol);
            return (
              <option
                key={token.symbol}
                value={token.symbol}
                className={`font-medium bg-white dark:bg-gray-900 ${compliance.isCompliant
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-400 dark:text-gray-600'
                  }`}
                disabled={!compliance.isCompliant}
              >
                {!compliance.isCompliant
                  ? `⚠️ ${displayName} (Not compliant)`
                  : badge
                    ? `${badge.emoji} ${displayName} • ${badge.label}`
                    : displayName
                }
              </option>
            );
          })}
        </select>

        {showAmountInput && onAmountChange && (
          <div className="relative w-2/3">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full rounded-lg border-2 shadow-sm focus:ring-2 text-gray-900 dark:text-gray-100 font-semibold pr-16 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-200 dark:focus:ring-blue-800"
              placeholder="Amount"
              min="0"
              step="0.01"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={setMaxAmount}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold px-2 py-1 rounded transition-colors ${!hasBalance || isCrossChain
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                }`}
              disabled={disabled || !hasBalance || Boolean(isCrossChain)}
              title={
                isCrossChain
                  ? "MAX not available for cross-chain swaps"
                  : !hasBalance
                    ? "No balance available"
                    : "Use maximum balance"
              }
            >
              MAX
            </button>
          </div>
        )}
      </div>

      {/* Strategy Violation Warning */}
      {!selectedTokenCompliant && selectedTokenCompliance.reason && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-lg shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-red-900 dark:text-red-100 uppercase tracking-wide">
                Strategy Violation
              </h4>
              <p className="text-xs text-red-800 dark:text-red-200 mt-1 leading-relaxed">
                {selectedTokenCompliance.reason}
              </p>
              {selectedTokenCompliance.alternatives && selectedTokenCompliance.alternatives.length > 0 && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-2 leading-relaxed">
                  <strong>Recommended alternatives:</strong> {selectedTokenCompliance.alternatives.join(', ')}
                </p>
              )}
              <button
                className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
              >
                I understand the risk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Positive Reinforcement Badge */}
      {selectedTokenCompliant && selectedTokenBadge && (
        <div className="mt-2 p-2.5 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg shrink-0">{selectedTokenBadge.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100 leading-relaxed">
                <span className="uppercase tracking-wide">{selectedTokenBadge.label}</span> • Aligned with your {financialStrategy?.replace('_', ' ')} strategy
              </p>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
          </div>
        </div>
      )}

      {/* Token info card - compact version, hide in beginner mode */}
      {selectedToken && showRegionalInfo && (
        <div
          className="relative mt-1.5 text-sm px-2 py-1.5 rounded-lg border-2 shadow-sm bg-white dark:bg-gray-900"
          style={regionColor ? { borderColor: regionColor } : {}}
        >
          <div className="flex w-full justify-between items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {regionColor && (
                <div
                  className="size-6 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                  style={{ backgroundColor: regionColor }}
                >
                  <RegionalIconography
                    region={tokenRegion as Region}
                    size="sm"
                    className="text-white scale-75"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block leading-tight">
                  {TOKEN_METADATA[selectedToken]?.name || selectedToken}
                </span>
                <span className="font-bold text-xs text-gray-900 dark:text-gray-100 block leading-tight">
                  {tokenRegion && tokenRegion !== 'Unknown' ? tokenRegion : "Unknown"}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm border border-gray-200 dark:border-gray-700 flex-shrink-0">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium block leading-tight">
                Inflation
              </span>
              <span
                className={`font-bold text-xs block leading-tight ${inflationRate > 5
                  ? "text-red-600 dark:text-red-400"
                  : inflationRate > 3
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
                  }`}
              >
                {isNaN(inflationRate) || inflationRate === undefined ? '—' : inflationRate.toFixed(1) + '%'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;

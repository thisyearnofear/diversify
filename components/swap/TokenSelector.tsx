import React from "react";
import RegionalIconography from "../regional/RegionalIconography";
import type { Region } from "@/hooks/use-user-region";
import { REGION_COLORS } from "../../config";

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
}) => {
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

  return (
    <div>
      <label className="text-sm font-bold text-gray-900 mb-2 flex items-center">
        <span className="mr-2">{label}</span>
        {tokenRegion && tokenRegion !== 'Unknown' && (
          <div 
            className="flex items-center px-2 py-1 rounded-md"
            style={{ backgroundColor: `${regionColor}20` }}
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
      
      {/* Balance display */}
      <div className="flex justify-end mb-1">
        <div
          className={`text-xs font-medium px-2 py-0.5 rounded-md flex items-center ${
            isCrossChain && !hasBalance 
              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
              : 'bg-gray-100 text-gray-700'
          }`}
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
          {isCrossChain && !hasBalance && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-3 ml-1 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          )}
        </div>
      </div>

      <div className="flex space-x-2">
        <select
          value={selectedToken}
          onChange={(e) => onTokenChange(e.target.value)}
          className={`${showAmountInput ? "w-1/3" : "w-full"
            } rounded-lg border-2 shadow-sm focus:ring-2 text-gray-900 font-semibold ${
              regionColor
                ? 'bg-white'
                : "border-gray-200 focus:border-blue-500 focus:ring-blue-200"
            }`}
          style={regionColor ? { 
            borderColor: regionColor,
            boxShadow: `0 0 0 3px ${regionColor}20`
          } : {}}
          disabled={disabled}
        >
          {availableTokens.map((token) => (
            <option
              key={token.symbol}
              value={token.symbol}
              className="font-medium"
            >
              {token.symbol} - {token.region}
            </option>
          ))}
        </select>

        {showAmountInput && onAmountChange && (
          <div className="relative w-2/3">
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full rounded-lg border-2 shadow-sm focus:ring-2 text-gray-900 font-semibold pr-16 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-200"
              placeholder="Amount"
              min="0"
              step="0.01"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={setMaxAmount}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold px-2 py-1 rounded transition-colors ${
                !hasBalance || isCrossChain 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
      
      {/* Token info card - improved contrast */}
      {selectedToken && (
        <div
          className="relative mt-2 text-sm px-3 py-2 rounded-lg border-2 shadow-sm bg-white"
          style={regionColor ? { borderColor: regionColor } : { borderColor: '#e5e7eb' }}
        >
          <div className="flex w-full justify-between items-center">
            <div className="flex items-center">
              {regionColor && (
                <div
                  className="mr-2 size-8 rounded-full flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: regionColor }}
                >
                  <RegionalIconography
                    region={tokenRegion as Region}
                    size="sm"
                    className="text-white"
                  />
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 font-medium block">
                  Region
                </span>
                <span className="font-bold text-base text-gray-900">
                  {tokenRegion && tokenRegion !== 'Unknown' ? tokenRegion : "Unknown"}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 px-3 py-1.5 rounded-md shadow-sm border border-gray-200">
              <span className="text-xs text-gray-500 font-medium block">
                Inflation
              </span>
              <span
                className={`font-bold text-base ${inflationRate > 5
                  ? "text-red-600"
                  : inflationRate > 3
                    ? "text-amber-600"
                    : "text-green-600"
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

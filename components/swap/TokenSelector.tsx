import React from "react";
import RegionalIconography, { RegionalPattern } from "../RegionalIconography";
import { REGION_COLORS } from "../../constants/regions";

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
}) => {
  // Get the current token balance if available
  const currentBalance = tokenBalances[selectedToken]?.formattedBalance || "0";

  // Function to set max amount
  const setMaxAmount = () => {
    if (onAmountChange && currentBalance) {
      onAmountChange(currentBalance);
    }
  };
  return (
    <div>
      <label className="text-sm font-bold text-gray-900 mb-2 flex items-center">
        <span className="mr-2">{label}</span>
        {tokenRegion && (
          <div className="flex items-center bg-gray-100 px-2 py-1 rounded-md">
            <RegionalIconography
              region={tokenRegion as any}
              size="sm"
              className="mr-1"
            />
            <span
              className={`text-xs font-medium text-region-${tokenRegion.toLowerCase()}-dark`}
            >
              {tokenRegion}
            </span>
          </div>
        )}
      </label>
      {/* Balance display - show for all tokens */}
      <div className="flex justify-end mb-1">
        <div
          className={`text-xs ${
            tokenRegion
              ? `text-region-${tokenRegion.toLowerCase()}-dark`
              : "text-gray-600"
          } font-medium px-2 py-0.5 bg-gray-100 rounded-md flex items-center`}
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
          <span className="mr-1">Balance:</span>
          {parseFloat(currentBalance).toFixed(4)} {selectedToken}
        </div>
      </div>

      <div className="flex space-x-2">
        <select
          value={selectedToken}
          onChange={(e) => onTokenChange(e.target.value)}
          className={`${
            showAmountInput ? "w-1/3" : "w-full"
          } rounded-md border shadow-md focus:ring-2 text-gray-900 font-semibold ${
            tokenRegion
              ? `border-region-${tokenRegion.toLowerCase()}-medium focus:border-region-${tokenRegion.toLowerCase()}-medium focus:ring-region-${tokenRegion.toLowerCase()}-light bg-white`
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          }`}
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
              className={`w-full rounded-md border shadow-md focus:ring-2 text-gray-900 font-semibold pr-16 ${
                tokenRegion
                  ? `border-region-${tokenRegion.toLowerCase()}-medium focus:border-region-${tokenRegion.toLowerCase()}-medium focus:ring-region-${tokenRegion.toLowerCase()}-light bg-white`
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              }`}
              placeholder="Amount"
              min="0"
              step="0.01"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={setMaxAmount}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold px-2 py-1 rounded ${
                tokenRegion
                  ? `bg-region-${tokenRegion.toLowerCase()}-light text-region-${tokenRegion.toLowerCase()}-dark hover:bg-region-${tokenRegion.toLowerCase()}-medium`
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              } transition-colors`}
              disabled={disabled}
            >
              MAX
            </button>
          </div>
        )}
      </div>
      {selectedToken && tokenRegion && (
        <div
          className={`relative mt-2 text-sm px-3 py-2 rounded-md overflow-hidden ${
            tokenRegion
              ? `bg-region-${tokenRegion.toLowerCase()}-light/30 border-2 border-region-${tokenRegion.toLowerCase()}-medium`
              : "bg-white border-2 border-gray-300"
          } shadow-md flex items-center`}
        >
          <RegionalPattern region={tokenRegion as any} className="opacity-20" />
          <div className="relative flex w-full justify-between items-center">
            <div className="flex items-center">
              {tokenRegion && (
                <div
                  className="mr-2 size-8 rounded-full flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: tokenRegion
                      ? REGION_COLORS[tokenRegion as keyof typeof REGION_COLORS]
                      : undefined,
                  }}
                >
                  <RegionalIconography
                    region={tokenRegion as any}
                    size="sm"
                    className="text-white"
                  />
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 font-medium">
                  Region
                </span>
                <div
                  className={`font-bold text-region-${tokenRegion.toLowerCase()}-dark text-base`}
                >
                  {tokenRegion || "Unknown"}
                </div>
              </div>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-md shadow-sm border border-gray-200">
              <span className="text-xs text-gray-500 font-medium block">
                Inflation
              </span>
              <span
                className={`font-bold text-base ${
                  inflationRate > 5
                    ? "text-red-600"
                    : inflationRate > 3
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {inflationRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;

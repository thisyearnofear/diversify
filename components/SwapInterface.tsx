import { useState, forwardRef, useImperativeHandle } from "react";
import { handleMentoError } from "../utils/mento-utils";
import { useInflationData } from "../hooks/use-inflation-data";
import { useStablecoinSwap } from "../hooks/use-stablecoin-swap";
import { useExpectedAmountOut } from "../hooks/use-expected-amount-out";
import { useStablecoinBalances } from "../hooks/use-stablecoin-balances";
import RegionalIconography, { RegionalPattern } from "./RegionalIconography";
import { REGION_COLORS } from "../constants/regions";
import TokenSelector from "./swap/TokenSelector";

interface Token {
  symbol: string;
  name: string;
  icon?: string;
  region: string;
}

interface SwapInterfaceProps {
  availableTokens: Token[];
  onSwap?: (
    fromToken: string,
    toToken: string,
    amount: string
  ) => Promise<void>;
  title?: string;
  address?: string | null;
  preferredFromRegion?: string;
  preferredToRegion?: string;
}

const SwapInterface = forwardRef<
  { refreshBalances: () => void },
  SwapInterfaceProps
>(function SwapInterface(
  {
    availableTokens,
    onSwap,
    title = "Swap Stablecoins",
    address,
    preferredFromRegion,
    preferredToRegion,
  },
  ref
) {
  // Find tokens from preferred regions if specified
  const defaultFromToken = preferredFromRegion
    ? availableTokens.find((token) => token.region === preferredFromRegion)
        ?.symbol ||
      availableTokens[0]?.symbol ||
      ""
    : availableTokens[0]?.symbol || "";

  const defaultToToken = preferredToRegion
    ? availableTokens.find((token) => token.region === preferredToRegion)
        ?.symbol ||
      availableTokens[1]?.symbol ||
      ""
    : availableTokens[1]?.symbol || "";

  // State for token selection and amount
  const [fromToken, setFromToken] = useState<string>(defaultFromToken);
  const [toToken, setToToken] = useState<string>(defaultToToken);
  const [amount, setAmount] = useState<string>("10");
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5); // 0.5% default

  // State for transaction status
  const [status, setStatus] = useState<
    "idle" | "approving" | "swapping" | "completed" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Get token balances
  const { balances: tokenBalances, refreshBalances } = useStablecoinBalances(
    address || ""
  );

  // Expose refreshBalances method to parent component
  useImperativeHandle(ref, () => ({
    refreshBalances: () => {
      console.log("Refreshing token balances from SwapInterface");
      refreshBalances();
    },
  }));

  // Get inflation data
  const {
    getInflationRateForStablecoin,
    getRegionForStablecoin,
    dataSource: inflationDataSource,
  } = useInflationData();

  // Use the stablecoin swap hook
  const {
    swap: performSwap,
    error: swapError,
    txHash: swapTxHash,
    isCompleted,
    chainId,
  } = useStablecoinSwap();

  // Use the expected amount out hook
  const { expectedOutput } = useExpectedAmountOut({
    fromToken,
    toToken,
    amount,
  });

  // Handle token switching
  const handleSwitchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  // Handle the swap
  const handleSwap = async () => {
    if (
      !fromToken ||
      !toToken ||
      !amount ||
      Number.parseFloat(amount) <= 0 ||
      fromToken === toToken
    ) {
      return;
    }

    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setStatus("approving");

    try {
      if (onSwap) {
        // Use the provided onSwap function if available
        await onSwap(fromToken, toToken, amount);
        setStatus("completed");
      } else {
        // Otherwise, use the stablecoin swap hook
        await performSwap({
          fromToken,
          toToken,
          amount,
          slippageTolerance,
        });

        // Update local state based on the hook's state
        if (swapTxHash) setTxHash(swapTxHash);

        // Check for errors first
        if (swapError) {
          setError(swapError);
          setStatus("error");
        } else if (isCompleted && !swapError) {
          // Only set to completed if there's no error
          setStatus("completed");

          // Refresh token balances after successful swap
          console.log("Refreshing token balances after successful swap");

          // Use a more reliable approach with multiple retries
          const refreshWithRetries = async (retries = 3, delay = 2000) => {
            for (let i = 0; i < retries; i++) {
              try {
                // Wait for the specified delay
                await new Promise((resolve) =>
                  setTimeout(resolve, delay * (i + 1))
                ); // Increase delay with each retry

                console.log(
                  `SwapInterface refresh attempt ${i + 1} of ${retries}`
                );
                await refreshBalances();

                // If we get here without an error, we can break the loop
                console.log(
                  `SwapInterface refresh attempt ${i + 1} successful`
                );
                break;
              } catch (error) {
                console.error(
                  `SwapInterface refresh attempt ${i + 1} failed:`,
                  error
                );
              }
            }
          };

          // Start the refresh process
          refreshWithRetries();
        }
      }
    } catch (error) {
      console.error("Swap error:", error);
      setError(handleMentoError(error, "swap tokens"));
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Get inflation rates for the selected tokens
  const fromTokenInflationRate = fromToken
    ? getInflationRateForStablecoin(fromToken)
    : 0;
  const toTokenInflationRate = toToken
    ? getInflationRateForStablecoin(toToken)
    : 0;
  const fromTokenRegion = fromToken ? getRegionForStablecoin(fromToken) : "";
  const toTokenRegion = toToken ? getRegionForStablecoin(toToken) : "";

  // Calculate potential inflation savings
  const inflationDifference = fromTokenInflationRate - toTokenInflationRate;
  const hasInflationBenefit = inflationDifference > 0;

  return (
    <div
      className={`relative bg-white p-5 rounded-lg shadow-md overflow-hidden SwapInterface ${
        fromTokenRegion && toTokenRegion
          ? `border-2 border-region-${toTokenRegion.toLowerCase()}-medium`
          : "border border-gray-200"
      }`}
    >
      {fromTokenRegion && toTokenRegion && (
        <div className="absolute inset-0">
          <RegionalPattern
            region={toTokenRegion as any}
            className="opacity-5"
          />
        </div>
      )}
      <div className="relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {inflationDataSource === "api" && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium border border-green-200">
              Live Inflation Data
            </span>
          )}
        </div>

        <div className="space-y-4">
          {/* From Token Selector */}
          <TokenSelector
            label="From"
            selectedToken={fromToken}
            onTokenChange={setFromToken}
            amount={amount}
            onAmountChange={setAmount}
            availableTokens={availableTokens}
            tokenRegion={fromTokenRegion}
            inflationRate={fromTokenInflationRate}
            disabled={isLoading}
            tokenBalances={tokenBalances}
          />

          <div className="flex justify-center my-3">
            <button
              onClick={handleSwitchTokens}
              className={`p-3 rounded-full transition-colors shadow-md ${
                fromTokenRegion && toTokenRegion
                  ? `bg-gradient-to-b from-region-${fromTokenRegion.toLowerCase()}-light to-region-${toTokenRegion.toLowerCase()}-light hover:from-region-${fromTokenRegion.toLowerCase()}-medium hover:to-region-${toTokenRegion.toLowerCase()}-medium border-2 border-gray-200`
                  : "bg-gradient-to-b from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border-2 border-gray-300"
              }`}
              disabled={isLoading}
              aria-label="Switch tokens"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`size-7 ${
                  fromTokenRegion && toTokenRegion
                    ? `text-gray-800`
                    : "text-gray-700"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </button>
          </div>

          {/* To Token Selector */}
          <TokenSelector
            label="To"
            selectedToken={toToken}
            onTokenChange={setToToken}
            availableTokens={availableTokens}
            tokenRegion={toTokenRegion}
            inflationRate={toTokenInflationRate}
            disabled={isLoading}
            showAmountInput={false}
            tokenBalances={tokenBalances}
          />

          {/* Expected Output */}
          {expectedOutput && Number.parseFloat(expectedOutput) > 0 && (
            <div
              className={`relative mt-4 p-4 rounded-lg overflow-hidden ${
                toTokenRegion
                  ? `bg-region-${toTokenRegion.toLowerCase()}-light/40 border-2 border-region-${toTokenRegion.toLowerCase()}-medium`
                  : "bg-gray-100 border-2 border-gray-300"
              } shadow-md`}
            >
              {toTokenRegion && (
                <RegionalPattern
                  region={toTokenRegion as any}
                  className="opacity-20"
                />
              )}
              <div className="relative">
                <div className="text-sm font-bold mb-2 flex items-center text-gray-900 bg-gray-100 p-2 rounded-md border border-gray-300 shadow-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5 mr-1 text-blue-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Expected Output
                </div>
                <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                  <div className="font-medium flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-800 font-medium">
                        You'll receive approximately
                      </span>
                      <div className="flex items-center">
                        <span className="font-bold text-2xl text-blue-700">
                          {Number.parseFloat(expectedOutput).toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center bg-gray-50 p-2 rounded-md border border-gray-200">
                      {toTokenRegion && (
                        <div
                          className="mb-1 size-8 rounded-full flex items-center justify-center shadow-sm"
                          style={{
                            backgroundColor: toTokenRegion
                              ? REGION_COLORS[
                                  toTokenRegion as keyof typeof REGION_COLORS
                                ]
                              : undefined,
                          }}
                        >
                          <RegionalIconography
                            region={toTokenRegion as any}
                            size="sm"
                            className="text-white"
                          />
                        </div>
                      )}
                      <span className="font-bold text-lg text-blue-700">
                        {toToken}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Rate: 1 {fromToken} ≈{" "}
                  {(
                    Number.parseFloat(expectedOutput) /
                    Number.parseFloat(amount)
                  ).toFixed(4)}{" "}
                  {toToken}
                </div>
              </div>
            </div>
          )}

          {/* Inflation benefit information */}
          {fromToken && toToken && hasInflationBenefit && (
            <div
              className={`relative p-4 rounded-lg overflow-hidden border-2 shadow-md ${
                toTokenRegion
                  ? `border-region-${toTokenRegion.toLowerCase()}-medium bg-region-${toTokenRegion.toLowerCase()}-light/10`
                  : "border-green-500 bg-green-50"
              }`}
            >
              {toTokenRegion && (
                <RegionalPattern region={toTokenRegion as any} />
              )}
              <div className="relative">
                <h3
                  className={`text-sm font-bold mb-2 flex items-center ${
                    toTokenRegion
                      ? `text-region-${toTokenRegion.toLowerCase()}-dark`
                      : "text-green-800"
                  }`}
                >
                  <span className="mr-2 text-lg">✨</span>
                  Inflation Protection Benefit
                </h3>
                <div className="flex items-center mb-3">
                  <div className="flex items-center">
                    {fromTokenRegion && (
                      <div
                        className="size-6 rounded-full flex items-center justify-center mr-1"
                        style={{
                          backgroundColor: fromTokenRegion
                            ? REGION_COLORS[
                                fromTokenRegion as keyof typeof REGION_COLORS
                              ]
                            : undefined,
                        }}
                      >
                        <RegionalIconography
                          region={fromTokenRegion as any}
                          size="sm"
                          className="text-white scale-75"
                        />
                      </div>
                    )}
                    <span
                      className={`font-bold mx-1 ${
                        fromTokenRegion
                          ? `text-region-${fromTokenRegion.toLowerCase()}-dark`
                          : "text-gray-900"
                      }`}
                    >
                      {fromToken}
                    </span>
                  </div>
                  <span className="mx-2 text-gray-500">→</span>
                  <div className="flex items-center">
                    {toTokenRegion && (
                      <div
                        className="size-6 rounded-full flex items-center justify-center mr-1"
                        style={{
                          backgroundColor: toTokenRegion
                            ? REGION_COLORS[
                                toTokenRegion as keyof typeof REGION_COLORS
                              ]
                            : undefined,
                        }}
                      >
                        <RegionalIconography
                          region={toTokenRegion as any}
                          size="sm"
                          className="text-white scale-75"
                        />
                      </div>
                    )}
                    <span
                      className={`font-bold mx-1 ${
                        toTokenRegion
                          ? `text-region-${toTokenRegion.toLowerCase()}-dark`
                          : "text-gray-900"
                      }`}
                    >
                      {toToken}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-sm ${
                    toTokenRegion
                      ? `text-region-${toTokenRegion.toLowerCase()}-dark`
                      : "text-gray-700"
                  }`}
                >
                  You could save approximately{" "}
                  <span className="font-bold text-green-600 text-lg">
                    {inflationDifference.toFixed(1)}%
                  </span>{" "}
                  in purchasing power per year due to lower inflation in{" "}
                  <span className="font-bold">{toTokenRegion}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Slippage Tolerance */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
            <label className="text-sm font-bold text-gray-900 mb-2 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-5 mr-1 text-gray-700"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1v-3a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Slippage Tolerance
            </label>
            <div className="flex space-x-2">
              {[0.1, 0.5, 1.0, 2.0].map((tolerance) => (
                <button
                  key={tolerance}
                  onClick={() => setSlippageTolerance(tolerance)}
                  className={`px-4 py-2 text-sm rounded-md shadow-md ${
                    slippageTolerance === tolerance
                      ? `bg-blue-600 text-white border-2 border-blue-700 font-bold`
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                  disabled={isLoading}
                >
                  {tolerance}%
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Your transaction will revert if the price changes unfavorably by
              more than this percentage.
            </div>
          </div>

          {/* Transaction Status */}
          {status !== "idle" &&
            (status === "error" ||
              status === "approving" ||
              status === "swapping" ||
              (status === "completed" && !error)) && (
              <div
                className={`p-3 rounded-card ${
                  status === "error"
                    ? "bg-accent-error/5 text-accent-error border border-accent-error/10"
                    : status === "completed"
                    ? "bg-accent-success/5 text-accent-success border border-accent-success/10"
                    : "bg-accent-info/5 text-accent-info border border-accent-info/10"
                }`}
              >
                <div className="flex items-center">
                  {status === "approving" && (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 size-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Approving token transfer...</span>
                    </>
                  )}

                  {status === "swapping" && (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 size-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Executing swap transaction...</span>
                    </>
                  )}

                  {status === "completed" && !error && (
                    <>
                      <svg
                        className="size-4 mr-2 text-accent-success"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Swap completed successfully!</span>
                    </>
                  )}

                  {status === "error" && (
                    <>
                      <svg
                        className="size-4 mr-2 text-accent-error"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>
                        {error || "An error occurred during the swap"}
                      </span>
                    </>
                  )}
                </div>

                {txHash && (
                  <div className="mt-2 text-sm border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700">
                        Transaction Hash:
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(txHash);
                          alert("Transaction hash copied to clipboard!");
                        }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md transition-colors"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex items-center">
                      <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-mono w-full overflow-hidden text-ellipsis">
                        {txHash}
                      </code>
                    </div>
                    <div className="mt-2">
                      <a
                        href={
                          chainId === 44787
                            ? `https://alfajores.celoscan.io/tx/${txHash}`
                            : `https://explorer.celo.org/mainnet/tx/${txHash}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-accent-info hover:underline bg-accent-info/10 px-3 py-1.5 rounded-md text-sm font-medium"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="size-4 mr-1"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                        View on Explorer
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

          <div className="pt-4">
            <button
              onClick={handleSwap}
              className="relative w-full py-4 px-6 border-2 border-blue-700 rounded-lg shadow-lg text-base font-bold text-white overflow-hidden bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={
                isLoading ||
                !fromToken ||
                !toToken ||
                !amount ||
                Number.parseFloat(amount) <= 0 ||
                fromToken === toToken
              }
            >
              {toTokenRegion && !isLoading && (
                <div className="absolute inset-0 opacity-20">
                  <RegionalPattern region={toTokenRegion as any} />
                </div>
              )}
              <div className="relative">
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 size-6 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-lg">
                      {status === "approving"
                        ? "Approving Transaction..."
                        : status === "swapping"
                        ? "Swapping Tokens..."
                        : "Processing..."}
                    </span>
                  </span>
                ) : (
                  <div className="flex items-center justify-center">
                    {fromTokenRegion && toTokenRegion && (
                      <div className="flex items-center mr-3">
                        <div
                          className="size-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                          style={{
                            backgroundColor: fromTokenRegion
                              ? REGION_COLORS[
                                  fromTokenRegion as keyof typeof REGION_COLORS
                                ]
                              : undefined,
                          }}
                        >
                          <RegionalIconography
                            region={fromTokenRegion as any}
                            size="sm"
                            className="text-white"
                          />
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="size-6 mx-1 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div
                          className="size-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                          style={{
                            backgroundColor: toTokenRegion
                              ? REGION_COLORS[
                                  toTokenRegion as keyof typeof REGION_COLORS
                                ]
                              : undefined,
                          }}
                        >
                          <RegionalIconography
                            region={toTokenRegion as any}
                            size="sm"
                            className="text-white"
                          />
                        </div>
                      </div>
                    )}
                    <span className="font-bold text-lg">Swap Tokens</span>
                    {fromToken && toToken && fromToken !== toToken && (
                      <span className="ml-3 text-sm bg-white px-3 py-1 rounded-full font-bold shadow-sm text-blue-700">
                        {fromToken} → {toToken}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SwapInterface;

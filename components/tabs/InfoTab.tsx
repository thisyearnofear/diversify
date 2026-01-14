import React from "react";
import { REGION_COLORS } from "../../constants/regions";

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  isInMiniPay: boolean;
  chainId: number | null;
  address: string | null;
  formatAddress: (addr: string) => string;
}

export default function InfoTab({
  availableTokens,
  isInMiniPay,
  chainId,
  address,
  formatAddress,
}: InfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          About DiversiFi
        </h2>
        <p className="text-gray-800 mb-4">
          DiversiFi helps you protect your savings from inflation by
          diversifying your stablecoin portfolio across different regions.
        </p>

        <div className="bg-blue-100 p-4 rounded-md mb-4 border border-blue-200 shadow-sm">
          <h3 className="font-bold text-blue-800 mb-2">
            Why Diversify Stablecoins?
          </h3>
          <ul className="text-sm text-gray-800 list-disc pl-5 space-y-2">
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span>Protect against inflation in your local currency</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span>Reduce risk from any single region's economic issues</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span>Maintain purchasing power across different economies</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span>Create a more resilient savings portfolio</span>
            </li>
          </ul>
        </div>

        <div className="bg-green-100 p-4 rounded-md border border-green-200 shadow-sm">
          <h3 className="font-bold text-green-800 mb-2">How It Works</h3>
          <ol className="text-sm text-gray-800 list-none pl-0 space-y-2">
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                1
              </span>
              <span>Connect your MiniPay wallet</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                2
              </span>
              <span>View your current stablecoin portfolio</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                3
              </span>
              <span>
                See personalized recommendations based on your home region
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                4
              </span>
              <span>Swap stablecoins to optimize your portfolio</span>
            </li>
          </ol>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Supported Stablecoins
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {availableTokens.map((token) => (
            <div
              key={token.symbol}
              className="p-3 rounded-md border-2 shadow-sm bg-white hover:shadow-md transition-shadow"
              style={{
                borderColor:
                  REGION_COLORS[token.region as keyof typeof REGION_COLORS],
              }}
            >
              <div className="flex items-center mb-1">
                <div
                  className="size-6 rounded-full mr-2 flex items-center justify-center text-white font-bold text-xs"
                  style={{
                    backgroundColor:
                      REGION_COLORS[token.region as keyof typeof REGION_COLORS],
                  }}
                >
                  {token.symbol.charAt(0)}
                </div>
                <div className="font-bold text-gray-900">{token.symbol}</div>
              </div>
              <div className="text-sm text-gray-700 font-medium">
                {token.name}
              </div>
              <div className="text-xs mt-2">
                <span
                  className="inline-block px-2 py-1 rounded-md font-medium text-white"
                  style={{
                    backgroundColor:
                      REGION_COLORS[token.region as keyof typeof REGION_COLORS],
                  }}
                >
                  {token.region}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Technical Details
        </h2>
        <p className="text-gray-800 mb-4">
          This app is optimized for MiniPay and works with Celo and Celo
          Alfajores Testnet.
        </p>

        <div className="bg-gray-100 rounded-md p-4 text-sm text-gray-800 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">MiniPay Status</div>
              <div className="font-bold flex items-center">
                {isInMiniPay ? (
                  <>
                    <span className="inline-block size-3 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-green-700">Detected</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block size-3 bg-gray-300 rounded-full mr-2"></span>
                    <span className="text-gray-700">Not Detected</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500 mb-1">Network</div>
                <button
                  onClick={async () => {
                    if (typeof window !== "undefined" && window.ethereum) {
                      try {
                        const chainIdHex = await window.ethereum.request({
                          method: "eth_chainId",
                        });
                        const detectedChainId = Number.parseInt(
                          chainIdHex as string,
                          16
                        );
                        alert(
                          `Network refreshed: ${
                            detectedChainId === 44787
                              ? "Celo Alfajores Testnet"
                              : detectedChainId === 42220
                              ? "Celo Mainnet"
                              : `Chain ID: ${detectedChainId}`
                          }`
                        );
                        // Force a page refresh to update all components
                        window.location.reload();
                      } catch (err) {
                        console.warn("Error refreshing chain ID:", err);
                        alert("Failed to refresh network information");
                      }
                    }
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 p-1 rounded-full transition-colors"
                  title="Refresh network"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
              <div className="font-bold">
                {chainId ? (
                  <span
                    className={
                      chainId === 44787 ? "text-amber-600" : "text-green-700"
                    }
                  >
                    {chainId === 44787 && "Alfajores Testnet"}
                    {chainId === 42220 && "Celo Mainnet"}
                    {chainId !== 44787 &&
                      chainId !== 42220 &&
                      `Chain ID: ${chainId}`}
                  </span>
                ) : (
                  <span className="text-gray-700">Not Connected</span>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">
                Ethereum Provider
              </div>
              <div className="font-bold flex items-center">
                {typeof window !== "undefined" && window.ethereum ? (
                  <>
                    <span className="inline-block size-3 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-green-700">Available</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block size-3 bg-red-500 rounded-full mr-2"></span>
                    <span className="text-red-700">Not Available</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Wallet Address</div>
              <div className="font-bold text-gray-900">
                {address ? (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(address);
                      alert("Wallet address copied to clipboard!");
                    }}
                    className="flex items-center font-mono bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    title="Click to copy wallet address"
                  >
                    <span>{formatAddress(address)}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-4 ml-1 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                ) : (
                  <span className="text-gray-500">Not Connected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { REGION_COLORS } from "../../constants/regions";
import { useWalletContext } from "../WalletProvider";
import { useToast } from "../Toast";
import NetworkSwitcher from "../NetworkSwitcher";

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
}

export default function InfoTab({
  availableTokens,
}: InfoTabProps) {
  const { address, chainId, isMiniPay, formatAddress } = useWalletContext();
  const { showToast } = useToast();
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          About DiversiFi
        </h2>
        <p className="text-sm text-gray-800 mb-4 leading-relaxed">
          DiversiFi is a <strong>multi-chain wealth protection platform</strong> that helps you safeguard your savings from inflation through strategic diversification across regional stablecoins, real-world assets (RWAs), and multiple blockchain networks.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200 shadow-sm">
            <div className="flex items-center mb-1.5">
              <span className="text-xl mr-2">🌍</span>
              <h3 className="font-bold text-sm text-green-900">Regional Stablecoins</h3>
            </div>
            <p className="text-xs text-green-800 leading-snug">
              Access 13+ regional stablecoins on <strong>Celo</strong> including cUSD, cEUR, cREAL, cKES, and more. Diversify across USA, Europe, LatAm, Africa, and Asia.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200 shadow-sm">
            <div className="flex items-center mb-1.5">
              <span className="text-xl mr-2">⚡</span>
              <h3 className="font-bold text-sm text-purple-900">Arc Testnet</h3>
            </div>
            <p className="text-xs text-purple-800 leading-snug">
              Early access to <strong>Circle&apos;s Arc Testnet</strong> with native USDC. Experience the future of stablecoin infrastructure (Mainnet: 2026).
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200 shadow-sm">
            <div className="flex items-center mb-1.5">
              <span className="text-xl mr-2">💎</span>
              <h3 className="font-bold text-sm text-blue-900">Real-World Assets</h3>
            </div>
            <p className="text-xs text-blue-800 leading-snug">
              Cross-chain bridge to <strong>Arbitrum One</strong> for RWAs: Tokenized Gold (PAXG), US Treasury Bonds (OUSG), and Yield-bearing USD (USDY).
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-3 rounded-lg border border-amber-200 shadow-sm">
            <div className="flex items-center mb-1.5">
              <span className="text-xl mr-2">🛡️</span>
              <h3 className="font-bold text-sm text-amber-900">Inflation Protection</h3>
            </div>
            <p className="text-xs text-amber-800 leading-snug">
              Live inflation data, AI-powered recommendations, and personalized strategies to protect your purchasing power.
            </p>
          </div>
        </div>

        <div className="bg-blue-100 p-4 rounded-md mb-4 border border-blue-200 shadow-sm">
          <h3 className="font-bold text-blue-800 mb-2">
            Why DiversiFi?
          </h3>
          <ul className="text-sm text-gray-800 space-y-2">
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span><strong>Multi-Chain Access:</strong> Seamlessly move between Celo, Arc Testnet, and Arbitrum</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span><strong>Geographic Diversification:</strong> Reduce risk from any single region&apos;s economic issues</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span><strong>Asset Class Diversification:</strong> Combine stablecoins with RWAs (gold, treasuries)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span><strong>Real-Time Intelligence:</strong> Live inflation data and AI-powered portfolio optimization</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block bg-blue-500 rounded-full size-4 mt-0.5 mr-2 shrink-0"></span>
              <span><strong>MiniPay Optimized:</strong> Built for mobile-first users in emerging markets</span>
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
              <span><strong>Connect Your Wallet:</strong> MiniPay, MetaMask, or any Web3 wallet</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                2
              </span>
              <span><strong>Choose Your Network:</strong> Switch between Celo, Arc Testnet, or Arbitrum</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                3
              </span>
              <span><strong>View Portfolio Analytics:</strong> See your diversification score and regional exposure</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                4
              </span>
              <span><strong>Get AI Recommendations:</strong> Personalized strategies based on your region and inflation data</span>
            </li>
            <li className="flex items-start">
              <span className="inline-flex items-center justify-center bg-green-500 text-white rounded-full size-5 mr-2 shrink-0 font-bold text-xs">
                5
              </span>
              <span><strong>Swap or Bridge:</strong> Diversify into regional stablecoins or bridge to RWAs on Arbitrum</span>
            </li>
          </ol>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Supported Assets
        </h2>

        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center">
            <span className="text-lg mr-2">🌍</span>
            Regional Stablecoins (Celo)
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Diversify across 13+ regional stablecoins on Celo Mainnet and Alfajores Testnet
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {availableTokens
            .filter((token) => !['PAXG', 'USDY', 'OUSG'].includes(token.symbol))
            .map((token) => (
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

        <div className="mb-4 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center">
            <span className="text-lg mr-2">💎</span>
            Real-World Assets (Arbitrum One)
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Cross-chain bridge from Celo to access tokenized real-world assets on Arbitrum
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <div className="p-3 rounded-lg border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-sm">
            <div className="flex items-center mb-1.5">
              <div className="size-7 rounded-full mr-2.5 flex items-center justify-center bg-yellow-400 text-white font-bold text-sm">
                🪙
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">PAXG - Paxos Gold</div>
                <div className="text-xs text-gray-600">Tokenized Physical Gold</div>
              </div>
            </div>
            <p className="text-xs text-gray-700 leading-snug">
              Each token = 1 troy oz of London Good Delivery gold in Paxos vaults.
            </p>
          </div>

          <div className="p-3 rounded-lg border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
            <div className="flex items-center mb-1.5">
              <div className="size-7 rounded-full mr-2.5 flex items-center justify-center bg-blue-400 text-white font-bold text-sm">
                🏛️
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">OUSG - Ondo US Treasuries</div>
                <div className="text-xs text-gray-600">Tokenized Short-Term US Treasury Bonds</div>
              </div>
            </div>
            <p className="text-xs text-gray-700 leading-snug">
              Institutional-grade access to short-term US Treasury bonds with stable yield.
            </p>
          </div>

          <div className="p-3 rounded-lg border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
            <div className="flex items-center mb-1.5">
              <div className="size-7 rounded-full mr-2.5 flex items-center justify-center bg-green-400 text-white font-bold text-sm">
                💵
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">USDY - Ondo USD Yield</div>
                <div className="text-xs text-gray-600">Yield-Bearing Stablecoin</div>
              </div>
            </div>
            <p className="text-xs text-gray-700 leading-snug">
              Earn yield on USD backed by short-term US Treasuries and bank deposits.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Supported Networks
        </h2>

        <div className="space-y-2.5">
          <div className="p-2.5 rounded-lg border-2 border-green-300 bg-green-50">
            <div className="flex items-center mb-1">
              <span className="text-lg mr-2">🌍</span>
              <h3 className="font-bold text-sm text-green-900">Celo Mainnet</h3>
              <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">Production</span>
            </div>
            <p className="text-xs text-green-800 leading-snug">
              Primary network for regional stablecoins. Mobile-first, carbon-negative blockchain.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border-2 border-amber-300 bg-amber-50">
            <div className="flex items-center mb-1">
              <span className="text-lg mr-2">🧪</span>
              <h3 className="font-bold text-sm text-amber-900">Celo Alfajores</h3>
              <span className="ml-auto text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-medium">Testnet</span>
            </div>
            <p className="text-xs text-amber-800 leading-snug">
              Test network for experimenting with new stablecoins and features.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border-2 border-purple-300 bg-purple-50">
            <div className="flex items-center mb-1">
              <span className="text-lg mr-2">⚡</span>
              <h3 className="font-bold text-sm text-purple-900">Arc Testnet</h3>
              <span className="ml-auto text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-medium">Testnet</span>
            </div>
            <p className="text-xs text-purple-800 leading-snug">
              Circle&apos;s next-gen blockchain with native USDC. Mainnet launching in 2026.
            </p>
          </div>

          <div className="p-2.5 rounded-lg border-2 border-blue-300 bg-blue-50">
            <div className="flex items-center mb-1">
              <span className="text-lg mr-2">🔷</span>
              <h3 className="font-bold text-sm text-blue-900">Arbitrum One</h3>
              <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">Production</span>
            </div>
            <p className="text-xs text-blue-800 leading-snug">
              Layer 2 network for accessing real-world assets (RWAs) like gold and treasuries.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Technical Details
        </h2>
        <p className="text-gray-800 mb-4">
          DiversiFi is optimized for MiniPay and works across multiple EVM-compatible networks.
        </p>

        <div className="bg-gray-100 rounded-md p-4 text-sm text-gray-800 border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">MiniPay Status</div>
              <div className="font-bold flex items-center">
                {isMiniPay ? (
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
                        showToast(
                          `Network refreshed: ${detectedChainId === 44787
                            ? "Celo Alfajores Testnet"
                            : detectedChainId === 42220
                              ? "Celo Mainnet"
                              : `Chain ID: ${detectedChainId}`
                          }`,
                          "info"
                        );
                        // Force a page refresh to update all components
                        window.location.reload();
                      } catch (err) {
                        console.warn("Error refreshing chain ID:", err);
                        showToast("Failed to refresh network information", "error");
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
                      showToast("Address copied to clipboard!", "success");
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

      <NetworkSwitcher currentChainId={chainId} className="mb-4" />
    </div>
  );
}

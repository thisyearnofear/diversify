import React from "react";
import { REGION_COLORS } from "../../config";
import { useWalletContext } from "../wallet/WalletProvider";
import { Card, CollapsibleSection, TabHeader } from "../shared/TabComponents";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";

const isDev = process.env.NODE_ENV === 'development';

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
}

export default function InfoTab({ availableTokens }: InfoTabProps) {
  const { address, chainId, isMiniPay, formatAddress } = useWalletContext();

  // Use ChainDetectionService for all chain checks
  const isCelo = ChainDetectionService.isCelo(chainId);
  const isArbitrum = ChainDetectionService.isArbitrum(chainId);

  const displayTokens = isCelo
    ? availableTokens.filter((t) => !["PAXG", "USDY", "SYRUPUSDC"].includes(t.symbol))
    : isArbitrum
      ? availableTokens.filter((t) => ["USDC", "PAXG", "USDY", "SYRUPUSDC"].includes(t.symbol))
      : availableTokens;

  const networkName = ChainDetectionService.getNetworkName(chainId);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <TabHeader title="About DiversiFi" chainId={chainId} showNetworkSwitcher={false} />

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          DiversiFi helps you protect your wealth from inflation by diversifying across regional stablecoins and real-world assets.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 rounded-r">
          <p className="text-sm text-blue-800">
            <span className="font-medium">What is DiversiFi?</span> A multi-chain platform that enables geographic diversification of your stablecoin holdings to hedge against inflation and economic instability in your region.
          </p>
        </div>

        {/* Quick Features Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "🌍", label: "Regional Stablecoins", desc: "13+ on Celo" },
            { icon: "💎", label: "Real-World Assets", desc: "Gold & Treasuries" },
            { icon: "🛡️", label: "Inflation Protection", desc: "AI-powered" },
            { icon: "⚡", label: "Multi-Chain", desc: "Celo, Arbitrum, Arc" },
          ].map((feature) => (
            <div key={feature.label} className="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg text-center">
              <span className="text-lg">{feature.icon}</span>
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{feature.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{feature.desc}</div>
            </div>
          ))}
        </div>

        {/* Educational Section */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Why Geographic Diversification?</h3>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <li>• Different economies experience different inflation rates</li>
            <li>• Economic cycles vary by region</li>
            <li>• Political stability differs across countries</li>
            <li>• Diversifying across regions reduces risk concentration</li>
          </ul>
        </div>
      </Card>

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {/* How It Works */}
        <CollapsibleSection title="How It Works" icon={<span>📋</span>}>
          <ol className="space-y-2">
            {[
              "Connect your wallet (MiniPay or MetaMask)",
              "View your diversification score",
              "Get AI-powered recommendations",
              "Swap stablecoins or bridge to RWAs",
            ].map((step, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        {/* Consolidated Network & Wallet Section */}
        <CollapsibleSection 
          title="Network & Wallet" 
          icon={<span>🌐</span>}
          badge={address && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Connected</span>}
        >
          <div className="space-y-4">
            {/* Current Network & Wallet Info */}
            {address ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <span>{isArbitrum ? "🔷" : isCelo ? "🌍" : "⚡"}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{networkName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Current Network</div>
                    </div>
                  </div>
                  {isMiniPay && (
                    <span className="text-xs bg-green-600 dark:bg-green-700 text-white px-2 py-0.5 rounded-full">
                      MiniPay
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Wallet Address</span>
                  <code className="text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">{formatAddress(address)}</code>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  💡 Connect your wallet to see available tokens on your network
                </p>
              </div>
            )}

            {/* Available Tokens on Current Network */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Available Tokens {address && `(${displayTokens.length})`}
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {displayTokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="p-2 rounded-lg border text-center bg-white dark:bg-gray-800"
                    style={{ borderColor: REGION_COLORS[token.region as keyof typeof REGION_COLORS] || "#e5e7eb" }}
                  >
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{token.symbol}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{token.region}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported Networks */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                All Supported Networks
              </h4>
              <div className="space-y-2">
                {[
                  { name: "Celo", icon: "🌍", status: "Production", color: "green", tokens: "13+ Stablecoins" },
                  { name: "Arbitrum", icon: "🔷", status: "Production", color: "blue", tokens: "4 RWA Tokens" },
                  ...(isDev ? [{ name: "Arc Testnet", icon: "⚡", status: "Coming 2026", color: "purple", tokens: "USDC, EURC" }] : []),
                ].map((network) => {
                  const isCurrentNetwork = 
                    (network.name === "Celo" && isCelo) || 
                    (network.name === "Arbitrum" && isArbitrum) ||
                    (network.name === "Arc Testnet" && !isCelo && !isArbitrum);
                  
                  return (
                    <div 
                      key={network.name} 
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                        isCurrentNetwork 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm' 
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{network.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                            {network.name}
                            {isCurrentNetwork && <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{network.tokens}</div>
                        </div>
                      </div>
                      <span className={`text-xs ${
                        network.status === "Production" 
                          ? "bg-green-600 dark:bg-green-700" 
                          : "bg-purple-600 dark:bg-purple-700"
                      } text-white px-2 py-0.5 rounded-full`}>
                        {network.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

import React from "react";
import { REGION_COLORS } from "../../constants/regions";
import { useWalletContext } from "../WalletProvider";
import { Card, CollapsibleSection, TabHeader } from "../shared/TabComponents";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";

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
    ? availableTokens.filter((t) => !["PAXG"].includes(t.symbol))
    : isArbitrum
      ? availableTokens.filter((t) => ["USDC", "PAXG"].includes(t.symbol))
      : availableTokens;

  const networkName = ChainDetectionService.getNetworkName(chainId);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <TabHeader title="About DiversiFi" chainId={chainId} showNetworkSwitcher={false} />

        <p className="text-sm text-gray-700 mb-4">
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
            <div key={feature.label} className="bg-gray-50 p-2 rounded-lg text-center">
              <span className="text-lg">{feature.icon}</span>
              <div className="text-xs font-medium text-gray-900">{feature.label}</div>
              <div className="text-xs text-gray-500">{feature.desc}</div>
            </div>
          ))}
        </div>

        {/* Educational Section */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-bold text-gray-900 mb-2">Why Geographic Diversification?</h3>
          <ul className="text-xs text-gray-700 space-y-1">
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

        {/* Available Tokens */}
        <CollapsibleSection
          title={`Available Tokens (${networkName})`}
          icon={<span>🪙</span>}
          badge={<span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{displayTokens.length}</span>}
        >
          <div className="grid grid-cols-3 gap-2">
            {displayTokens.map((token) => (
              <div
                key={token.symbol}
                className="p-2 rounded-lg border text-center"
                style={{ borderColor: REGION_COLORS[token.region as keyof typeof REGION_COLORS] || "#e5e7eb" }}
              >
                <div className="font-bold text-sm">{token.symbol}</div>
                <div className="text-xs text-gray-500">{token.region}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Supported Networks */}
        <CollapsibleSection title="Supported Networks" icon={<span>🔗</span>}>
          <div className="space-y-2">
            {[
              { name: "Celo Mainnet", icon: "🌍", status: "Production", color: "green" },
              { name: "Arbitrum One", icon: "🔷", status: "Production", color: "blue" },
              { name: "Celo Alfajores", icon: "🧪", status: "Testnet", color: "amber" },
              { name: "Arc Testnet", icon: "⚡", status: "Coming 2026", color: "purple" },
            ].map((network) => (
              <div key={network.name} className={`flex items-center justify-between p-2 bg-${network.color}-50 rounded-lg border border-${network.color}-200`}>
                <div className="flex items-center gap-2">
                  <span>{network.icon}</span>
                  <span className="text-sm font-medium">{network.name}</span>
                </div>
                <span className={`text-xs bg-${network.color}-600 text-white px-2 py-0.5 rounded-full`}>
                  {network.status}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Wallet Info - Only when connected */}
        {address && (
          <CollapsibleSection title="Wallet Info" icon={<span>👛</span>}>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Address</span>
                <code className="text-xs bg-white px-2 py-1 rounded border">{formatAddress(address)}</code>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Network</span>
                <span className="text-sm font-medium">{networkName}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">MiniPay</span>
                <span className={`text-sm font-medium ${isMiniPay ? "text-green-600" : "text-gray-500"}`}>
                  {isMiniPay ? "✓ Detected" : "Not Detected"}
                </span>
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

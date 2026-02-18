import React, { useState } from "react";
import { REGION_COLORS } from "../../config";
import { useWalletContext } from "../wallet/WalletProvider";
import { useAppState } from "../../context/AppStateContext";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";
import InflationVisualizer from "../inflation/InflationVisualizerEnhanced";
import RealWorldUseCases from "../demo/RealWorldUseCases";
import GoodDollarInfoCard from "../gooddollar/GoodDollarInfoCard";
import { Tooltip, TOOLTIPS } from "../shared/Tooltip";
import { DepositHub } from "../onramp/DepositHub";
import type { Region } from "@/hooks/use-user-region";

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  userRegion: Region;
}

export default function InfoTab({ availableTokens, userRegion }: InfoTabProps) {
  const { address, chainId, formatAddress } = useWalletContext();
  const { experienceMode } = useAppState();
  const [showNetworkInfo, setShowNetworkInfo] = useState(false);

  const isBeginner = experienceMode === "beginner";

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
    <div className="space-y-6">
      {/* Header & Hero */}
      <div className="px-1">
        <h2 className="text-[28px] font-black text-gray-900 dark:text-white leading-tight tracking-tight mb-2">
          {isBeginner ? (
            <>
              PROTECT YOUR <br />
              <span className="text-blue-600">SAVINGS</span>
            </>
          ) : (
            <>
              MASTER YOUR <br />
              <span className="text-blue-600">WEALTH JOURNEY</span>
            </>
          )}
        </h2>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-[90%]">
          {isBeginner
            ? "Your money loses value over time. We help you protect it by spreading it across different currencies."
            : <>DiversiFi helps you protect your savings from <Tooltip content={TOOLTIPS.inflation}>inflation</Tooltip> by <Tooltip content={TOOLTIPS.diversification}>diversifying</Tooltip> across regional <Tooltip content={TOOLTIPS.stablecoin}>stablecoins</Tooltip> and <Tooltip content={TOOLTIPS.rwa}>real-world assets</Tooltip>.</>
          }
        </p>
      </div>

      {/* Add Funds Hub - Critical for Onboarding */}
      <DepositHub />

      {/* Interactive Education: Inflation Protection */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="size-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center text-lg">🛡️</div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Wealth Protection</h3>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Why Diversify?</p>
          </div>
        </div>

        <InflationVisualizer
          region={userRegion}
          inflationRate={userRegion === "Africa" ? 15.4 : userRegion === "LatAm" ? 12.2 : 4.5}
          years={5}
        />
      </div>

      {/* Use Cases - Non-beginner only */}
      {!isBeginner && (
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <div className="size-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-lg">💡</div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Practical Applications</h3>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Real-World Benefits</p>
            </div>
          </div>
          <RealWorldUseCases focusRegion={userRegion} />
        </div>
      )}

      {/* GoodDollar Education */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="size-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-lg">💚</div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Universal Basic Income</h3>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Free Daily G$ on Celo</p>
          </div>
        </div>
        <GoodDollarInfoCard
          onLearnMore={() => window.open('https://docs.gooddollar.org', '_blank')}
          onStake={() => window.open('https://gooddollar.org/stake', '_blank')}
        />
      </div>





      {/* Network & Wallet (Minimized) */}
      <div className="pt-2">
        <button
          onClick={() => setShowNetworkInfo(!showNetworkInfo)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>🌐</span>
            <span>NETWORK & WALLET INFO</span>
          </div>
          <span>{showNetworkInfo ? '−' : '+'}</span>
        </button>

        {showNetworkInfo && (
          <div className="mt-2 p-4 space-y-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
            {address ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400">ACTIVE NETWORK</span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{networkName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400">WALLET</span>
                  <code className="text-xs font-mono bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                    {formatAddress(address)}
                  </code>
                </div>
              </div>
            ) : (
              <p className="text-xs text-center text-gray-500 italic">Connect wallet to view details</p>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-tighter">Available Tokens on {networkName}</h4>
              <div className="flex flex-wrap gap-2">
                {displayTokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="px-2 py-1 rounded-md border text-xs font-bold bg-white dark:bg-gray-900 flex items-center gap-1.5"
                    style={{ borderColor: REGION_COLORS[token.region as keyof typeof REGION_COLORS] || "#e5e7eb" }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: REGION_COLORS[token.region as keyof typeof REGION_COLORS] }} />
                    {token.symbol}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}

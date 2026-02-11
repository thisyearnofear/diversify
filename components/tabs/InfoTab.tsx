import React, { useState } from "react";
import { REGION_COLORS } from "../../config";
import { useWalletContext } from "../wallet/WalletProvider";
import { useAppState } from "../../context/AppStateContext";
import { Card } from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";
import InflationVisualizer from "../inflation/InflationVisualizer";
import RealWorldUseCases from "../demo/RealWorldUseCases";
import WealthJourneyWidget from "../demo/WealthJourneyWidget";
import { StreakRewardsCard, RewardsStats } from "../rewards/StreakRewardsCard";
import type { Region } from "@/hooks/use-user-region";

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  setActiveTab: (tab: string) => void;
  userRegion: Region;
}

export default function InfoTab({ availableTokens, setActiveTab, userRegion }: InfoTabProps) {
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
            : "DiversiFi helps you protect your savings from inflation by diversifying across regional stablecoins and real-world assets."
          }
        </p>
      </div>

      {/* Streak Rewards - Makes Learn tab more dynamic */}
      {address && (
        <>
          <StreakRewardsCard onSaveClick={() => setActiveTab("swap")} />
          <RewardsStats />
        </>
      )}

      {/* Show journey widget only for intermediate+ */}
      {!isBeginner && (
        <WealthJourneyWidget
          totalValue={address ? 100 : 0} // Simplified logic for demo
          setActiveTab={setActiveTab}
          userRegion={userRegion}
        />
      )}

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

      {/* Use Cases */}
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

      {/* Core Capabilities Grid - Hide for beginners */}
      {!isBeginner && (
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              title: "REGIONAL STABLECOINS",
              desc: "Hold digital dollars pegged to local economies (KES, PHP, BRL) to hedge regional risks.",
              icon: "🌍",
              color: "blue"
            },
            {
              title: "REAL-WORLD ASSETS",
              desc: "Direct access to tokenized Gold (PAXG) and US Treasuries (USDY) on Arbitrum.",
              icon: "💎",
              color: "emerald"
            }
          ].map((cap) => (
            <div key={cap.title} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="text-2xl mb-3">{cap.icon}</div>
              <h4 className="text-[10px] font-black text-gray-900 dark:text-white mb-2 tracking-wider">{cap.title}</h4>
              <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{cap.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Simplified How It Works */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">The Process</h3>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">4 EASY STEPS</span>
        </div>
        <div className="space-y-4">
          {[
            { step: 1, text: "Connect your wallet via MiniPay or MetaMask", done: !!address },
            { step: 2, text: "Analyze your local inflation risk profile", done: true },
            { step: 3, text: "Get AI-powered diversification picks", done: false },
            { step: 4, text: "Execute swaps or bridge to RWAs", done: false },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black ${item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                {item.done ? '✓' : item.step}
              </div>
              <span className={`text-xs font-medium ${item.done ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </Card>

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
                  <span className="text-[10px] font-black text-gray-400">ACTIVE NETWORK</span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{networkName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400">WALLET</span>
                  <code className="text-[10px] font-mono bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                    {formatAddress(address)}
                  </code>
                </div>
              </div>
            ) : (
              <p className="text-xs text-center text-gray-500 italic">Connect wallet to view details</p>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-[10px] font-black text-gray-400 mb-3 uppercase tracking-tighter">Available Tokens on {networkName}</h4>
              <div className="flex flex-wrap gap-2">
                {displayTokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="px-2 py-1 rounded-md border text-[10px] font-bold bg-white dark:bg-gray-900 flex items-center gap-1.5"
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

      {/* Mission Statement */}
      <div className="text-center px-4 py-8">
        <div className="text-2xl mb-2 opacity-20">🌍</div>
        <h3 className="text-xs font-black text-gray-300 uppercase tracking-[0.2em] mb-4">OUR MISSION</h3>
        <p className="text-sm font-medium text-gray-500 leading-relaxed italic">
          &quot;Democratizing access to global wealth preservation tools for everyone, everywhere.&quot;
        </p>
      </div>
    </div>
  );
}

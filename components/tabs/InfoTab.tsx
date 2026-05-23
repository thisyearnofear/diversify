import React, { useState } from "react";
import { REGION_COLORS } from "../../config";
import { useWalletContext } from "../wallet/WalletProvider";
import { useExperience } from "../../context/app/ExperienceContext";
import { ChainDetectionService } from "@diversifi/shared";
import InflationVisualizer from "../inflation/InflationVisualizerEnhanced";
import RealWorldUseCases from "../demo/RealWorldUseCases";
import GoodDollarInfoCard from "../gooddollar/GoodDollarInfoCard";
import { Tooltip, TOOLTIPS } from "../shared/Tooltip";
import { DepositHub } from "../onramp/DepositHub";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
import type { Region } from "@/hooks/use-user-region";
import InfoSkeleton from "../ui/skeletons/InfoSkeleton";
import { VerifiableAIDashboard } from "../agent/VerifiableAIDashboard";

interface InfoTabProps {
  availableTokens: Array<{
    symbol: string;
    name: string;
    region: string;
  }>;
  userRegion: Region;
  isLoading?: boolean;
}

export default function InfoTab({ availableTokens, userRegion, isLoading }: InfoTabProps) {
  const { address, chainId, formatAddress } = useWalletContext();
  const { experienceMode } = useExperience();
  const { streak, canClaim, isWhitelisted, estimatedReward, verifyIdentity } = useStreakRewards();
  const [showNetworkInfo, setShowNetworkInfo] = useState(false);

  const isBeginner = experienceMode === "beginner";

  if (isLoading) {
    return <InfoSkeleton />;
  }

  // Use ChainDetectionService for all chain checks
  const isCelo = ChainDetectionService.isCelo(chainId ?? null);
  const isArbitrum = ChainDetectionService.isArbitrum(chainId ?? null);

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

      {/* Add Funds Hub - Beginner only */}
      {isBeginner && <DepositHub />}

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

      {/* Practical Applications - Non-beginner only */}
      {!isBeginner && <RealWorldUseCases />}

      {/* GoodDollar Hub — consolidated claim + education + streaming */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="relative size-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-lg">
            💚
            {canClaim && (
              <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              Universal Basic Income
              {canClaim && <span className="text-emerald-500 text-xs">• Ready</span>}
            </h3>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Free Daily G$ on Celo</p>
          </div>
        </div>
        <GoodDollarInfoCard
          streak={streak}
          canClaim={canClaim}
          isWhitelisted={isWhitelisted}
          estimatedReward={estimatedReward}
          onVerify={() => verifyIdentity()}
          onLearnMore={() => window.open('https://docs.gooddollar.org', '_blank')}
          // TODO: Replace with in-app staking flow when GoodStaking contract is integrated
          onStake={() => window.open('https://gooddollar.org/stake', '_blank')}
        />
      </div>





      {/* Network & Wallet (Minimized) */}
      <div className="pt-2">
        <button
          onClick={() => setShowNetworkInfo(!showNetworkInfo)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span>🌐</span>
            <span>NETWORK & WALLET INFO</span>
          </div>
          <span>{showNetworkInfo ? '−' : '+'}</span>
        </button>

        {showNetworkInfo && (
          <div className="mt-2 p-4 space-y-4 bg-white dark:bg-gray-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg">
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

      {/* Verifiability & Security — technical detail for the curious, out of the way for everyone else */}
      <VerifiabilitySection />

    </div>
  );
}


// ============================================================================
// Verifiability Section — canonical home for the technical detail.
// Accessible from the Info tab; not in the face of consumer users.
// ============================================================================

function VerifiabilitySection() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      <div className="pt-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>VERIFIABILITY & SECURITY</span>
          </div>
          <span>{isOpen ? '−' : '+'}</span>
        </button>

        {isOpen && (
          <div className="mt-2 p-4 space-y-4 bg-white dark:bg-gray-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Every AI recommendation is traceable end-to-end: from the model that produced it, to the evidence that supports it, to the on-chain record that proves it.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="font-black text-gray-400 uppercase tracking-wider mb-1">0G Storage</div>
                <p className="text-gray-600 dark:text-gray-400">Evidence CIDs anchored to decentralized storage</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="font-black text-gray-400 uppercase tracking-wider mb-1">0G Serving</div>
                <p className="text-gray-600 dark:text-gray-400">Decentralized AI inference via Router API</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="font-black text-gray-400 uppercase tracking-wider mb-1">0G Chain</div>
                <p className="text-gray-600 dark:text-gray-400">RecommendationLedger contract on Galileo testnet</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="font-black text-gray-400 uppercase tracking-wider mb-1">Arc x402</div>
                <p className="text-gray-600 dark:text-gray-400">Nanopayment settlement for premium data access</p>
              </div>
            </div>

            <button
              onClick={() => setShowDashboard(true)}
              className="w-full py-3 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-colors active:scale-95"
            >
              Open Verifiable AI Dashboard →
            </button>
          </div>
        )}
      </div>

      <VerifiableAIDashboard isOpen={showDashboard} onClose={() => setShowDashboard(false)} />
    </>
  );
}

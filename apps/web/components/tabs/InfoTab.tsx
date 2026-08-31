/**
 * Info — short reference: why protect, G$ on Celo, deposit for beginners.
 * Not a second Home.
 */

import React, { useState } from "react";
import { REGION_COLORS } from "../../config";
import { useWalletContext } from "../wallet/WalletProvider";
import { useExperience } from "../../context/app/ExperienceContext";
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import InflationVisualizer from "../inflation/InflationVisualizerEnhanced";
import GoodDollarInfoCard from "../gooddollar/GoodDollarInfoCard";
import { DepositHub } from "../onramp/DepositHub";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
import { useClaimFlowContext } from "@/hooks/claim-flow-context";
import type { Region } from "@/hooks/use-user-region";
import InfoSkeleton from "../ui/skeletons/InfoSkeleton";
import { VerifiableAIDashboard } from "../agent/VerifiableAIDashboard";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";

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
  const flow = useClaimFlowContext();
  const [trustOpen, setTrustOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const isBeginner = experienceMode === "beginner";
  const isCelo = ChainDetectionService.isCelo(chainId ?? null);
  const isArbitrum = ChainDetectionService.isArbitrum(chainId ?? null);
  const networkName = ChainDetectionService.getNetworkName(chainId);

  const displayTokens = isCelo
    ? availableTokens.filter((t) => !["PAXG", "USDY", "SYRUPUSDC"].includes(t.symbol))
    : isArbitrum
      ? availableTokens.filter((t) => ["USDC", "PAXG", "USDY", "SYRUPUSDC"].includes(t.symbol))
      : availableTokens;

  if (isLoading) {
    return <InfoSkeleton />;
  }

  const object = (
    <div className="space-y-6">
      <div className="px-1">
        <h2 className="text-[28px] font-black text-gray-900 dark:text-white leading-tight tracking-tight mb-2">
          {isBeginner ? (
            <>
              PROTECT YOUR <br />
              <span className="text-blue-600">SAVINGS</span>
            </>
          ) : (
            <>How protection works</>
          )}
        </h2>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 max-w-[90%]">
          Your money loses value over time. Spreading it across currencies and
          real-world assets is how DiversiFi slows that loss.
        </p>
      </div>

      {isBeginner && <DepositHub />}

      <InflationVisualizer
        region={userRegion}
        inflationRate={userRegion === "Africa" ? 15.4 : userRegion === "LatAm" ? 12.2 : 4.5}
        years={5}
      />

      {(!address || isCelo) && (
        <GoodDollarInfoCard
          streak={streak}
          canClaim={canClaim}
          isWhitelisted={isWhitelisted}
          estimatedReward={estimatedReward}
          onClaim={() => void flow.handleClaim()}
          onVerify={() => verifyIdentity()}
          onLearnMore={() => window.open("https://docs.gooddollar.org", "_blank")}
        />
      )}
    </div>
  );

  return (
    <>
      <InstrumentShell
        object={object}
        inspector={
          <InspectorSheet
            selectedId={trustOpen ? "trust" : null}
            onClose={() => setTrustOpen(false)}
            title="How we prove it"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              Every high-impact recommendation is anchored to 0G Storage and
              recorded on the RecommendationLedger.
            </p>
            {address && (
              <p className="text-xs text-gray-500 mb-3">
                {networkName}
                {address ? ` · ${formatAddress(address)}` : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {displayTokens.map((token) => (
                <span
                  key={token.symbol}
                  className="px-2 py-1 rounded-md border text-xs font-bold"
                  style={{
                    borderColor:
                      REGION_COLORS[token.region as keyof typeof REGION_COLORS] ||
                      "#e5e7eb",
                  }}
                >
                  {token.symbol}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowDashboard(true)}
              className="min-h-[44px] w-full py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Open verifiable AI dashboard
            </button>
          </InspectorSheet>
        }
        status={
          <button
            type="button"
            onClick={() => setTrustOpen(true)}
            className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600"
          >
            How we prove recommendations
          </button>
        }
      />
      <VerifiableAIDashboard isOpen={showDashboard} onClose={() => setShowDashboard(false)} />
    </>
  );
}

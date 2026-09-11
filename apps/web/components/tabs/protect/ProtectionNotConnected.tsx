/**
 * ProtectionNotConnected — Shield's unconnected morph.
 *
 * §5 rail 5 (unconnected is a morph too): when a philosophy is resolvable
 * the ghost plan ring leads the object — walletless, so it renders the
 * plan's slices with a "Connect to fund" hole — and the picker sits
 * beneath it; tapping a card commits and re-slices the ring. With no
 * philosophy the picker alone is the object. The connect CTA attaches
 * below; trust + demo live in the shared status tier. No hero card, no
 * proof card, no how-it-works stack.
 *
 * Persona morphs the object (rail 4): an APAC philosophy shows the APAC
 * honesty banner in the status tier; a Caribbean philosophy shows the
 * Caribbean one. The live proof ticker rides along as a status-tier line.
 */

import React from "react";
import WalletButton from "../../wallet/WalletButton";
import type { UserExperienceMode } from "@/context/app/types";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { shieldPatternFor } from "./shield-pattern";
import { UnconnectedStatusTier } from "../../shared/UnconnectedStatusTier";
import { ProtectionPlanGallery } from "./ProtectionPlanGallery";
import { useStrategy } from "@/context/app/StrategyContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useUserRegion } from "@/hooks/use-user-region";
import { ApacRailHonestyBanner } from "../../shared/ApacRailHonestyBanner";
import { needsApacRailMessaging } from "@/constants/apac-rail";
import { CaribbeanRailHonestyBanner } from "../../shared/CaribbeanRailHonestyBanner";
import { needsCaribbeanRailMessaging } from "@/constants/caribbean-rail";
import { LiveProofTicker } from "../../shared/LiveProofCard";
import { ProtectionPlanRing } from "./ProtectionPlanRing";
import { strategyToArchetype } from "@/components/protection-cards/tokens";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
}

// Walletless ghost portfolio: the ring draws the plan's own slices, no
// holdings, no loading shimmer.
const WALLETLESS_PORTFOLIO: MultichainPortfolio = {
  totalValue: 0,
  tokenCount: 0,
  regionCount: 0,
  tokens: [],
  regionalExposure: [],
  weightedInflationRisk: 0,
  diversificationScore: 0,
  diversificationRating: "Poor",
  diversificationTips: [],
  concentrationRisk: "LOW",
  goalScores: { hedge: 0, diversify: 0, rwa: 0 },
  totalAnnualYield: 0,
  totalInflationCost: 0,
  netAnnualGain: 0,
  avgYieldRate: 0,
  netRate: 0,
  isNetPositive: false,
  missingRegions: [],
  overExposedRegions: [],
  underExposedRegions: [],
  rebalancingOpportunities: [],
  goalAnalysis: {
    userGoal: "",
    title: "",
    description: "",
    recommendations: [],
  },
  targetAllocations: {
    inflation_protection: [],
    geographic_diversification: [],
    rwa_access: [],
    exploring: [],
  },
  hyperliquidExposure: { totalValue: 0, percentage: 0, positions: [] },
  projections: {
    currentPath: { value1Year: 0, value3Year: 0, purchasingPowerLost: 0 },
    optimizedPath: { value1Year: 0, value3Year: 0, purchasingPowerPreserved: 0 },
  },
  chainCount: 0,
  chains: [],
  allTokens: [],
  tokenMap: {},
  regionData: [],
  isLoading: false,
  isStale: false,
  errors: [],
  lastUpdated: null,
};

export function ProtectionNotConnected({ experienceMode: _experienceMode, onEnableDemo }: Props) {
  const { financialStrategy } = useStrategy();
  const { config: profileConfig } = useProtectionProfile();
  const { region: detectedRegion } = useUserRegion();
  // Identity travels with the morph: the moment a philosophy is chosen
  // (walletless commits work), the surface picks up its archetype tint.
  const pattern = shieldPatternFor(financialStrategy ?? profileConfig.philosophy ?? null);
  const showApacBanner = needsApacRailMessaging(
    financialStrategy ?? profileConfig.philosophy,
    profileConfig.userRegion ?? detectedRegion,
  );
  const showCaribbeanBanner = needsCaribbeanRailMessaging(
    financialStrategy ?? profileConfig.philosophy,
    profileConfig.userRegion ?? detectedRegion,
  );

  const ringKey = financialStrategy ?? profileConfig.philosophy ?? null;
  const showRing = ringKey != null && strategyToArchetype(ringKey) != null;

  const object = (
    <div className="space-y-4" data-testid="shield-unconnected-object">
      {showRing && (
        <div data-testid="shield-ring" data-walletless>
          <ProtectionPlanRing
            strategyKey={ringKey}
            portfolio={WALLETLESS_PORTFOLIO}
            selectedToken={null}
            onSelectToken={() => {}}
            alignmentScore={null}
            empty
            emptyLabel="Connect to fund"
          />
        </div>
      )}
      <div data-testid="shield-picker">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Choose a protection philosophy
        </p>
        <ProtectionPlanGallery />
      </div>

      {/* The one CTA — attaches to the object, no card wrapper. */}
      <WalletButton variant="primary" className="w-full" />
    </div>
  );

  const status = (
    <div className="space-y-2">
      {(showApacBanner || showCaribbeanBanner) && (
        <div className="mb-1">
          {showApacBanner && <ApacRailHonestyBanner />}
          {showCaribbeanBanner && <CaribbeanRailHonestyBanner />}
        </div>
      )}
      <LiveProofTicker limit={3} />
      {onEnableDemo && <UnconnectedStatusTier onEnableDemo={onEnableDemo} />}
    </div>
  );

  return <InstrumentShell object={object} status={status} pattern={pattern} />;
}

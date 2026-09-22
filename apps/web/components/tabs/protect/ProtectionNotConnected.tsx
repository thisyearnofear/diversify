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
import { PlanFloorControl } from "./PlanFloorControl";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import {
  getArchetypeAllocations,
  legsForRisk,
} from "@/components/protection-cards/plan-preview";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { haptics } from "@/lib/haptics";
import { createEmptyPortfolio } from "@/hooks/use-multichain-balances";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
  /** Selection-bound inspector (e.g. the RWA vault sleeve via ?sleeve=rwa). */
  inspector?: React.ReactNode;
}

export function ProtectionNotConnected({ experienceMode: _experienceMode, onEnableDemo, inspector }: Props) {
  const { financialStrategy } = useStrategy();
  // Walletless ghost portfolio: the ring draws the plan's own slices, no
  // holdings, no loading shimmer. Fresh instance per mount — never a
  // shared mutable const.
  const walletlessPortfolio = React.useMemo(() => createEmptyPortfolio(), []);
  const { config: profileConfig, setRiskTolerance } = useProtectionProfile();
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
  const ringArchetype = ringKey != null ? strategyToArchetype(ringKey) : null;
  const showRing = ringArchetype != null;
  const balance = usePlanBalancePreview({
    scopeKey: `walletless:${ringKey ?? 'none'}`,
    savedRisk: profileConfig.riskTolerance,
    onCommit: setRiskTolerance,
  });
  const ringLegs = ringArchetype
    ? legsForRisk(
        getArchetypeAllocations(ringArchetype),
        profileConfig.riskTolerance,
      )
    : [];
  const balanceLegs = ringArchetype
    ? legsForRisk(getArchetypeAllocations(ringArchetype), balance.risk)
    : [];
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null);
  React.useEffect(() => setSelectedToken(null), [ringKey]);
  const effectiveToken = ringLegs.some((leg) => leg.token === selectedToken)
    ? selectedToken
    : null;

  const object = (
    <div className="space-y-4" data-testid="shield-unconnected-object">
      {showRing && (
        <div data-testid="shield-ring" data-walletless>
          <ProtectionPlanRing
            strategyKey={ringKey}
            legs={balance.isPreviewing ? balanceLegs : ringLegs}
            balancePreview={balance.isPreviewing}
            savedLegs={ringLegs}
            portfolio={walletlessPortfolio}
            selectedToken={effectiveToken}
            onSelectToken={setSelectedToken}
            alignmentScore={null}
            empty
            emptyLabel="Connect to fund"
            controls={
              <div className="mt-3">
                <PlanFloorControl
                  value={balance.risk}
                  legs={balance.isPreviewing ? balanceLegs : ringLegs}
                  savedLegs={ringLegs}
                  philosophy={ringKey}
                  isPreviewing={balance.isPreviewing}
                  accent={ARCHETYPES[ringArchetype].accent}
                  onChange={(risk) => {
                    setSelectedToken(null);
                    balance.select(risk);
                    haptics.tap();
                  }}
                  onApply={() => {
                    if (balance.commit()) {
                      setSelectedToken(null);
                      haptics.confirm();
                    }
                  }}
                  onCancel={() => {
                    balance.cancel();
                    setSelectedToken(null);
                    haptics.tap();
                  }}
                />
              </div>
            }
          />
        </div>
      )}
      {!balance.isPreviewing && (
        <div data-testid="shield-picker">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Choose a protection philosophy
          </p>
          <ProtectionPlanGallery />
        </div>
      )}

      {/* The one CTA — attaches to the object, no card wrapper. */}
      {!balance.isPreviewing && <WalletButton variant="primary" className="w-full" />}
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

  return <InstrumentShell object={object} inspector={balance.isPreviewing ? undefined : inspector} status={status} pattern={pattern} />;
}

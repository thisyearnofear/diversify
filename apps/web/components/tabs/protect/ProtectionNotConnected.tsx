/**
 * ProtectionNotConnected — Shield's unconnected morph.
 *
 * §5 rail 5 (unconnected is a morph too): when a philosophy is resolvable
 * the ghost plan ring IS the object — walletless, so it renders the
 * plan's slices with the plan's dollar reserve in the hole. The plan badge morphs the
 * object in place: tap "Africapitalism ▾" and the gallery replaces the
 * ring; "← Your plan" or choosing a card returns to the ring re-sliced.
 * With no philosophy the gallery alone is the object. The connect CTA
 * attaches below; trust + demo live in the shared status tier. No hero
 * card, no proof card, no how-it-works stack.
 *
 * Persona morphs the object (rail 4): an APAC philosophy shows the APAC
 * honesty banner in the status tier; a Caribbean philosophy shows the
 * Caribbean one.
 */

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const reducedMotion = useReducedMotion();
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

  // Ring↔gallery morph: with a plan the ring is the object and the plan
  // badge swaps the gallery in place; a card commit (or ← Your plan)
  // returns to the ring. No plan → the gallery is the object outright.
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  React.useEffect(() => setGalleryOpen(false), [ringKey]);
  const showPicker = !balance.isPreviewing && (!showRing || galleryOpen);

  const object = (
    <div className="space-y-4" data-testid="shield-unconnected-object">
      {/* Crossfade in one grid cell: the outgoing view fades while the
          incoming one is already painted, so the morph never shows an
          empty card (mode="wait" left a blank frame between the two). The
          cell sizes to the incoming view; the leaving one is taken out of
          flow so the height snaps once instead of stacking. */}
      <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
      <AnimatePresence initial={false}>
        <motion.div
          key={showPicker ? "picker" : "ring"}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={
            reducedMotion
              ? undefined
              : { opacity: 0, scale: 0.985, position: "absolute", inset: 0, pointerEvents: "none" }
          }
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative min-w-0"
        >
      {showRing && !showPicker && (
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
            walletless
            onHoleTap={
              balance.isPreviewing
                ? undefined
                : () => {
                    setGalleryOpen(true);
                    haptics.tap();
                  }
            }
            controls={
              <div className="mt-3">
                <PlanFloorControl
                  value={balance.risk}
                  legs={balance.isPreviewing ? balanceLegs : ringLegs}
                  savedLegs={ringLegs}
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
      {showPicker && (
        <div data-testid="shield-picker">
          {galleryOpen && showRing ? (
            <button
              type="button"
              data-testid="back-to-plan"
              onClick={() => {
                setGalleryOpen(false);
                haptics.tap();
              }}
              className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-3 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 rounded"
            >
              ← Your plan
            </button>
          ) : (
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Choose a protection philosophy
            </p>
          )}
          <ProtectionPlanGallery
            onInspect={(id) => {
              setFinancialStrategy(id);
              setGalleryOpen(false);
              haptics.confirm();
            }}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* The one CTA — attaches to the object, no card wrapper. The plan
          name already lives in the badge; the button just says the verb. */}
      {!balance.isPreviewing && (
        <WalletButton variant="primary" className="w-full" connectLabel="Connect wallet" />
      )}
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
      {onEnableDemo && <UnconnectedStatusTier onEnableDemo={onEnableDemo} />}
    </div>
  );

  return <InstrumentShell object={object} inspector={balance.isPreviewing ? undefined : inspector} status={status} pattern={pattern} />;
}

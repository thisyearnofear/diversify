/**
 * ProtectionNotConnected — Shield's unconnected morph.
 *
 * §5 rail 5 (unconnected is a morph too): when a philosophy is resolvable
 * the ghost plan ring IS the object — walletless, so it renders the
 * plan's slices with the plan's dollar reserve in the hole. Compare and
 * picker transform the same object: the ring goes compact, a faint
 * outline of the current plan sits behind it, and the philosophy coin
 * rail slides in beneath — a coin previews (re-slices in place), "Use
 * this plan" commits, "← Your plan" (or the hole) exits without
 * committing. With no philosophy the picker is the same layout minus the
 * ghost. The connect CTA attaches below when not comparing; trust + demo
 * live in the shared status tier. No hero card, no proof card.
 *
 * Persona morphs the object (rail 4): an APAC philosophy shows the APAC
 * honesty banner in the status tier; a Caribbean philosophy shows the
 * Caribbean one.
 */

import React from "react";
import WalletButton from "../../wallet/WalletButton";
import type { FinancialStrategy, UserExperienceMode } from "@/context/app/types";
import { InstrumentShell } from "../../shared/InstrumentShell";
import { shieldPatternFor } from "./shield-pattern";
import { UnconnectedStatusTier } from "../../shared/UnconnectedStatusTier";
import { useStrategy } from "@/context/app/StrategyContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useUserRegion } from "@/hooks/use-user-region";
import { ApacRailHonestyBanner } from "../../shared/ApacRailHonestyBanner";
import { needsApacRailMessaging } from "@/constants/apac-rail";
import { CaribbeanRailHonestyBanner } from "../../shared/CaribbeanRailHonestyBanner";
import { needsCaribbeanRailMessaging } from "@/constants/caribbean-rail";
import { ProtectionPlanRing, SLEEVE_ID } from "./ProtectionPlanRing";
import { useAnchorCurrency } from "@/hooks/use-anchor-currency";
import { PlanFloorControl } from "./PlanFloorControl";
import { PhilosophyCoinRail, FocusedPlanLine } from "./PhilosophyCoinRail";
import { useAmbientOrigin } from "./ProtectionAmbient";
import { ARCHETYPE_ORDER, ARCHETYPES, archetypeToStrategy, strategyToArchetype } from "@/components/protection-cards/tokens";
import {
  compactPlanDelta,
  resolvePlan,
} from "@/components/protection-cards/plan-preview";
import { STRATEGIES } from "@/constants/strategies";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { useProofFeed } from "@/hooks/use-proof-feed";
import { shieldBeats } from "@/lib/live-lines";
import { LiveLine } from "@/components/shared/LiveLine";
import { haptics } from "@/lib/haptics";
import { createEmptyPortfolio } from "@/hooks/use-multichain-balances";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
  /** Selection-bound inspector (e.g. the RWA vault sleeve via ?sleeve=rwa). */
  inspector?: React.ReactNode;
  /** Tokenized-asset lens is open — the ghost ring restages to match. */
  sleeveOpen?: boolean;
  onOpenSleeve?: () => void;
  onCloseSleeve?: () => void;
  /** Business morph: the status rail offers the payment-cycle entry
   *  instead of the tokenized-assets link. */
  onOpenCycle?: () => void;
}

export function ProtectionNotConnected({
  experienceMode: _experienceMode,
  onEnableDemo,
  inspector,
  sleeveOpen = false,
  onOpenSleeve,
  onCloseSleeve,
  onOpenCycle,
}: Props) {
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const ambient = useAmbientOrigin();
  // Walletless ghost portfolio: the ring draws the plan's own slices, no
  // holdings, no loading shimmer. Fresh instance per mount — never a
  // shared mutable const.
  const walletlessPortfolio = React.useMemo(() => createEmptyPortfolio(), []);
  const { config: profileConfig, setRiskTolerance } = useProtectionProfile();
  const { anchorCurrency } = useAnchorCurrency();
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
  const ringLegs = React.useMemo(
    () =>
      resolvePlan({ strategy: ringArchetype, riskTolerance: profileConfig.riskTolerance, anchorCurrency }).legs,
    [ringArchetype, profileConfig.riskTolerance, anchorCurrency],
  );
  const ringFloor = resolvePlan({ strategy: ringArchetype, anchorCurrency }).floor;
  const balanceLegs = resolvePlan({ strategy: ringArchetype, riskTolerance: balance.risk, anchorCurrency }).legs;
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null);
  React.useEffect(() => setSelectedToken(null), [ringKey]);
  const effectiveToken = ringLegs.some((leg) => leg.token === selectedToken)
    ? selectedToken
    : null;

  // Compare morph: with a plan the hole tap enters compare — the ring
  // goes compact, the current plan's outline sits behind it, and the
  // coin rail previews philosophies in place. A coin tap previews (it no
  // longer commits instantly); "Use this plan" commits and exits.
  const [comparing, setComparing] = React.useState(false);
  const [focusedPhilosophy, setFocusedPhilosophy] = React.useState<string | null>(null);
  React.useEffect(() => {
    setComparing(false);
    setFocusedPhilosophy(null);
  }, [ringKey]);

  const focusedArchetype = focusedPhilosophy
    ? strategyToArchetype(focusedPhilosophy)
    : null;
  const focusedLegs = resolvePlan({
    strategy: focusedArchetype,
    riskTolerance: profileConfig.riskTolerance,
    anchorCurrency,
  }).legs;
  const focusedFloor = resolvePlan({ strategy: focusedArchetype, anchorCurrency }).floor;
  const focusedName =
    STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? "";

  const picking = !showRing;
  const ringCompact = comparing || picking;

  // The live line under the full ring — same dated facts as connected
  // Shield, walletless because the data is public. It vanishes under the
  // compact compare/picker ring (the rail owns the attention there).
  const { data: liveFeed } = useProofFeed();
  const liveBeats = React.useMemo(
    () => shieldBeats({ records: liveFeed?.recent, legs: ringLegs }),
    [liveFeed, ringLegs],
  );
  const liveLineShowing =
    !ringCompact && !sleeveOpen && !balance.isPreviewing && effectiveToken === null;
  const hole = (() => {
    if (!comparing && !picking) return undefined;
    if (!focusedPhilosophy) {
      return { label: "Choose a philosophy", hint: "" };
    }
    if (showRing && focusedPhilosophy === ringKey) {
      return { label: focusedName, hint: "Your plan" };
    }
    return {
      label: focusedName,
      hint: showRing ? compactPlanDelta(ringLegs, focusedLegs) : "",
    };
  })();

  const exitCompare = () => {
    setComparing(false);
    setFocusedPhilosophy(null);
    haptics.tap();
  };
  const commitFocusedPlan = () => {
    if (!focusedPhilosophy) return;
    setFinancialStrategy(focusedPhilosophy as FinancialStrategy);
    setComparing(false);
    setFocusedPhilosophy(null);
    haptics.confirm();
  };

  const object = (
    <div className="space-y-4" data-testid="shield-unconnected-object">
      <div data-testid="shield-ring" data-walletless data-comparing={comparing || undefined}>
        <ProtectionPlanRing
          strategyKey={
            (picking ? focusedPhilosophy : ringKey) ??
            archetypeToStrategy(ARCHETYPE_ORDER[0])
          }
          legs={
            picking
              ? focusedLegs
              : comparing && focusedPhilosophy
                ? focusedLegs
                : balance.isPreviewing
                  ? balanceLegs
                  : ringLegs
          }
          forcePlanLegs={comparing || picking}
          compact={ringCompact}
          ghostLegs={comparing ? ringLegs : undefined}
          holeOverride={hole}
          holeActionLabel={comparing ? "Exit compare" : undefined}
          balancePreview={!comparing && balance.isPreviewing}
          savedLegs={ringLegs}
          portfolio={walletlessPortfolio}
          selectedToken={sleeveOpen ? SLEEVE_ID : effectiveToken}
          onSelectToken={(token) => {
            // A wedge tap inside the lens steps out of it to that leg.
            if (sleeveOpen) onCloseSleeve?.();
            setSelectedToken(token === SLEEVE_ID ? null : token);
          }}
          sleeveOpen={sleeveOpen}
          alignmentScore={null}
          empty
          walletless
          floor={picking || (comparing && focusedPhilosophy) ? focusedFloor : ringFloor}
          onHoleTap={
            balance.isPreviewing || picking
              ? undefined
              : comparing
                ? exitCompare
                : () => {
                    setComparing(true);
                    haptics.tap();
                  }
          }
          controls={
            !ringCompact ? (
              <div className="mt-3">
                <PlanFloorControl
                  value={balance.risk}
                  legs={balance.isPreviewing ? balanceLegs : ringLegs}
                  savedLegs={ringLegs}
                  isPreviewing={balance.isPreviewing}
                  floor={ringFloor}
                  accent={ringArchetype ? ARCHETYPES[ringArchetype].accent : undefined}
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
            ) : undefined
          }
        />
        {liveLineShowing && (
          <LiveLine
            testId="shield-live-line"
            beats={liveBeats.map((b) => ({ key: b.key, content: b.text }))}
            alive
            className="mt-2 block text-center text-2xs font-semibold text-gray-500 dark:text-gray-400"
          />
        )}
      </div>

      {(comparing || picking) && (
        <div data-testid="shield-philosophy-rail" className="space-y-2">
          {comparing && (
            <button
              type="button"
              data-testid="back-to-plan"
              onClick={exitCompare}
              className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white min-h-tap focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 rounded"
            >
              ← Your plan
            </button>
          )}
          <PhilosophyCoinRail
            selected={focusedPhilosophy ?? ringKey}
            onSelect={(id) => {
              setSelectedToken(null);
              setFocusedPhilosophy((prev) => (prev === id ? prev : id));
              haptics.tap();
            }}
            onTapPoint={(x, y) => ambient?.reportTapOrigin(x, y)}
          />
          <FocusedPlanLine strategyId={focusedPhilosophy ?? ringKey} />
          {focusedPhilosophy && focusedPhilosophy !== ringKey && (
            <div className="flex justify-center">
              <button
                type="button"
                data-testid="walletless-commit"
                onClick={commitFocusedPlan}
                className="min-h-tap px-6 rounded-full text-sm font-semibold bg-teal-600 text-white hover:bg-teal-500 active:bg-teal-700 transition-colors"
              >
                Use this plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* The one CTA — attaches to the object, no card wrapper. While
          comparing, "Use this plan" is the one CTA instead. */}
      {!comparing && !balance.isPreviewing && (
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
      {onEnableDemo && (
        <UnconnectedStatusTier onEnableDemo={onEnableDemo}>
          {sleeveOpen && onCloseSleeve ? (
            <button
              type="button"
              data-testid="rwa-sleeve-back"
              onClick={() => {
                onCloseSleeve();
                haptics.tap();
              }}
              className="min-h-tap px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
            >
              ← Back to plan
            </button>
          ) : onOpenCycle ? (
            <button
              type="button"
              data-testid="cycle-entry"
              onClick={() => {
                onOpenCycle();
                haptics.tap();
              }}
              className="min-h-tap px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
            >
              What FX timing costs your next payment →
            </button>
          ) : onOpenSleeve && onCloseSleeve ? (
            <button
              type="button"
              data-testid="rwa-sleeve-entry"
              onClick={() => {
                onOpenSleeve();
                haptics.tap();
              }}
              className="min-h-tap px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
            >
              Tokenized assets you can hold →
            </button>
          ) : null}
        </UnconnectedStatusTier>
      )}
    </div>
  );

  return <InstrumentShell object={object} inspector={balance.isPreviewing ? undefined : inspector} status={status} pattern={pattern} />;
}

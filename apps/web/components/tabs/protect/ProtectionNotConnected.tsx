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
 * live in the shared status tier — the tokenized-asset lens enters
 * through the ring itself (one quiet hatched teaser wedge, on the
 * committed ring and the picker ring alike), never a status link in
 * the action hue. While the lens is open it owns the moment — the ring
 * keeps its full size as the lens's anchor and the picker rail steps
 * out until "← Back to plan". During a balance preview the commit
 * owns the whole screen: handoffs and the demo link step out and only
 * trust remains. No hero card, no proof card.
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
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
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
import { ARCHETYPE_ORDER, archetypeToStrategy, strategyToArchetype } from "@/components/protection-cards/tokens";
import { identityAccent } from "@/components/shared/palette";
import {
  compactPlanDelta,
  resolvePlan,
} from "@/components/protection-cards/plan-preview";
import { STRATEGIES } from "@/constants/strategies";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { useProofFeed } from "@/hooks/use-proof-feed";
import { shieldBeats } from "@/lib/live-lines";
import { useBeatImpulse, useBeatReporter, useInstrumentDwell } from "@/hooks/use-beat-impulse";
import { motion, useReducedMotion } from "framer-motion";
import { controlMotion } from "@/lib/motion-tokens";
import { LiveLine } from "@/components/shared/LiveLine";
import { haptics } from "@/lib/haptics";
import { createEmptyPortfolio } from "@/hooks/use-multichain-balances";
import { InspectorSheet } from "../../shared/InspectorSheet";
import { ProtectionCalculator } from "../../inflation/ProtectionCalculator";
import { FALLBACK_INFLATION_DATA } from "@/constants/inflation";
import { exampleSavingsFor } from "@/constants/currency-risk";
import {
  localInflationRate,
  mixFromLegs,
  mixLabelFor,
  seriesFor,
  type InflationRates,
} from "@/lib/learn/protection-calculator";
import { useNavigation } from "@/context/app/NavigationContext";
import { useAIConversationOptional } from "@/context/AIConversationContext";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
  /** Selection-bound inspector (e.g. the RWA vault sleeve via ?sleeve=rwa). */
  inspector?: React.ReactNode;
  inspectorOpen?: boolean;
  /** Tokenized-asset lens is open — the ghost ring restages to match. */
  sleeveOpen?: boolean;
  onOpenSleeve?: () => void;
  onCloseSleeve?: () => void;
  /** Business morph: the status rail offers the payment-cycle entry
   *  instead of the tokenized-assets link. */
  onOpenCycle?: () => void;
  onShapePlan?: (from: string | null) => void;
  /** Remount seed after the shared editor closes without a save — the
   *  philosophy the visitor was previewing when they opened it. */
  resumeFocus?: string | null;
}

export function ProtectionNotConnected({
  experienceMode: _experienceMode,
  onEnableDemo,
  inspector,
  inspectorOpen = false,
  sleeveOpen = false,
  onOpenSleeve,
  onCloseSleeve,
  onOpenCycle,
  onShapePlan,
  resumeFocus = null,
}: Props) {
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const { pendingIntent, consumeIntent, navigateToGuardian } = useNavigation();
  // The contextual Guardian door — present only where a conversation
  // provider exists; opening it is always an explicit tap, never a send.
  const conversation = useAIConversationOptional();
  const reducedMotion = useReducedMotion();
  const ambient = useAmbientOrigin();
  // Walletless ghost portfolio: the ring draws the plan's own slices, no
  // holdings, no loading shimmer. Fresh instance per mount — never a
  // shared mutable const.
  const walletlessPortfolio = React.useMemo(() => createEmptyPortfolio(), []);
  const { config: profileConfig, setRiskTolerance } = useProtectionProfile();
  const { anchorCurrency } = useAnchorCurrency();
  const customPlan = profileConfig.customPlan;
  const { region: detectedRegion } = useUserRegion();
  // Identity travels with the morph: the moment a philosophy is chosen
  // (walletless commits work), the surface picks up its archetype tint.
  const ringKey = financialStrategy ?? profileConfig.philosophy ?? null;
  const ringArchetype = ringKey != null ? strategyToArchetype(ringKey) : null;
  const identityKey =
    ringArchetype && ringArchetype !== "custom"
      ? ringKey
      : profileConfig.valuesPhilosophy ?? null;
  const pattern = shieldPatternFor(identityKey);
  const showApacBanner = needsApacRailMessaging(
    identityKey,
    profileConfig.userRegion ?? detectedRegion,
  );
  const showCaribbeanBanner = needsCaribbeanRailMessaging(
    identityKey,
    profileConfig.userRegion ?? detectedRegion,
  );
  const showRing = ringArchetype != null;
  const balance = usePlanBalancePreview({
    scopeKey: `walletless:${ringKey ?? 'none'}`,
    savedRisk: profileConfig.riskTolerance,
    onCommit: setRiskTolerance,
  });
  const ringLegs = React.useMemo(
    () =>
      resolvePlan({ strategy: ringArchetype, customPlan, riskTolerance: profileConfig.riskTolerance, anchorCurrency }).legs,
    [ringArchetype, customPlan, profileConfig.riskTolerance, anchorCurrency],
  );
  const ringFloor = resolvePlan({ strategy: ringArchetype, customPlan, anchorCurrency }).floor;
  const balanceLegs = resolvePlan({ strategy: ringArchetype, customPlan, riskTolerance: balance.risk, anchorCurrency }).legs;
  const [selectedToken, setSelectedToken] = React.useState<string | null>(null);
  React.useEffect(() => setSelectedToken(null), [ringKey]);
  const effectiveToken = ringLegs.some((leg) => leg.token === selectedToken)
    ? selectedToken
    : null;

  // Compare morph: with a plan the hole tap enters compare — the ring
  // goes compact, the current plan's outline sits behind it, and the
  // coin rail previews philosophies in place. A coin tap previews (it no
  // longer commits instantly); "Use this plan" commits and exits.
  const [comparing, setComparing] = React.useState(resumeFocus != null && showRing);
  const [focusedPhilosophy, setFocusedPhilosophy] = React.useState<string | null>(resumeFocus);
  const [intentContext, setIntentContext] = React.useState<{
    currencyCode: string;
    example: boolean;
  } | null>(null);
  React.useEffect(() => {
    if (pendingIntent?.tab !== "protect" || pendingIntent.intent.lens !== "compare") return;
    const intent = pendingIntent.intent;
    setIntentContext(
      intent.currencyCode
        ? { currencyCode: intent.currencyCode, example: intent.example === true }
        : null,
    );
    if (showRing) {
      setComparing(true);
      setFocusedPhilosophy(null);
    }
    consumeIntent();
  }, [pendingIntent, consumeIntent, showRing]);
  const prevRingKeyRef = React.useRef(ringKey);
  React.useEffect(() => {
    if (prevRingKeyRef.current === ringKey) return;
    prevRingKeyRef.current = ringKey;
    setComparing(false);
    setFocusedPhilosophy(null);
    setIntentContext(null);
  }, [ringKey]);

  const focusedArchetype = focusedPhilosophy
    ? strategyToArchetype(focusedPhilosophy)
    : null;
  const focusedLegs = resolvePlan({
    strategy: focusedArchetype,
    customPlan,
    riskTolerance: profileConfig.riskTolerance,
    anchorCurrency,
  }).legs;
  const focusedFloor = resolvePlan({ strategy: focusedArchetype, customPlan, anchorCurrency }).floor;
  const focusedName =
    STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? "";

  // Walletless sample outcome: the same calculator Shield's inspector uses,
  // run on the previewed mix with an example amount. Nothing is read from a
  // wallet and nothing is saved until the user commits the plan.
  const [outcomeOpen, setOutcomeOpen] = React.useState(false);
  const [outcomeAmount, setOutcomeAmount] = React.useState<number | null>(null);
  const [outcomeYear, setOutcomeYear] = React.useState(5);
  const outcomeMix = React.useMemo(() => mixFromLegs(focusedLegs), [focusedLegs]);
  const outcomeRates = React.useMemo<InflationRates>(() => {
    const byRegion: Record<string, number> = {};
    for (const [region, entry] of Object.entries(FALLBACK_INFLATION_DATA)) {
      byRegion[region] = entry.avgRate;
    }
    const local = localInflationRate(detectedRegion, byRegion);
    return {
      local,
      usd: byRegion.USA ?? 4.1,
      eur: byRegion.Europe ?? 6.8,
      africa: byRegion.Africa ?? local,
      latam: byRegion.LatAm ?? local,
      asia: byRegion.Asia ?? local,
      europe: byRegion.Europe ?? 6.8,
    };
  }, [detectedRegion]);
  const outcomeAmountUsd = outcomeAmount ?? exampleSavingsFor("USD");
  const outcomeSeries = React.useMemo(
    () => seriesFor(outcomeAmountUsd, outcomeMix, outcomeRates, 5),
    [outcomeAmountUsd, outcomeMix, outcomeRates],
  );

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
  const [acted, setActed] = React.useState(false);
  const liveLineShowing =
    !ringCompact && !sleeveOpen && !balance.isPreviewing && effectiveToken === null;

  // The beat→object event — same grammar as connected Shield: a signal
  // on a plan leg's currency tremors the ring, the cadence breathes it.
  // Silent on the first beat, dead once the user acts.
  const { beatKey: activeBeatKey, reportBeat } = useBeatReporter();
  const ringBeat = useBeatImpulse(
    activeBeatKey,
    liveLineShowing && !acted && !inspectorOpen,
    { surface: "shield" },
  );
  useInstrumentDwell("shield", liveLineShowing && !acted, acted);
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
    setIntentContext(null);
    haptics.tap();
  };
  const commitFocusedPlan = () => {
    if (!focusedPhilosophy) return;
    setFinancialStrategy(focusedPhilosophy as FinancialStrategy);
    setComparing(false);
    setFocusedPhilosophy(null);
    setIntentContext(null);
    haptics.confirm();
  };

  const object = (
    <div
      className="space-y-4"
      data-testid="shield-unconnected-object"
      onPointerDownCapture={() => setActed(true)}
      onFocusCapture={() => setActed(true)}
    >
      {!inspectorOpen && !sleeveOpen && !balance.isPreviewing && (
        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            {picking || comparing
              ? "Your values. Your starting mix."
              : "A plan you can make your own."}
          </h2>
          {picking && (
            <p className="text-sm text-ink-muted">
              Choose a philosophy. Watch the mix take shape.
            </p>
          )}
        </div>
      )}
      <div data-testid="shield-ring" data-walletless data-comparing={comparing || undefined}>
        <motion.div
          data-testid="beat-impulse"
          data-impulse={ringBeat.impulse ?? "none"}
          animate={ringBeat.controls}
        >
        <ProtectionPlanRing
          customPlan={customPlan}
          identityStrategyKey={
            (picking || comparing) && focusedArchetype && focusedArchetype !== "custom"
              ? focusedPhilosophy
              : picking
                ? null
                : identityKey
          }
          suppressPlanBadge={picking && !focusedPhilosophy}
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
          // The lens owns the moment: while it is open the ring keeps its
          // full size as the lens's anchor (the picker's compact form is
          // the picker's own grammar, not the lens's — a 130px ring beside
          // the inspector reads as a thumbnail, not a restaged object).
          compact={ringCompact && !sleeveOpen}
          ghostLegs={comparing ? ringLegs : undefined}
          holeOverride={hole}
          holeActionLabel={comparing ? "Exit compare" : undefined}
          balancePreview={!comparing && balance.isPreviewing}
          savedLegs={ringLegs}
          portfolio={walletlessPortfolio}
          selectedToken={sleeveOpen ? SLEEVE_ID : effectiveToken}
          onSelectToken={(token) => {
            // The teaser wedge is the sleeve's door — object grammar,
            // not a status-tier link. A wedge tap inside the open lens
            // steps out of it to that leg.
            if (token === SLEEVE_ID) {
              setSelectedToken(null);
              if (!sleeveOpen) onOpenSleeve?.();
              return;
            }
            if (sleeveOpen) onCloseSleeve?.();
            setSelectedToken(token);
          }}
          sleeveOpen={sleeveOpen}
          sleeveTeaser={
            !comparing &&
            !sleeveOpen &&
            !balance.isPreviewing &&
            !onOpenCycle &&
            Boolean(onOpenSleeve && onCloseSleeve)
          }
          stilled={acted}
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
                  onInteraction={() => setActed(true)}
                  floor={ringFloor}
                  accent={identityAccent(identityKey)}
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
                {!balance.isPreviewing && !sleeveOpen && (
                  <WalletButton
                    variant="primary"
                    className="w-full mt-3"
                  />
                )}
                {!balance.isPreviewing && !sleeveOpen && !comparing && !picking && conversation && (
                  <motion.button
                    type="button"
                    className="link-quiet mt-2"
                    {...controlMotion(Boolean(reducedMotion))}
                    onClick={() => {
                      setActed(true);
                      conversation.setDrawerOpen(true);
                    }}
                  >
                    Explore this plan with Guardian
                  </motion.button>
                )}
              </div>
            ) : undefined
          }
        />
        </motion.div>
        {liveLineShowing && (
          <LiveLine
            testId="shield-live-line"
            beats={liveBeats.map((b) => ({ key: b.key, content: b.text }))}
            alive={!acted && !inspectorOpen}
            onBeatChange={reportBeat}
            className="mt-2 block text-center text-2xs font-semibold text-gray-500 dark:text-gray-400"
          />
        )}
      </div>

      {/* The picker's rail is the picker's control — it steps out while
          the lens is open rather than squeezing beside the inspector
          (modes transform, never append). "← Back to plan" restores it. */}
      {(comparing || picking) && !sleeveOpen && (
        <div data-testid="shield-philosophy-rail" className="space-y-2">
          {intentContext && (
            <p
              data-testid="shield-intent-context"
              className="text-center text-2xs font-semibold text-gray-500 dark:text-gray-400"
            >
              {intentContext.example
                ? `From Home’s ${intentContext.currencyCode} example`
                : `From your ${intentContext.currencyCode} reading`}
            </p>
          )}
          {picking && !focusedPhilosophy && (
            <p
              data-testid="picker-instruction"
              className="text-center text-xs font-semibold text-gray-600 dark:text-gray-300"
            >
              Tap a philosophy coin to preview its plan
            </p>
          )}
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
          <FocusedPlanLine
            strategyId={focusedPhilosophy ?? ringKey}
            legs={focusedPhilosophy ? focusedLegs : ringLegs}
          />
          {focusedPhilosophy && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                data-testid="walletless-outcome-open"
                onClick={() => {
                  setOutcomeOpen(true);
                  haptics.tap();
                }}
                className="link-quiet"
              >
                See a sample outcome
              </button>
              <InspectorSheet
                selectedId={outcomeOpen ? focusedPhilosophy : null}
                onClose={() => setOutcomeOpen(false)}
                title={`${focusedName} · sample outcome`}
              >
                <ProtectionCalculator
                  amount={outcomeAmountUsd}
                  onAmountChange={setOutcomeAmount}
                  amountLabel="Example savings amount"
                  currencyCode="USD"
                  series={outcomeSeries}
                  selectedYear={outcomeYear}
                  years={5}
                  mixLabel={mixLabelFor(
                    focusedPhilosophy as FinancialStrategy,
                    outcomeMix,
                    focusedName || undefined,
                  )}
                  onSelectYear={setOutcomeYear}
                  onProtect={() => setOutcomeOpen(false)}
                  ctaLabel="Back to plan"
                />
              </InspectorSheet>
            </div>
          )}
          {focusedPhilosophy && focusedPhilosophy !== ringKey && (
            <div className="flex justify-center gap-2">
              <button
                type="button"
                data-testid="walletless-commit"
                onClick={commitFocusedPlan}
                className="min-h-tap px-6 rounded-full text-sm font-semibold bg-action text-white hover:bg-action-hover active:bg-action-hover transition-colors"
              >
                Use starting mix
              </button>
              {onShapePlan && (
                <button
                  type="button"
                  data-testid="walletless-shape"
                  onClick={() => {
                    onShapePlan(focusedPhilosophy);
                    haptics.tap();
                  }}
                  className="link-quiet shrink-0"
                >
                  Shape this mix
                </button>
              )}
            </div>
          )}
          {picking && onShapePlan && (
            <div className="flex justify-center">
              <button
                type="button"
                data-testid="build-my-mix"
                onClick={() => {
                  onShapePlan(null);
                  haptics.tap();
                }}
                className="link-quiet shrink-0"
              >
                Build my mix
              </button>
            </div>
          )}
        </div>
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
      {onEnableDemo &&
        (balance.isPreviewing ? (
          /* The commit moment owns the screen — trust stays, handoffs
             and the demo link step out until it settles (§1 one job;
             the dial already hides the rail, the CTA and the LiveLine). */
          <VerifiedEvidence />
        ) : (
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
            ) : showRing && !comparing ? (
              <button
                type="button"
                data-testid="guardian-plan-link"
                onClick={() => {
                  navigateToGuardian({
                    summary: "An example Guardian decision",
                    prompt: "Show me an example Guardian decision",
                    example: true,
                  });
                  haptics.tap();
                }}
                className="min-h-tap px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
              >
                See an example Guardian decision →
              </button>
            ) : null}
          </UnconnectedStatusTier>
        ))}
    </div>
  );

  return <InstrumentShell object={object} inspector={balance.isPreviewing ? undefined : inspector} inspectorOpen={inspectorOpen && !balance.isPreviewing} status={status} pattern={pattern} />;
}

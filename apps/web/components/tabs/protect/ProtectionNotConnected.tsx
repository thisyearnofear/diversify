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
 * owns the whole screen: handoffs step out and only trust remains.
 * The sample-plan switch is app chrome (the header), not a per-tab
 * foot link. No hero card, no proof card.
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
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
import { VerifierSealChip } from "@/components/shared/VerifiedEvidence";
import { ShieldVerifyBand } from "./ShieldVerifyBand";
import { ledgerViewFrom } from "@/lib/shield-ledger-view";
import { useReservedHeight } from "@/hooks/use-reserved-height";
import { StageBands, type StageBandOption } from "../../shared/StageBands";
import { ShieldGuardianBand } from "./ShieldGuardianBand";
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
  floorPercent,
  reserveLabel,
  resolvePlan,
} from "@/components/protection-cards/plan-preview";
import { STRATEGIES } from "@/constants/strategies";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { useProofFeed } from "@/hooks/use-proof-feed";
import { shieldBeats } from "@/lib/live-lines";
import { useBeatImpulse, useBeatReporter, useInstrumentDwell } from "@/hooks/use-beat-impulse";
import { motion, useReducedMotion } from "framer-motion";
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

type ShieldBand = "live" | "guardian" | "verify";

interface Props {
  experienceMode: UserExperienceMode;
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
  const {
    data: liveFeed,
    isLoading: feedLoading,
    isStale: feedStale,
    error: feedError,
  } = useProofFeed();
  // The measure the Verify band draws — the same public counts the connected
  // ring re-slices into. Walletless is no reason to read a different ledger.
  const ledgerView = React.useMemo(
    () =>
      ledgerViewFrom(liveFeed, {
        isLoading: feedLoading,
        isStale: feedStale,
        error: feedError,
        maxLegs: ringCompact ? undefined : ringLegs.length,
      }),
    [liveFeed, feedLoading, feedStale, feedError, ringLegs, ringCompact],
  );
  const liveBeats = React.useMemo(
    () => shieldBeats({ records: liveFeed?.recent, legs: ringLegs }),
    [liveFeed, ringLegs],
  );
  const [acted, setActed] = React.useState(false);
  const liveLineShowing =
    !ringCompact && !sleeveOpen && !balance.isPreviewing && effectiveToken === null;

  // The same presenter grammar as connected Shield (§5): one reading slot
  // under the ring, one pill row that chooses what fills it. Live is the
  // floor; a band with nothing to read withdraws its pill.
  const [band, setBand] = React.useState<ShieldBand>("live");
  const guardianBandOffered = showRing && !comparing;
  // The floor withdraws with its reading: a planless visitor has no dated
  // signal and no cycle door, so the row offers the ledger and nothing else.
  const liveBandOffered = liveBeats.length > 0 || Boolean(onOpenCycle);
  const bandOptions: StageBandOption<ShieldBand>[] = [
    ...(liveBandOffered ? [{ id: "live" as const, label: "Live" }] : []),
    ...(guardianBandOffered
      ? [{ id: "guardian" as const, label: "Guardian" }]
      : []),
    { id: "verify", label: "Verify" },
  ];
  // A band whose pill has withdrawn falls back to the floor — the reading
  // slot never keeps showing what the row no longer offers.
  const activeBand: ShieldBand =
    band === "guardian" && !guardianBandOffered ? "live" : band;
  // The presenter owns every resting surface of the ring — including the
  // compact picker, which is what a walletless visitor lands on. Gating it
  // off there left unconnected visitors with no trust surface at all:
  // Shield has no foot tier in either state, so the band is the only door.
  // Compare, a sleeve, a preview or an open sheet still own the object.
  const presenterShowing =
    !comparing && !sleeveOpen && !balance.isPreviewing && !inspectorOpen;
  React.useEffect(() => {
    if (!presenterShowing) setBand("live");
  }, [presenterShowing]);

  // The beat→object event — same grammar as connected Shield: a signal
  // on a plan leg's currency tremors the ring, the cadence breathes it.
  // Silent on the first beat, dead once the user acts.
  const { beatKey: activeBeatKey, reportBeat } = useBeatReporter("shield");
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
    // The hole states the previewed mix's reserve target — the plan's name
    // lives in the FocusedPlanLine beneath the rail (§3: one job per block).
    const reserve = {
      number: `${floorPercent(focusedLegs, focusedFloor)}%`,
      label: `${reserveLabel(focusedFloor).toLowerCase()} reserve`,
    };
    if (showRing && focusedPhilosophy === ringKey) {
      return { ...reserve, hint: "Your plan" };
    }
    return {
      ...reserve,
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

  const bandReading =
    activeBand === "verify" ? (
      <ShieldVerifyBand view={ledgerView} compact={ringCompact} />
    ) : activeBand === "guardian" ? (
      <ShieldGuardianBand
        monitoring={false}
        sample
        onOpenActivity={() => {}}
        onSetUp={() => {
          navigateToGuardian({
            summary: "An example Guardian decision",
            prompt: "Show me an example Guardian decision",
            example: true,
          });
          haptics.tap();
        }}
      />
    ) : (
      <div data-testid="shield-live-band" className="mt-2 space-y-1.5 text-center">
        <LiveLine
          testId="shield-live-line"
          beats={liveBeats.map((b) => ({ key: b.key, content: b.text }))}
          alive={!acted && !inspectorOpen}
          onBeatChange={reportBeat}
          className="block text-2xs font-semibold text-gray-500 dark:text-gray-400"
        />
        {onOpenCycle && (
          <button
            type="button"
            data-testid="cycle-entry"
            onClick={() => {
              onOpenCycle();
              haptics.tap();
            }}
            className="min-h-tap text-2xs font-semibold text-blue-600 dark:text-blue-400"
          >
            What FX timing costs your next payment →
          </button>
        )}
      </div>
    );

  // The slot keeps the height of the tallest band it holds, so opening
  // Verify moves nothing but the ring's own slices.
  const { ref: bandSlotRef, style: bandSlotFloor } = useReservedHeight();

  const presenterSlot = presenterShowing ? (
    <>
      <div ref={bandSlotRef} style={bandSlotFloor}>
        {bandReading}
      </div>
      <StageBands
        testIdBase="shield"
        groupLabel="What the plan shows"
        options={bandOptions}
        active={activeBand}
        onSelect={(id) => {
          haptics.tap();
          // The active pill is the exit, and Live is the floor it returns to.
          setBand(id === activeBand ? "live" : id);
        }}
      />
    </>
  ) : null;

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
              ? "Your values. Your starting plan."
              : "A plan you can make your own."}
          </h2>
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
          ledgerView={
            activeBand === "verify" && !balance.isPreviewing
              ? ledgerView
              : null
          }
          statusBadge={
            activeBand === "verify" ? <VerifierSealChip /> : undefined
          }
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
                {/* Verify reads the ledger, not the user's balance — the
                    balance dial steps aside for the reading, same as the
                    connected tab's floor affordance. */}
                {activeBand !== "verify" && (
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
                )}
                {/* The presenter is part of the object: the reading and its
                    pills sit under the ring, and the CTA settles the card.
                    The Guardian pill is the hand-off — the old quiet link
                    under the button is gone (§5, no foot doors). */}
                {presenterSlot}
                {!balance.isPreviewing && !sleeveOpen && (
                  <WalletButton
                    variant="primary"
                    className="w-full mt-3"
                  />
                )}
              </div>
            ) : undefined
          }
        />
        </motion.div>
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
                className="min-h-tap px-6 rounded-full text-sm font-semibold bg-action-fill text-white hover:bg-action-fill-hover active:bg-action-fill-hover transition-colors"
              >
                Use this plan
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
                  Adjust this plan
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
                Build my own plan
              </button>
            </div>
          )}
          {/* Under the compact picker the ring has no controls slot, so the
              presenter lands here — after the rail, which is the picker's
              own control. Walletless visitors get the same door. */}
          {presenterSlot}
        </div>
      )}
    </div>
  );

  const banner =
    showApacBanner || showCaribbeanBanner ? (
      <div className="space-y-1">
        {showApacBanner && <ApacRailHonestyBanner />}
        {showCaribbeanBanner && <CaribbeanRailHonestyBanner />}
      </div>
    ) : null;

  // What stays below the object is disclosure and the commit moment only:
  // the honesty banner a persona's corridor requires, and the trust line
  // while a balance preview is asking for a decision. Everything the old
  // foot tier carried (cycle entry, Guardian example, verify) is a band of
  // the ring now.
  const status =
    banner || balance.isPreviewing ? (
      <div className="space-y-2">
        {banner}
        {balance.isPreviewing && <VerifiedEvidence />}
      </div>
    ) : undefined;

  return <InstrumentShell object={object} inspector={balance.isPreviewing ? undefined : inspector} inspectorOpen={inspectorOpen && !balance.isPreviewing} status={status} pattern={pattern} />;
}

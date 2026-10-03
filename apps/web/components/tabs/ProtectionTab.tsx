/**
 * Shield — instrument tab: pick or correct a protection plan, then act.
 *
 * Four shapes of the same screen (deriveShieldShape). Token selection
 * opens InspectorSheet. Persona morphs inspector content (payment cycle
 * when moneyPurpose is upcoming_payment). Leftover jobs go to Ask Guardian.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Region } from "@/hooks/use-user-region";
import type { MultichainPortfolio, TokenBalance } from "@/hooks/use-multichain-balances";
import { useWalletContext } from "../wallet/WalletProvider";
import { NETWORK_TOKENS, NETWORKS } from "@/config";
import { useNavigation } from "@/context/app/NavigationContext";
import { useAdaptiveContext } from "@/context/app/AdaptiveContext";
import { useDemoMode } from "@/context/app/DemoModeContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import { useProtectionProfile, consumeRetiredPhilosophyNotice } from "@/hooks/use-protection-profile";
import { useAnchorCurrency } from "@/hooks/use-anchor-currency";
import { useLatestAdvice } from "@/hooks/use-agent-analysis";
import { applyTilt, tiltLabel } from "@/lib/guardian-tilts";
import {
  CUSTOM_MAX_SLICES,
  CUSTOM_STEP,
  addSlice,
  addableExposures,
  customFromHoldings,
  customFromLegs,
  sliceIndexForLeg,
  stepSlice,
} from "@/lib/custom-plan";
import { useAdvisor } from "@/hooks/use-advisor";
import { useFinancialStrategies, STRATEGIES } from "@/hooks/useFinancialStrategies";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { MIN_SNAPSHOT_AGE_MS, formatElapsed } from "@/lib/since-last-visit";
import { useGuardianVisibility } from "@/context/app/GuardianVisibilityContext";
import { trackFunnelEvent } from "@/lib/analytics";
import { shareLandingFor } from "@/hooks/use-share-landing";
import { useLensOffered } from "@/hooks/use-lens-offered";
import { useShieldIntent } from "./protect/use-shield-intent";
import { ShieldSliceInspector } from "./protect/ShieldSliceInspector";
import { ShieldStatusTier } from "./protect/ShieldStatusTier";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanRing } from "./protect/ProtectionPlanRing";
import { PhilosophyCoinRail, FocusedPlanLine } from "./protect/PhilosophyCoinRail";
import { useAmbientOrigin } from "./protect/ProtectionAmbient";
import { ARCHETYPE_ORDER, ARCHETYPES, archetypeToStrategy, strategyToArchetype } from "@/components/protection-cards/tokens";
import { shieldPatternFor } from "./protect/shield-pattern";
import {
  compactPlanDelta,
  resolvePlan,
  allocationPlanFromResolved,
  type CustomPlan,
} from "@/components/protection-cards/plan-preview";
import { scorePlanAlignment } from "@/lib/plan-alignment";
import { configTokenFor, isLegFillable, pickBiggestFillableGap } from "@/lib/plan-legs";
import { strongerFloorOffer } from "@/lib/shield-lens";
import { PlanFloorControl } from "./protect/PlanFloorControl";
import { deriveShieldShape } from "./protect/shield-shape";
import { useGuardianTierSnapshotFrom } from "../agent/AgentTierStatus";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { useVault } from "@/hooks/use-vault";
import { getCachedWalletAuth } from "@/lib/wallet-auth";
import { useSessionKey } from "@/hooks/use-session-key";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
import type { FinancialStrategy } from "@/context/app/types";
import { exampleSavingsFor } from "@/constants/currency-risk";
import { FALLBACK_INFLATION_DATA } from "@/constants/inflation";
import {
  localInflationRate,
  mixForPhilosophy,
  mixFromLegs,
  mixLabelFor,
  seriesFor,
  type InflationRates,
} from "@/lib/learn/protection-calculator";
import ProtectionSkeleton from "../ui/skeletons/ProtectionSkeleton";
import { InstrumentShell } from "../shared/InstrumentShell";
import { buildWalletPortfolioView, heldAsLine } from "@/lib/wallet-portfolio-view";
import { rwaLegFor } from "./protect/rwa-assets";
import { SLEEVE_ID, VAULT_SLICE_PREFIX, isSleeveSelection } from "./protect/ProtectionPlanRing";
import { useRwaAllocation } from "@/hooks/use-rwa-allocation";
import { useRwaMarket } from "@/hooks/use-rwa-market";
import { useProofFeed } from "@/hooks/use-proof-feed";
import { shieldBeats } from "@/lib/live-lines";
import { LiveLine } from "@/components/shared/LiveLine";
import { useRouter } from "next/router";

interface ProtectionTabProps {
  userRegion: Region;
  portfolio: MultichainPortfolio;
  isLoading?: boolean;
  onSelectStrategy?: (strategy: string) => void;
  setActiveTab?: (tab: import("@/constants/tabs").TabId) => void;
  refreshBalances?: () => Promise<void>;
}

export default function ProtectionTab({
  userRegion,
  portfolio,
  isLoading,
  setActiveTab,
  refreshBalances,
}: ProtectionTabProps) {
  const { address, chainId, isMiniPay } = useWalletContext();
  const { navigateToSwap, navigateToGuardian } = useNavigation();
  const { demoMode, enableDemoMode, setDemoStrategy } = useDemoMode();
  const { experienceMode } = useExperience();
  const { config: adaptiveConfig } = useAdaptiveContext();
  const { visibility } = useGuardianVisibility();
  const reducedMotion = useReducedMotion();
  const { askAdvisor } = useAdvisor();
  const isDemo = demoMode.isActive;

  const activePortfolio = (isDemo ? DEMO_PORTFOLIO : portfolio) as MultichainPortfolio;

  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const { recordActivity } = useStreakRewards();
  const vault = useVault();
  const { signedPermission, sessionInfo, deriveGuardianState } =
    useSessionKey();
  const { guardianState } = useGuardianTierSnapshotFrom(vault, {
    signedPermission,
    sessionInfo,
    deriveGuardianState,
  });

  const { totalValue, chains } = activePortfolio;
  const { config, currentGoalLabel, setRiskTolerance, setCustomPlan } = useProtectionProfile();
  const { anchorCurrency } = useAnchorCurrency(activePortfolio);
  const { riskData } = useCurrencyRisk();
  const { selectedStrategy, getStrategyById } = useFinancialStrategies();
  const { showToast } = useToast();
  const strategyKey = (isDemo
    ? demoMode.previewStrategy ?? selectedStrategy ?? financialStrategy ?? 'global'
    : selectedStrategy || financialStrategy) as string | null;

  const [focusedToken, setFocusedToken] = useState<string | null>(null);
  const [focusedPhilosophy, setFocusedPhilosophy] = useState<FinancialStrategy | null>(null);
  const [comparing, setComparing] = useState(false);
  // The second tap on the already-focused coin opens the details sheet
  // ("About {plan}") — a first tap only previews in the ring.
  const [philosophyDetailsOpen, setPhilosophyDetailsOpen] = useState(false);
  const ambient = useAmbientOrigin();
  // Payment-cycle inspector — opened by the `cycle` intent (Home's
  // graduation / payment-cycle transition). Independent of any slice.
  const [cycleOpen, setCycleOpen] = useState(false);
  // The inspector's two engines — the `cycle` intent and ?cycle=1 open the
  // forward report; the /fx-drag-calculator doorway lands on 'last'.
  const [cycleMode, setCycleMode] = useState<"next" | "last">("next");
  const openCycle = useCallback((m: "next" | "last" = "next") => {
    setCycleMode(m);
    setCycleOpen(true);
  }, []);
  useEffect(() => {
    if (focusedToken) setCycleOpen(false);
  }, [focusedToken]);
  const [learnYear, setLearnYear] = useState(5);
  const [learnAmountOverride, setLearnAmountOverride] = useState<number | null>(null);
  const previousAddress = useRef(address);
  useEffect(() => {
    if (previousAddress.current !== address) {
      setFocusedToken(null);
      setFocusedPhilosophy(null);
      previousAddress.current = address;
    }
  }, [address]);
  const balance = usePlanBalancePreview({
    scopeKey: `${address ?? 'walletless'}:${strategyKey ?? 'none'}:${comparing ? 'compare' : 'plan'}:${isDemo ? 'sample' : 'live'}`,
    savedRisk: config.riskTolerance,
    onCommit: setRiskTolerance,
    canCommit: !isDemo,
  });
  const handleMarqueeSelect = useCallback((token: string | null) => {
    // Re-tapping a vault wedge steps back to the sleeve, not out of it.
    setFocusedToken((prev) =>
      token === null && prev?.startsWith(VAULT_SLICE_PREFIX) ? SLEEVE_ID : token,
    );
    if (token) trackFunnelEvent("marquee_select", { token, source: "shield_ring" });
  }, []);

  // RWA vault sleeve — the hatched wedge fans into the IXS allocation.
  // Free heuristic is local + instant; SERV Reasoning is an opt-in rail in
  // the inspector, fetched only while the sleeve view is open.
  const [rwaServOn, setRwaServOn] = useState(false);

  // URL hand-off: ?sleeve=rwa opens the inspector on the vault sleeve;
  // ?serv=1 arms the SERV Reasoning rail. The /rwa-vaults doorway lands
  // here — same deep-link contract as Exchange's ?netting=1.
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.sleeve === "rwa") setFocusedToken(SLEEVE_ID);
    // ?cycle=1 opens the payment-cycle inspector's forward report; the
    // /fx-drag-calculator doorway lands on ?cycle=last (historical engine).
    if (router.query.cycle === "1") openCycle("next");
    if (router.query.cycle === "last") openCycle("last");
    if (router.query.serv === "1" || router.query.serv === "true") {
      setRwaServOn(true);
    }
    // A shared plan card lands here: ?plan= previews the philosophy in
    // the same focused state the picker's flick/compare uses — never a
    // commit, never persisted.
    const plan = router.query.plan;
    if (typeof plan === "string" && STRATEGIES.some((s) => s.id === plan)) {
      setFocusedPhilosophy(plan as FinancialStrategy);
      setPhilosophyDetailsOpen(true);
    }
    // One-shot URL consumption on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const sleeveOpen = !comparing && !balance.isPreviewing && isSleeveSelection(focusedToken);
  const rwa = useRwaAllocation(
    useMemo(
      () => ({
        philosophy: config.philosophy,
        riskTolerance: config.riskTolerance,
        region: config.userRegion,
        amountUsd: totalValue > 0 ? Math.round(totalValue) : null,
      }),
      [config.philosophy, config.riskTolerance, config.userRegion, totalValue],
    ),
    rwaServOn && sleeveOpen,
  );

  const hasPlan = Boolean(strategyKey);
  const planName =
    STRATEGIES.find((s) => s.id === strategyKey)?.name ?? currentGoalLabel;
  // One grant path: Shield never signs a permission itself. It hands off to
  // the Guardian tab, whose object owns "Set daily limit".
  const setUpGuardian = useCallback(
    () =>
      navigateToGuardian({
        summary: `Set a daily limit and Guardian will propose moves that keep your ${planName} plan aligned. You approve each one.`,
        prompt: `How would Guardian keep my ${planName} plan aligned, and what does a daily limit let it do?`,
      }),
    [navigateToGuardian, planName],
  );
  const planRingVisible = useMemo(() => {
    return resolvePlan({ customPlan: config.customPlan, strategy: strategyKey }).legs.length > 0;
  }, [strategyKey, config.customPlan]);

  const allocations = useMemo(() => {
    return resolvePlan({ customPlan: config.customPlan, strategy: strategyKey, riskTolerance: config.riskTolerance, anchorCurrency }).legs;
  }, [strategyKey, config.riskTolerance, anchorCurrency, config.customPlan]);
  const { rules: planRules, floor: planFloor } = useMemo(
    () => resolvePlan({ customPlan: config.customPlan, strategy: strategyKey, anchorCurrency }),
    [config.customPlan, strategyKey, anchorCurrency],
  );
  const walletView = useMemo(
    () => buildWalletPortfolioView(activePortfolio, allocations, planRules),
    [activePortfolio, allocations, planRules],
  );
  const latestAdvice = useLatestAdvice();
  const guardianTilt = useMemo(() => {
    const plan = latestAdvice?.guardianPlan;
    if (!plan || plan.strategy !== strategyKey) return null;
    const tilt = plan.tilts.find((t) => t.delta > 0 && t.instrument);
    if (!tilt?.instrument) return null;
    const move = plan.nextMove?.exposure === tilt.exposure ? plan.nextMove : null;
    return {
      tilt,
      instrument: tilt.instrument,
      amountUsd: move?.amountUsd,
      legs: applyTilt(allocations, tilt.exposure, tilt.delta),
    };
  }, [latestAdvice, strategyKey, allocations]);
  const [tiltPreview, setTiltPreview] = useState(false);
  // Custom plan being edited on the ring (not saved until "Save plan").
  const [customDraft, setCustomDraft] = useState<CustomPlan | null>(null);
  const [addingSlice, setAddingSlice] = useState(false);
  const walletHoldings = useMemo(
    () =>
      (chains ?? []).flatMap((c) =>
        (c.balances as TokenBalance[]).map((b) => ({
          symbol: b.symbol,
          chainId: b.chainId ?? c.chainId,
          value: b.value,
        })),
      ),
    [chains],
  );
  const tiltShowing = tiltPreview && guardianTilt !== null && !comparing && !balance.isPreviewing;
  const balanceAllocations = useMemo(() => {
    return resolvePlan({ customPlan: config.customPlan, strategy: strategyKey, riskTolerance: balance.risk, anchorCurrency }).legs;
  }, [strategyKey, balance.risk, anchorCurrency, config.customPlan]);

  const heldPctByToken = useMemo(
    () => new Map(walletView.holdings.map((holding) => [holding.symbol, holding.percent])),
    [walletView.holdings],
  );

  // The tokenized-asset lens reads the plan the visitor actually sees: the
  // committed strategy, else the onboarding philosophy (walletless ghost).
  const sleeveLegs = useMemo(() => {
    if (allocations.length > 0) return allocations;
    return resolvePlan({ customPlan: config.customPlan, strategy: config.philosophy, riskTolerance: config.riskTolerance, anchorCurrency }).legs;
  }, [allocations, config.philosophy, config.riskTolerance, anchorCurrency, config.customPlan]);
  const sleevePhilosophy = strategyKey ?? config.philosophy ?? null;
  const planPctBySymbol = useMemo(
    () => Object.fromEntries(sleeveLegs.map((l) => [l.token, l.percent])),
    [sleeveLegs],
  );
  const heldPctBySymbol = useMemo(() => Object.fromEntries(heldPctByToken), [heldPctByToken]);
  const planRwaSymbols = useMemo(
    () => [...new Set(sleeveLegs.flatMap((l) => rwaLegFor(l.token)?.symbol ?? []))],
    [sleeveLegs],
  );
  const walletOnlyRwaSymbols = useMemo(
    () => [...new Set([...heldPctByToken.keys()].flatMap((t) => rwaLegFor(t)?.symbol ?? []))]
      .filter((symbol) => !planRwaSymbols.includes(symbol)),
    [heldPctByToken, planRwaSymbols],
  );
  const previewRwaSymbols = useMemo(
    () => [...new Set(balanceAllocations.flatMap((l) => rwaLegFor(l.token)?.symbol ?? []))],
    [balanceAllocations],
  );
  const rwaMarket = useRwaMarket(sleeveOpen);

  // Compare/picker mode: the ring previews the focused philosophy's plan
  // without committing it — the committed alignment/shape/since-last-visit
  // stay on strategyKey; only the ring and its hole read the preview.
  const previewKey =
    (comparing || !hasPlan) && focusedPhilosophy
      ? focusedPhilosophy
      : strategyKey;
  const previewAllocations = useMemo(() => {
    return resolvePlan({ customPlan: config.customPlan, strategy: previewKey, riskTolerance: config.riskTolerance, anchorCurrency }).legs;
  }, [previewKey, config.riskTolerance, anchorCurrency, config.customPlan]);
  const { rules: previewRules, floor: previewFloor } = resolvePlan({ customPlan: config.customPlan, strategy: previewKey, anchorCurrency });
  const previewAlignment = useMemo(
    () => scorePlanAlignment(previewAllocations, heldPctByToken, totalValue, previewRules),
    [previewAllocations, heldPctByToken, totalValue, previewRules],
  );
  const exitCompare = useCallback(() => {
    setFocusedToken(null);
    setComparing(false);
    setFocusedPhilosophy(null);
    setPhilosophyDetailsOpen(false);
  }, []);
  const toggleCompare = useCallback(() => {
    setFocusedToken(null);
    setComparing((c) => !c);
    if (comparing) {
      setFocusedPhilosophy(null);
      setPhilosophyDetailsOpen(false);
    }
  }, [comparing]);
  // A coin tap previews; a second tap on the already-focused coin opens
  // the details sheet. The ambient layer blooms from the tap point.
  const handlePhilosophySelect = useCallback(
    (id: string) => {
      const strategyId = id as FinancialStrategy;
      setFocusedToken(null);
      // Custom never starts empty: with no saved plan it opens the editor
      // on the wallet's current exposures.
      if (strategyId === "custom" && !config.customPlan) {
        const global = resolvePlan({ strategy: "global" });
        setComparing(false);
        setFocusedPhilosophy(null);
        setPhilosophyDetailsOpen(false);
        setAddingSlice(false);
        setCustomDraft(customFromHoldings(walletHoldings) ?? customFromLegs(global.legs, global.rules, "global"));
        return;
      }
      if (strategyId === focusedPhilosophy) {
        setPhilosophyDetailsOpen(true);
        return;
      }
      setPhilosophyDetailsOpen(false);
      setFocusedPhilosophy(strategyId);
      trackFunnelEvent("marquee_select", {
        strategy: strategyId,
        source: hasPlan ? "shield_compare" : "shield_picker",
      });
    },
    [focusedPhilosophy, hasPlan, config.customPlan, walletHoldings],
  );
  // While comparing, a slice tap only reads the previewed plan's leg —
  // the inspector stays on the philosophy, not the token.
  const handleCompareSliceSelect = useCallback((token: string | null) => {
    setFocusedToken((prev) => (token !== null && prev === token ? null : token));
  }, []);

  const openProtectionFlow = (
    targetToken: string,
    fromToken?: string,
    amount?: string,
  ) => {
    if (isDemo) {
      showToast("Connect your wallet to execute real swaps.", "info");
      return;
    }

    const sourceToken = fromToken || getBestFromToken(targetToken);
    const swapAmount = amount !== undefined ? amount : getSwapAmount(sourceToken);

    const sourceTokenObj = chains
      .flatMap((c) => c.balances as TokenBalance[])
      .find((t) => t.symbol === sourceToken && t.value > 0);

    const fromChainId = sourceTokenObj?.chainId;
    // The Exchange speaks config tickers (USDm/BRLm); the plan leg speaks the
    // wallet-facing name (cUSD/cREAL) for the same contract.
    const swapToken = configTokenFor(
      targetToken,
      fromChainId ?? NETWORKS.CELO_MAINNET.chainId,
    );
    let toChainId: number | undefined;

    if (fromChainId && NETWORK_TOKENS[fromChainId]?.includes(swapToken)) {
      toChainId = fromChainId;
    } else {
      const PREFERRED_CHAINS = [
        NETWORKS.CELO_MAINNET.chainId,
        NETWORKS.ARBITRUM_ONE.chainId,
      ];
      for (const id of PREFERRED_CHAINS) {
        if (NETWORK_TOKENS[id]?.includes(swapToken)) {
          toChainId = id;
          break;
        }
      }
      if (!toChainId) {
        for (const [chainIdStr, tokens] of Object.entries(NETWORK_TOKENS)) {
          if (tokens.includes(swapToken)) {
            toChainId = Number(chainIdStr);
            break;
          }
        }
      }
    }

    navigateToSwap({
      fromToken: sourceToken,
      toToken: swapToken,
      amount: swapAmount,
      reason: `Review protection move to ${targetToken} for ${planName}`,
      fromChainId,
      toChainId,
      origin: { source: "shield", asset: targetToken, label: planName },
    });
  };

  const reviewGuardianTilt = () => {
    if (!guardianTilt) return;
    const { instrument, tilt, amountUsd } = guardianTilt;
    setTiltPreview(false);
    navigateToSwap({
      fromToken: getBestFromToken(instrument.symbol),
      toToken: instrument.symbol,
      toChainId: instrument.chainId,
      amount: amountUsd ? String(amountUsd) : undefined,
      reason: tilt.reason,
      origin: { source: "guardian" },
    });
  };

  const getBestFromToken = (targetToken: string): string => {
    const allTokens = chains.flatMap((c) => c.balances as TokenBalance[]);
    const tokensWithBalances = allTokens
      .filter((t) => t.value > 0)
      .sort((a, b) => b.value - a.value);
    if (tokensWithBalances.length === 0) return "USDC";
    if (targetToken === "PAXG") {
      const highInflationTokens = ["KESm", "COPm", "ZARm", "BRLm", "XOFm", "GHSm", "NGNm"];
      const found = tokensWithBalances.find((t) =>
        highInflationTokens.some((hit) => t.symbol.toUpperCase().includes(hit.toUpperCase())),
      );
      if (found) return found.symbol;
    }
    const largestNonTarget = tokensWithBalances.find(
      (t) => t.symbol.toUpperCase() !== targetToken.toUpperCase(),
    );
    return largestNonTarget?.symbol || tokensWithBalances[0]?.symbol || "USDC";
  };

  const getSwapAmount = (fromToken: string): string => {
    const token = chains
      .flatMap((c) => c.balances as TokenBalance[])
      .find((t) => t.symbol === fromToken);
    const balance = token?.value || 0;
    if (balance <= 0) return "10";
    const percentage = config.userGoal === "geographic_diversification" ? 0.25 : 0.5;
    return (balance * percentage).toFixed(2);
  };

  // One truth: the ring's own slices are the plan. The score is exposure
  // overlap — how much of the wallet already follows it.
  const alignment = useMemo(
    () => scorePlanAlignment(allocations, heldPctByToken, totalValue, planRules),
    [allocations, heldPctByToken, totalValue, planRules],
  );

  const prevStrategyRef = useRef(selectedStrategy);
  useEffect(() => {
    if (
      prevStrategyRef.current &&
      selectedStrategy &&
      prevStrategyRef.current !== selectedStrategy
    ) {
      const data = getStrategyById(selectedStrategy);
      const score = alignment.score;
      const msg =
        score == null
          ? `${data?.icon ?? ""} Switched to ${data?.name ?? selectedStrategy}.`
          : `${data?.icon ?? ""} Switched to ${
              data?.name ?? selectedStrategy
            } — ${score}% aligned.`;
      showToast(msg, score != null && score < 50 ? "warning" : "success");
    }
    prevStrategyRef.current = selectedStrategy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategy]);

  // One-shot notice when a retired HALO/TACO philosophy was migrated to
  // Global on load (see use-protection-profile).
  useEffect(() => {
    if (consumeRetiredPhilosophyNotice()) {
      showToast(
        "HALO/TACO plans were retired — you're on Global Diversification. Tap the ring centre to compare philosophies.",
        "info",
      );
    }
  }, [showToast]);

  // Single source of truth: the pattern layer tints with the archetype's
  // own accent token — the same color the ring badge and plan cards use
  // (Sylva's "one palette, derived facets" discipline). Shared with the
  // unconnected morph via shieldPatternFor.
  const pattern = useMemo(() => shieldPatternFor(strategyKey), [strategyKey]);

  // Quiet memory: last session's alignment for this plan, so a returning
  // visitor sees the drift without anyone claiming fresh insight.
  const previousAlignment = useSinceLastVisit(
    `shield-alignment:${strategyKey ?? "none"}`,
    hasPlan && alignment.score != null ? Math.round(alignment.score) : null,
  );
  const alignmentSinceHint = (() => {
    if (!hasPlan || !previousAlignment || alignment.score == null) return null;
    const now = Date.now();
    if (now - previousAlignment.at < MIN_SNAPSHOT_AGE_MS) return null;
    const current = Math.round(alignment.score);
    const elapsed = formatElapsed(previousAlignment.at, now);
    if (previousAlignment.value === current) return `steady · ${elapsed}`;
    const dir = current > previousAlignment.value ? "up" : "down";
    return `${dir} from ${previousAlignment.value}% · ${elapsed}`;
  })();

  const shape = deriveShieldShape({
    hasPlan,
    hasFunds: totalValue > 0,
    alignmentScore: alignment.score ?? 0,
    guardianMonitoring: guardianState === "monitoring",
  });

  // "Try a stronger floor" lens — only helps when the wallet already holds
  // MORE dollars than the plan asks for. Under-reserved is the gap CTA's
  // job. The offer opens the existing balance preview — nothing commits.
  const floorOffer = useMemo(
    () =>
      strongerFloorOffer({
        savedRisk: config.riskTolerance,
        planLegs: allocations,
        heldPctByToken,
        floor: planFloor,
      }),
    [config.riskTolerance, allocations, heldPctByToken, planFloor],
  );
  const showFloorPrompt =
    floorOffer !== null &&
    hasPlan &&
    planRingVisible &&
    shape !== "picker" &&
    shape !== "fund" &&
    !comparing &&
    !balance.isPreviewing &&
    !sleeveOpen &&
    !focusedToken;
  // Offered = the prompt is actually the chosen transition (sleeve back
  // and the compare row are already excluded by showFloorPrompt) on a
  // live, non-demo surface.
  useLensOffered("protect", "floor", showFloorPrompt && !isDemo);
  const selectedAlloc = allocations.find((a) => a.token === focusedToken) ?? null;
  const selectedHeld = focusedToken ? heldPctByToken.get(focusedToken) ?? 0 : 0;
  const gapPct = selectedAlloc ? selectedAlloc.percent - selectedHeld : 0;
  const isPaymentCycle = config.moneyPurpose === "upcoming_payment";
  // Business morph (§5 rail 4): Shield's status rail offers the
  // payment-cycle entry instead of the RWA rail — connected and
  // walletless. The cycle is plan-independent; it needs no ring.
  const businessMorph =
    adaptiveConfig.content.shieldMorph === "cycle" || isPaymentCycle;
  // The CTA offers a gap the user's network can actually fill when one
  // exists — it never disappears because a leg lives elsewhere.
  const biggestGap = useMemo(
    () => pickBiggestFillableGap(alignment.legs, chainId),
    [alignment.legs, chainId],
  );

  // The live line — dated macro beats on plan-leg currencies and the
  // local leg's watch cadence. Resting states only: it vanishes while
  // comparing, previewing, or when a slice/cycle or the gap CTA owns the
  // attention (two competing lines never share the surface).
  const { data: liveFeed } = useProofFeed();
  const liveBeats = useMemo(
    () => shieldBeats({ records: liveFeed?.recent, legs: allocations }),
    [liveFeed, allocations],
  );
  const [acted, setActed] = useState(false);
  useEffect(() => setActed(false), [address, strategyKey]);
  const gapCtaShowing =
    !comparing &&
    !balance.isPreviewing &&
    shape === "gap" &&
    !focusedToken &&
    !cycleOpen &&
    biggestGap &&
    address &&
    guardianState !== "monitoring";
  const liveLineShowing =
    !comparing &&
    !balance.isPreviewing &&
    !focusedToken &&
    !cycleOpen &&
    !gapCtaShowing;

  useShieldIntent({
    address,
    isDemo,
    isLoading,
    portfolio,
    isPreviewing: balance.isPreviewing,
    hasPlan,
    shape,
    allocations,
    heldPctByToken,
    setComparing,
    setFocusedToken,
    openCycle,
  });

  const learnMix = useMemo(() => {
    const legs = resolvePlan({ customPlan: config.customPlan, strategy: focusedPhilosophy, riskTolerance: config.riskTolerance, anchorCurrency }).legs;
    if (legs.length > 0) return mixFromLegs(legs);
    return mixForPhilosophy(focusedPhilosophy);
  }, [focusedPhilosophy, config.riskTolerance, anchorCurrency, config.customPlan]);
  const learnMixLabel = mixLabelFor(
    focusedPhilosophy,
    learnMix,
    STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name,
  );
  const learnRates: InflationRates = useMemo(() => {
    const byRegion: Record<string, number> = {};
    for (const [region, entry] of Object.entries(FALLBACK_INFLATION_DATA)) {
      byRegion[region] = entry.avgRate;
    }
    const local = localInflationRate(userRegion, byRegion);
    return {
      local,
      usd: byRegion.USA ?? 4.1,
      eur: byRegion.Europe ?? 6.8,
      africa: byRegion.Africa ?? local,
      latam: byRegion.LatAm ?? local,
      asia: byRegion.Asia ?? local,
      europe: byRegion.Europe ?? 6.8,
    };
  }, [userRegion]);
  const currencyCode = riskData?.code ?? "USD";
  const learnAmount =
    learnAmountOverride ??
    (totalValue > 0 ? Math.max(1, Math.round(totalValue)) : exampleSavingsFor(currencyCode));
  const learnSeries = useMemo(
    () => seriesFor(learnAmount, learnMix, learnRates, 5),
    [learnAmount, learnMix, learnRates],
  );

  // Keep the plan Guardian follows in step with the plan the user just
  // chose — silently, only when a cached wallet proof exists (a plan
  // commit must never surprise the user with a signature prompt). When
  // there's no proof, Limits & controls shows the mismatch with a
  // one-tap "Follow" instead.
  const followOnGuardian = useCallback(
    (plan: FinancialStrategy) => {
      if (
        address &&
        !isDemo &&
        vault.vault?.strategy &&
        getCachedWalletAuth(address)
      ) {
        void vault.updateStrategy(address, plan, allocationPlanFromResolved(resolvePlan({
          strategy: plan, riskTolerance: config.riskTolerance, anchorCurrency,
        }))).then((saved) => {
          if (!saved) showToast('Plan saved on this device. Guardian targets could not be synced; use Follow in Guardian.', 'warning');
        }).catch(() => showToast('Guardian targets could not be synced.', 'warning'));
      }
    },
    [address, isDemo, vault, config.riskTolerance, anchorCurrency, showToast],
  );

  const commitFocusedPlan = useCallback(() => {
    if (!focusedPhilosophy) return;
    // A shared plan card settles when the committed plan is the card's —
    // coarse attribution only (source card), never the plan's numbers.
    if (shareLandingFor("plan_card") === focusedPhilosophy) {
      trackFunnelEvent("share_settled", { source: "plan_card" });
    }
    if (isDemo) {
      setDemoStrategy(focusedPhilosophy);
    } else {
      setFinancialStrategy(focusedPhilosophy);
    }
    setFocusedPhilosophy(null);
    setFocusedToken(null);
    setComparing(false);
    setPhilosophyDetailsOpen(false);
    haptics.confirm();
    if (!isDemo) followOnGuardian(focusedPhilosophy);
    if (!isDemo && address && chainId) {
      void Promise.resolve(
        recordActivity({
          action: "protection",
          chainId,
          networkType: NETWORKS.CELO_MAINNET.chainId === chainId ? "mainnet" : "testnet",
        }),
      ).catch(() => {});
    }
  }, [address, chainId, focusedPhilosophy, recordActivity, setFinancialStrategy, followOnGuardian, isDemo, setDemoStrategy]);

  // "Tweak this plan": a philosophy's (unshifted) plan becomes a Custom draft.
  const startTweak = useCallback(
    (from: string | null) => {
      if (!from) return;
      const base = resolvePlan({ strategy: from, customPlan: config.customPlan });
      if (base.legs.length === 0) return;
      setFocusedToken(null);
      setComparing(false);
      setFocusedPhilosophy(null);
      setPhilosophyDetailsOpen(false);
      setTiltPreview(false);
      if (balance.isPreviewing) balance.cancel();
      setAddingSlice(false);
      setCustomDraft(
        from === "custom" && config.customPlan
          ? config.customPlan
          : customFromLegs(base.legs, base.rules, from),
      );
      haptics.tap();
    },
    [config.customPlan, balance],
  );
  const draftPlan = useMemo(
    () => (customDraft ? resolvePlan({ strategy: "custom", customPlan: customDraft, anchorCurrency }) : null),
    [customDraft, anchorCurrency],
  );
  const addable = useMemo(
    () => (customDraft ? addableExposures(customDraft, walletHoldings) : []),
    [customDraft, walletHoldings],
  );
  const cancelCustom = useCallback(() => {
    setCustomDraft(null);
    setAddingSlice(false);
    setFocusedToken(null);
    haptics.tap();
  }, []);
  const saveCustom = useCallback(() => {
    if (!customDraft) return;
    if (isDemo) {
      showToast("Sample only. Exit sample mode to save a custom plan.", "info");
      return;
    }
    setCustomPlan(customDraft);
    setFinancialStrategy("custom");
    setCustomDraft(null);
    setAddingSlice(false);
    setFocusedToken(null);
    haptics.confirm();
    showToast("Custom plan saved. Your holdings have not moved.", "success");
  }, [customDraft, setCustomPlan, setFinancialStrategy, showToast, isDemo]);

  // Privacy switch — every dollar figure (gap CTA, slice inspector) renders
  // through formatMoney so the eye toggle masks it.
  const { formatMoney: fmt } = useBalanceVisibility();

  if (address && !isDemo && isLoading && portfolio?.lastUpdated == null) {
    return <ProtectionSkeleton />;
  }

  // In compare the rail's checked coin falls back to the current plan, so
  // the hole names that plan even before the user picks another.
  const effectiveFocus = comparing
    ? focusedPhilosophy ?? strategyKey
    : focusedPhilosophy;
  const focusedStrategyName =
    STRATEGIES.find((s) => s.id === effectiveFocus)?.name ?? "";
  // Hole copy for compare/picker — the focused plan's name and a compact
  // delta ("+15% PAXG · −10% KESm") against the committed plan.
  const compareHole = (() => {
    if (!effectiveFocus) {
      return { label: "Choose a philosophy", hint: "" };
    }
    if (hasPlan && effectiveFocus === strategyKey) {
      return { label: focusedStrategyName, hint: "Your plan" };
    }
    return {
      label: focusedStrategyName,
      hint: hasPlan ? compactPlanDelta(allocations, previewAllocations) : "",
    };
  })();

  const draftLeg = draftPlan?.legs.find((l) => l.token === focusedToken) ?? null;
  const draftIndex = customDraft && draftLeg ? sliceIndexForLeg(customDraft, draftLeg) : -1;
  const draftSlice = customDraft && draftIndex >= 0 ? customDraft.slices[draftIndex] : null;
  const stepDraft = (direction: 1 | -1) => {
    if (!customDraft || draftIndex < 0) return;
    const next = stepSlice(customDraft, draftIndex, direction);
    if (next.slices.length < customDraft.slices.length) setFocusedToken(null);
    setCustomDraft(next);
    haptics.tap();
  };
  const customName = customDraft
    ? `Custom · from ${
        customDraft.from ? STRATEGIES.find((s) => s.id === customDraft.from)?.name ?? "a plan" : "your wallet"
      }`
    : "";
  // "Tweak this plan" is subordinate to the commit CTA it sits beside, so it
  // wears the quiet link register rather than a third CTA hue (it was violet,
  // against teal commit buttons on this tab and blue everywhere else).
  const tweakButton = (from: string | null, testId: string) =>
    from && !isDemo ? (
      <button
        type="button"
        data-testid={testId}
        onClick={() => startTweak(from)}
        className="link-quiet shrink-0"
      >
        {from === "custom" ? "Edit custom plan" : "Tweak this plan"}
      </button>
    ) : null;

  const customEditor = customDraft && draftPlan && (
    <div data-testid="shield-custom-editor">
      <ProtectionPlanRing
        strategyKey="custom"
        customPlan={customDraft}
        legs={draftPlan.legs}
        forcePlanLegs
        balancePreview
        savedLegs={allocations}
        ghostLegs={hasPlan ? allocations : undefined}
        ghostLabel="saved plan"
        portfolio={activePortfolio as MultichainPortfolio}
        selectedToken={draftLeg ? focusedToken : null}
        onSelectToken={(token) => {
          setAddingSlice(false);
          setFocusedToken(token);
        }}
        alignmentScore={null}
        holeOverride={draftLeg ? undefined : { label: customName, hint: "Tap a slice to adjust · not saved" }}
        floor={draftPlan.floor}
        controls={
          <div className="mt-3 space-y-2" data-testid="custom-plan-controls">
            {draftLeg && draftSlice ? (
              <div className="flex items-center justify-center gap-3" data-testid="custom-slice-stepper">
                <button
                  type="button"
                  data-testid="custom-step-down"
                  aria-label={`Decrease ${draftLeg.label ?? draftLeg.token} by ${CUSTOM_STEP}%`}
                  onClick={() => stepDraft(-1)}
                  disabled={customDraft.slices.length <= 2 && draftSlice.target <= CUSTOM_STEP}
                  className="min-h-tap min-w-tap rounded-full bg-gray-100 dark:bg-white/10 text-sm font-bold text-gray-900 dark:text-white disabled:opacity-40"
                >
                  −{CUSTOM_STEP}
                </button>
                <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums" aria-live="polite">
                  {draftLeg.label ?? draftLeg.token} {draftSlice.target}%
                </span>
                <button
                  type="button"
                  data-testid="custom-step-up"
                  aria-label={`Increase ${draftLeg.label ?? draftLeg.token} by ${CUSTOM_STEP}%`}
                  onClick={() => stepDraft(1)}
                  disabled={draftSlice.target >= 100 - CUSTOM_STEP * (customDraft.slices.length - 1)}
                  className="min-h-tap min-w-tap rounded-full bg-gray-100 dark:bg-white/10 text-sm font-bold text-gray-900 dark:text-white disabled:opacity-40"
                >
                  +{CUSTOM_STEP}
                </button>
              </div>
            ) : addingSlice ? (
              <div className="flex flex-wrap justify-center gap-1.5" data-testid="custom-add-options">
                {addable.map((a) => (
                  <button
                    key={a.exposure}
                    type="button"
                    data-testid={`custom-add-${a.exposure}`}
                    onClick={() => {
                      setCustomDraft(addSlice(customDraft, a.exposure));
                      setAddingSlice(false);
                      haptics.tap();
                    }}
                    className="min-h-tap px-3 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-semibold text-gray-900 dark:text-white"
                  >
                    {a.label}
                    {a.chain && <span className="font-medium text-gray-500 dark:text-gray-400"> · {a.chain}</span>}
                  </button>
                ))}
              </div>
            ) : customDraft.slices.length < CUSTOM_MAX_SLICES && addable.length > 0 ? (
              <button
                type="button"
                data-testid="custom-add"
                onClick={() => { setAddingSlice(true); haptics.tap(); }}
                className="mx-auto flex min-h-tap items-center rounded-full px-3 text-xs font-semibold text-action dark:text-action hover:bg-action/8 dark:hover:bg-action/15 transition-colors"
              >
                + Add
              </button>
            ) : null}
            <div className="flex justify-center gap-2">
              <button
                type="button"
                data-testid="custom-save"
                onClick={saveCustom}
                disabled={isDemo}
                className="min-h-tap px-5 rounded-full text-sm font-semibold bg-action text-white hover:bg-action-hover active:bg-action-hover transition-colors disabled:opacity-50"
              >
                Save plan
              </button>
              <button
                type="button"
                data-testid="custom-cancel"
                onClick={cancelCustom}
                className="min-h-tap px-4 rounded-full text-sm font-semibold text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        }
      />
    </div>
  );

  const object = (
    <div
      onPointerDownCapture={() => setActed(true)}
      onFocusCapture={() => setActed(true)}
    >
      {customEditor || (
      <>
      {shape === "picker" && (
        <div data-testid="shield-picker">
          {/* The picker IS the compact ring + coin rail: a coin previews
              the philosophy's legs in the empty track, a second tap opens
              details, "Use this plan" commits. Nothing appends below. */}
          <ProtectionPlanRing
            strategyKey={previewKey ?? archetypeToStrategy(ARCHETYPE_ORDER[0])}
            customPlan={config.customPlan}
            legs={previewAllocations}
            savedLegs={[]}
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={null}
            onSelectToken={() => {}}
            alignmentScore={null}
            empty
            compact
            holeOverride={compareHole}
            floor={previewFloor}
          />
          <PhilosophyCoinRail
            selected={focusedPhilosophy}
            onSelect={handlePhilosophySelect}
            onTapPoint={(x, y) => ambient?.reportTapOrigin(x, y)}
          />
          <FocusedPlanLine strategyId={focusedPhilosophy} />
          {focusedPhilosophy && !philosophyDetailsOpen && (
            <div className="mt-1 flex justify-center gap-2">
              <button
                type="button"
                data-testid="picker-commit"
                onClick={commitFocusedPlan}
                className="min-h-tap px-6 rounded-full text-sm font-semibold bg-action text-white hover:bg-action-hover active:bg-action-hover transition-colors"
              >
                Use this plan
              </button>
              {tweakButton(focusedPhilosophy, "picker-tweak")}
            </div>
          )}
        </div>
      )}
      {planRingVisible && shape !== "picker" && (
        <div data-testid="shield-ring" data-comparing={comparing || undefined}>
          <ProtectionPlanRing
            strategyKey={previewKey}
            customPlan={config.customPlan}
            legs={
              comparing
                ? previewAllocations
                : tiltShowing && guardianTilt
                  ? guardianTilt.legs
                  : balance.isPreviewing
                    ? balanceAllocations
                    : allocations
            }
            forcePlanLegs={comparing || tiltShowing}
            compact={comparing}
            ghostLegs={
              comparing || tiltShowing
                ? allocations
                : guardianTilt && !balance.isPreviewing
                  ? guardianTilt.legs
                  : undefined
            }
            ghostLabel={!comparing && !tiltShowing && guardianTilt ? "Guardian suggestion" : undefined}
            holeOverride={
              comparing
                ? compareHole
                : tiltShowing && guardianTilt
                  ? { label: tiltLabel(guardianTilt.tilt), hint: "Guardian suggestion · not saved" }
                  : undefined
            }
            holeActionLabel={comparing ? "Exit compare" : undefined}
            balancePreview={balance.isPreviewing}
            savedLegs={allocations}
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={focusedToken}
            sample={isDemo}
            onSelectToken={comparing ? handleCompareSliceSelect : handleMarqueeSelect}
            alignmentScore={comparing ? previewAlignment.score : alignment.score}
            empty={shape === "fund"}
            onHoleTap={balance.isPreviewing ? undefined : toggleCompare}
            holeHintOverride={
              comparing && focusedPhilosophy ? "under this plan" : undefined
            }
            sleeveOpen={sleeveOpen}
            stilled={acted}
            floor={comparing ? previewFloor : planFloor}
            controls={!comparing && tiltShowing && guardianTilt ? (
              <div className="mt-3 space-y-2" data-testid="guardian-tilt-preview">
                <p className="text-center text-xs text-gray-600 dark:text-gray-300">
                  {guardianTilt.tilt.reason}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    data-testid="guardian-tilt-review"
                    onClick={reviewGuardianTilt}
                    className="min-h-tap px-5 rounded-full text-sm font-semibold bg-action text-white hover:bg-action-hover active:bg-action-hover transition-colors"
                  >
                    Review in Exchange
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTiltPreview(false); haptics.tap(); }}
                    className="min-h-tap px-4 rounded-full text-sm font-semibold text-gray-600 dark:text-gray-300"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ) : !comparing ? (
              <div className="mt-3">
                {guardianTilt && !balance.isPreviewing && (
                  <button
                    type="button"
                    data-testid="guardian-tilt-chip"
                    onClick={() => { setFocusedToken(null); setTiltPreview(true); haptics.tap(); }}
                    className="mx-auto mb-2 flex min-h-tap items-center rounded-full px-3 text-xs font-semibold text-action dark:text-action"
                  >
                    Guardian suggests {tiltLabel(guardianTilt.tilt)} →
                  </button>
                )}
                <PlanFloorControl
                  value={balance.risk}
                  legs={balance.isPreviewing ? balanceAllocations : allocations}
                  savedLegs={allocations}
                  isPreviewing={balance.isPreviewing}
                  onInteraction={() => setActed(true)}
                  floor={planFloor}
                  accent={(() => {
                    const id = strategyToArchetype(strategyKey);
                    return id ? ARCHETYPES[id].accent : undefined;
                  })()}
                  onChange={(risk) => {
                    setFocusedToken(null);
                    balance.select(risk);
                    trackFunnelEvent('marquee_select', { source: 'shield_balance', selection: risk });
                  }}
                  onApply={isDemo ? undefined : () => {
                    if (balance.commit()) {
                      setFocusedToken(null);
                      haptics.confirm();
                      showToast('Balance saved. Your holdings have not moved.', 'success');
                      if (address && strategyKey && strategyKey !== 'custom' && vault.vault && getCachedWalletAuth(address)) {
                        const committed = allocationPlanFromResolved(resolvePlan({
                          strategy: strategyKey, riskTolerance: balance.risk, anchorCurrency,
                        }));
                        void vault.updateStrategy(address, strategyKey, committed).then((saved) => {
                          if (!saved) showToast('Balance saved on this device. Guardian targets could not be synced; use Follow in Guardian.', 'warning');
                        }).catch(() => showToast('Guardian targets could not be synced.', 'warning'));
                      }
                    }
                  }}
                  onCancel={() => { balance.cancel(); setFocusedToken(null); haptics.tap(); }}
                />
                {showFloorPrompt && floorOffer && (
                  <button
                    type="button"
                    data-testid="shield-floor-prompt"
                    onClick={() => {
                      balance.select(floorOffer.next);
                      haptics.tap();
                      if (!isDemo) trackFunnelEvent("lens_open", { tab: "protect", lens: "floor" });
                    }}
                    className="min-h-tap text-left text-xs font-semibold text-blue-600 dark:text-blue-400"
                  >
                    Your wallet keeps {floorOffer.heldFloor}% in {planFloor === "USD" ? "dollars" : planFloor} vs {floorOffer.planFloor}% in this plan — try a stronger floor →
                  </button>
                )}
                {!balance.isPreviewing && !focusedToken && (
                  <div className="mt-1 flex justify-center">{tweakButton(strategyKey, "custom-tweak")}</div>
                )}
                {!businessMorph && !sleeveOpen && !comparing && !focusedToken && (
                  balance.isPreviewing ? (
                    (previewRwaSymbols.length > 0 || planRwaSymbols.length > 0 || walletOnlyRwaSymbols.length > 0) && (
                      <p data-testid="rwa-preview-context" className="mt-2 text-2xs text-ink-muted">
                        Preview plan · {previewRwaSymbols.length > 0
                          ? `tokenized ${previewRwaSymbols.join(" · ")}`
                          : `no tokenized assets${walletOnlyRwaSymbols.length > 0 ? ` · wallet holds ${walletOnlyRwaSymbols.join(" · ")}` : ""}`}
                      </p>
                    )
                  ) : (
                    <button
                      type="button"
                      data-testid="rwa-sleeve-entry"
                      onClick={() => setFocusedToken(SLEEVE_ID)}
                      className="mt-2 min-h-tap text-left text-xs font-semibold text-blue-600 dark:text-blue-400"
                    >
                      {[
                        planRwaSymbols.length > 0 && `${planRwaSymbols.join(" · ")} in this plan`,
                        walletOnlyRwaSymbols.length > 0 && `${walletOnlyRwaSymbols.join(" · ")} in your wallet, not the plan`,
                      ].filter(Boolean).join(" · ") || "Tokenized assets you could hold"} · Explore tokenized assets →
                    </button>
                  )
                )}
              </div>
            ) : undefined}
          />
          {liveLineShowing && (
            <LiveLine
              testId="shield-live-line"
              beats={liveBeats.map((b) => ({ key: b.key, content: b.text }))}
              alive={!acted && !cycleOpen && !tiltShowing}
              className="mt-2 block text-center text-2xs font-semibold text-gray-500 dark:text-gray-400"
            />
          )}
          {/* Compare transformation: the coin rail slides in under the
              compact ring — a tap previews, a second tap opens details,
              "Use this plan" commits. */}
          <AnimatePresence>
            {comparing && (
              <div data-testid="shield-compare" className="mt-3 space-y-2">
                <PhilosophyCoinRail
                  selected={focusedPhilosophy ?? strategyKey}
                  onSelect={handlePhilosophySelect}
                  onTapPoint={(x, y) => ambient?.reportTapOrigin(x, y)}
                />
                <FocusedPlanLine strategyId={focusedPhilosophy ?? strategyKey} />
                <div className="flex justify-center gap-2">
                  {focusedPhilosophy && focusedPhilosophy !== strategyKey && !philosophyDetailsOpen && !focusedToken && (
                    <button
                      type="button"
                      data-testid="compare-commit"
                      onClick={commitFocusedPlan}
                      className="min-h-tap px-6 rounded-full text-sm font-semibold bg-action text-white hover:bg-action-hover active:bg-action-hover transition-colors"
                    >
                      Use this plan
                    </button>
                  )}
                  {tweakButton(focusedPhilosophy ?? strategyKey, "compare-tweak")}
                </div>
              </div>
            )}
          </AnimatePresence>
          {!comparing && !balance.isPreviewing && shape === "gap" && !focusedToken && !cycleOpen &&
            biggestGap && address &&
            guardianState !== "monitoring" && (
            <div data-testid="shield-gap-cta" className="mt-3">
              <button
                type="button"
                data-testid="shield-biggest-gap-cta"
                onClick={() => handleMarqueeSelect(biggestGap.token)}
                className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
              >
                Close the biggest gap: {biggestGap.token} ~
                {fmt((biggestGap.gap / 100) * totalValue)}
              </button>
            </div>
          )}
          {shape === "fund" && !comparing && !balance.isPreviewing &&
            !focusedToken && !cycleOpen && (
            <div data-testid="shield-fund" className="mt-3 space-y-2">
              {isMiniPay ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Add cash with + in MiniPay.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!address) return;
                    try {
                      await navigator.clipboard.writeText(address);
                      showToast("Address copied", "success");
                    } catch {
                      showToast("Could not copy address", "error");
                    }
                  }}
                  className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
                >
                  Copy address
                </button>
              )}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );

  // The sleeve is shape-independent: a deep-link (?sleeve=rwa) or a vault
  // tap opens it even on the picker shape — the doorway must work
  // walletless and planless.
  // A coin tap only previews — the philosophy inspector opens on the
  // second tap (philosophyDetailsOpen). Slice taps still route normally.
  const inspectorSel = balance.isPreviewing || customDraft
    ? null
    : comparing
    ? focusedToken ?? (philosophyDetailsOpen ? focusedPhilosophy : null)
    : isSleeveSelection(focusedToken) || shape !== "picker"
      ? focusedToken
      : philosophyDetailsOpen
        ? focusedPhilosophy
        : null;

  const inspector = (
    <ShieldSliceInspector
      inspectorSel={inspectorSel}
      isPreviewing={balance.isPreviewing}
      comparing={comparing}
      focusedPhilosophy={focusedPhilosophy}
      focusedToken={focusedToken}
      focusedHeldAs={heldAsLine(
        walletView.holdings.find((h) => h.symbol === focusedToken),
        walletView.totalUsd,
      )}
      shape={shape}
      strategyKey={strategyKey}
      setFocusedToken={setFocusedToken}
      setFocusedPhilosophy={setFocusedPhilosophy}
      sleeveOpen={sleeveOpen}
      rwa={rwa}
      rwaServOn={rwaServOn}
      setRwaServOn={setRwaServOn}
      rwaMarket={rwaMarket.market}
      planPctBySymbol={planPctBySymbol}
      heldPctBySymbol={heldPctBySymbol}
      sleevePhilosophy={sleevePhilosophy}
      allocations={allocations}
      previewAllocations={previewAllocations}
      alignmentLegs={alignment.legs}
      chainId={chainId}
      address={address}
      learnAmount={learnAmount}
      setLearnAmountOverride={setLearnAmountOverride}
      learnSeries={learnSeries}
      learnYear={learnYear}
      setLearnYear={setLearnYear}
      learnMixLabel={learnMixLabel}
      currencyCode={currencyCode}
      commitFocusedPlan={commitFocusedPlan}
      askAdvisor={askAdvisor}
      totalValue={totalValue}
      fmt={fmt}
      selectedHeld={selectedHeld}
      selectedAlloc={selectedAlloc}
      gapPct={gapPct}
      riskData={riskData}
      visibility={visibility}
      sessionInfo={sessionInfo}
      navigateToGuardian={navigateToGuardian}
      reducedMotion={reducedMotion}
      walletFreshness={walletView.freshness}
      refreshBalances={refreshBalances}
      openProtectionFlow={openProtectionFlow}
      planName={planName}
      userRegion={userRegion}
      isPaymentCycle={isPaymentCycle}
      guardianState={guardianState}
      onSetUpGuardian={setUpGuardian}
      showToast={showToast}
      cycleOpen={cycleOpen && !balance.isPreviewing}
      cycleMode={cycleMode}
      sample={isDemo}
      onCloseCycle={() => setCycleOpen(false)}
      onOpenCycle={() => openCycle("next")}
    />
  );

  const status = (
    <ShieldStatusTier
      isPreviewing={balance.isPreviewing}
      guardianState={guardianState}
      shape={shape}
      sleeveOpen={sleeveOpen}
      comparing={comparing}
      focusedToken={focusedToken}
      selectedHeld={selectedHeld}
      selectedAlloc={selectedAlloc}
      planName={planName}
      address={address}
      biggestGap={biggestGap}
      alignmentScore={alignment.score}
      exitCompare={exitCompare}
      navigateToGuardian={navigateToGuardian}
      setFocusedToken={setFocusedToken}
      onSetUpGuardian={setUpGuardian}
      businessMorph={businessMorph}
      cycleOpen={cycleOpen}
      onOpenCycle={() => openCycle("next")}
      sinceHint={alignmentSinceHint ?? undefined}
    />
  );

  // A payment intent transforms the primary stage, with or without a wallet
  // or plan. The ring returns only when the user leaves the cycle.
  if (cycleOpen && !balance.isPreviewing) {
    return (
      <InstrumentShell
        object={inspector}
        status={isDemo ? <p className="text-xs text-ink-muted">Sample mode · no monitoring or execution</p> : undefined}
      />
    );
  }

  if (!address && !isDemo) {
    // The deep-linked sleeve (?sleeve=rwa) still opens its inspector on
    // this morph — the doorway works walletless. Everything else about
    // the unconnected object is unchanged.
    return (
      <ProtectionNotConnected
        experienceMode={experienceMode}
        onEnableDemo={enableDemoMode}
        inspector={sleeveOpen || cycleOpen ? inspector : undefined}
        inspectorOpen={sleeveOpen || cycleOpen}
        sleeveOpen={sleeveOpen}
        onOpenSleeve={() => setFocusedToken(SLEEVE_ID)}
        onCloseSleeve={() => setFocusedToken(null)}
        onOpenCycle={businessMorph ? () => openCycle("next") : undefined}
      />
    );
  }

  return (
    <div className="relative">
      <InstrumentShell
        inspectorOpen={Boolean(inspectorSel) || (cycleOpen && !balance.isPreviewing)}
        pattern={pattern}
        object={object}
        inspector={inspector}
        status={status}
        portfolio={{
          ...activePortfolio,
          isLoading: activePortfolio.isLoading || Boolean(isLoading),
          isDemo: isDemo || Boolean((activePortfolio as { isDemo?: boolean }).isDemo),
        }}
        onRefresh={refreshBalances}
      />

    </div>
  );
}

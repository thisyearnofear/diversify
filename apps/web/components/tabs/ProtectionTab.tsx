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
import { useDemoMode } from "@/context/app/DemoModeContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useProtectionProfile, consumeRetiredPhilosophyNotice } from "@/hooks/use-protection-profile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useFinancialStrategies, STRATEGIES } from "@/hooks/useFinancialStrategies";
import { useReducedMotion } from "framer-motion";
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
import { ProtectionPlanGallery } from "./protect/ProtectionPlanGallery";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { shieldPatternFor } from "./protect/shield-pattern";
import {
  getArchetypeAllocations,
  legsForRisk,
} from "@/components/protection-cards/plan-preview";
import { scorePlanAlignment } from "@/lib/plan-alignment";
import { canonicalToken, configTokenFor, isLegFillable, pickBiggestFillableGap } from "@/lib/plan-legs";
import { strongerFloorOffer } from "@/lib/shield-lens";
import { PlanFloorControl } from "./protect/PlanFloorControl";
import { deriveShieldShape } from "./protect/shield-shape";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import { useGuardianTierSnapshotFrom } from "../agent/AgentTierStatus";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { useVault } from "@/hooks/use-vault";
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
import { buildWalletPortfolioView } from "@/lib/wallet-portfolio-view";
import { rwaLegFor } from "./protect/rwa-assets";
import { SLEEVE_ID, VAULT_SLICE_PREFIX, isSleeveSelection } from "./protect/ProtectionPlanRing";
import { useRwaAllocation } from "@/hooks/use-rwa-allocation";
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
  const { demoMode, enableDemoMode } = useDemoMode();
  const { experienceMode } = useExperience();
  const { visibility } = useGuardianVisibility();
  const reducedMotion = useReducedMotion();
  const { askAdvisor } = useAdvisor();
  const isDemo = demoMode.isActive;

  const activePortfolio = (isDemo ? DEMO_PORTFOLIO : portfolio) as MultichainPortfolio;

  const [showMobileWizard, setShowMobileWizard] = useState(false);
  const { financialStrategy, setFinancialStrategy } = useStrategy();
  const { recordActivity } = useStreakRewards();
  const vault = useVault();
  const { requestPermission, signedPermission, sessionInfo, deriveGuardianState } =
    useSessionKey();
  const { guardianState } = useGuardianTierSnapshotFrom(vault, {
    signedPermission,
    sessionInfo,
    deriveGuardianState,
  });

  const { totalValue, chains } = activePortfolio;
  const { config, currentGoalLabel, setRiskTolerance } = useProtectionProfile();
  const { riskData } = useCurrencyRisk();
  const { selectedStrategy, getStrategyById } = useFinancialStrategies();
  const { showToast } = useToast();
  const strategyKey = (selectedStrategy || financialStrategy) as string | null;

  const [focusedToken, setFocusedToken] = useState<string | null>(null);
  const [focusedPhilosophy, setFocusedPhilosophy] = useState<FinancialStrategy | null>(null);
  const [comparing, setComparing] = useState(false);
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
    if (router.query.serv === "1" || router.query.serv === "true") {
      setRwaServOn(true);
    }
    // A shared plan card lands here: ?plan= previews the philosophy in
    // the same focused state the picker's flick/compare uses — never a
    // commit, never persisted.
    const plan = router.query.plan;
    if (typeof plan === "string" && STRATEGIES.some((s) => s.id === plan)) {
      setFocusedPhilosophy(plan as FinancialStrategy);
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
  const planRingVisible = useMemo(() => {
    if (!strategyKey) return false;
    const archetypeId = strategyToArchetype(strategyKey);
    return archetypeId ? getArchetypeAllocations(archetypeId).length > 0 : false;
  }, [strategyKey]);

  const allocations = useMemo(() => {
    if (!strategyKey) return [];
    const archetypeId = strategyToArchetype(strategyKey);
    const legs = archetypeId ? getArchetypeAllocations(archetypeId) : [];
    return legsForRisk(legs, config.riskTolerance);
  }, [strategyKey, config.riskTolerance]);
  const balanceAllocations = useMemo(() => {
    const id = strategyToArchetype(strategyKey);
    return id ? legsForRisk(getArchetypeAllocations(id), balance.risk) : [];
  }, [strategyKey, balance.risk]);

  const heldPctByToken = useMemo(() => {
    const map = new Map<string, number>();
    if (totalValue <= 0) return map;
    const balances = (chains ?? []).flatMap((c) => c.balances as TokenBalance[]);
    for (const b of balances) {
      if (b.value > 0) {
        const key = canonicalToken(b.symbol);
        map.set(key, (map.get(key) ?? 0) + (b.value / totalValue) * 100);
      }
    }
    return map;
  }, [chains, totalValue]);

  // The wedge the sleeve fans from — a held RWA token first (funded ring is
  // holdings), else the plan's RWA leg. Null means the sleeve is a preview.
  const sleeveHostSymbol = useMemo(() => {
    const held = [...heldPctByToken.keys()].find((t) => rwaLegFor(t));
    return held ?? allocations.find((a) => rwaLegFor(a.token))?.token ?? null;
  }, [heldPctByToken, allocations]);

  // Compare mode (Wave D): the ring previews the focused philosophy's plan
  // without committing it — the committed alignment/shape/since-last-visit
  // stay on strategyKey; only the ring and its hole read the preview.
  const previewKey =
    comparing && focusedPhilosophy ? focusedPhilosophy : strategyKey;
  const previewAllocations = useMemo(() => {
    if (!previewKey) return [];
    const archetypeId = strategyToArchetype(previewKey);
    const legs = archetypeId ? getArchetypeAllocations(archetypeId) : [];
    return legsForRisk(legs, config.riskTolerance);
  }, [previewKey, config.riskTolerance]);
  const previewAlignment = useMemo(
    () => scorePlanAlignment(previewAllocations, heldPctByToken, totalValue),
    [previewAllocations, heldPctByToken, totalValue],
  );
  const exitCompare = useCallback(() => {
    setFocusedToken(null);
    setComparing(false);
    setFocusedPhilosophy(null);
  }, []);
  const toggleCompare = useCallback(() => {
    setFocusedToken(null);
    setComparing((c) => !c);
    if (comparing) setFocusedPhilosophy(null);
  }, [comparing]);
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

  // One truth: the ring's own slices are the plan. The score is pure
  // token overlap — how much of the wallet already follows it.
  const alignment = useMemo(
    () => scorePlanAlignment(allocations, heldPctByToken, totalValue),
    [allocations, heldPctByToken, totalValue],
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

  const walletView = useMemo(
    () => buildWalletPortfolioView(activePortfolio, allocations),
    [activePortfolio, allocations],
  );

  // "Try a stronger floor" lens — only helps when the wallet already holds
  // MORE dollars than the plan asks for. Under-reserved is the gap CTA's
  // job. The offer opens the existing balance preview — nothing commits.
  const floorOffer = useMemo(
    () =>
      strongerFloorOffer({
        savedRisk: config.riskTolerance,
        planLegs: allocations,
        heldPctByToken,
      }),
    [config.riskTolerance, allocations, heldPctByToken],
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
  // The CTA offers a gap the user's network can actually fill when one
  // exists — it never disappears because a leg lives elsewhere.
  const biggestGap = useMemo(
    () => pickBiggestFillableGap(alignment.legs, chainId),
    [alignment.legs, chainId],
  );

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
  });

  const learnMix = useMemo(() => {
    const archetypeId = focusedPhilosophy
      ? strategyToArchetype(focusedPhilosophy)
      : null;
    if (archetypeId) {
      const legs = legsForRisk(
        getArchetypeAllocations(archetypeId),
        config.riskTolerance,
      );
      if (legs.length > 0) return mixFromLegs(legs);
    }
    return mixForPhilosophy(focusedPhilosophy);
  }, [focusedPhilosophy, config.riskTolerance]);
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

  const commitFocusedPlan = useCallback(() => {
    if (!focusedPhilosophy) return;
    // A shared plan card settles when the committed plan is the card's —
    // coarse attribution only (source card), never the plan's numbers.
    if (shareLandingFor("plan_card") === focusedPhilosophy) {
      trackFunnelEvent("share_settled", { source: "plan_card" });
    }
    setFinancialStrategy(focusedPhilosophy);
    setFocusedPhilosophy(null);
    setFocusedToken(null);
    setComparing(false);
    haptics.confirm();
    if (address && chainId) {
      void Promise.resolve(
        recordActivity({
          action: "protection",
          chainId,
          networkType: NETWORKS.CELO_MAINNET.chainId === chainId ? "mainnet" : "testnet",
        }),
      ).catch(() => {});
    }
  }, [address, chainId, focusedPhilosophy, recordActivity, setFinancialStrategy]);

  if (address && !isDemo && isLoading && portfolio?.lastUpdated == null) {
    return <ProtectionSkeleton />;
  }

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const object = (
    <>
      {shape === "picker" && (
        <div data-testid="shield-picker">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Choose a protection philosophy
          </p>
          <ProtectionPlanGallery
            selectedId={focusedPhilosophy}
            onInspect={(id) => {
              setFocusedToken(null);
              setFocusedPhilosophy((prev) => (prev === id ? null : id));
              trackFunnelEvent("marquee_select", {
                strategy: id,
                source: "shield_picker",
              });
            }}
          />
        </div>
      )}
      {planRingVisible && shape !== "picker" && (
        <div data-testid="shield-ring" data-comparing={comparing || undefined}>
          <ProtectionPlanRing
            strategyKey={previewKey}
            legs={comparing ? previewAllocations : balance.isPreviewing ? balanceAllocations : allocations}
            balancePreview={balance.isPreviewing}
            savedLegs={allocations}
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={focusedToken}
            onSelectToken={comparing ? handleCompareSliceSelect : handleMarqueeSelect}
            alignmentScore={comparing ? previewAlignment.score : alignment.score}
            empty={shape === "fund"}
            onHoleTap={balance.isPreviewing ? undefined : toggleCompare}
            holeHintOverride={
              comparing && focusedPhilosophy ? "under this plan" : undefined
            }
            sleeveOpen={sleeveOpen}
            sleeveVaults={rwa.allocations}
            sinceHint={alignmentSinceHint ?? undefined}
            controls={!comparing ? (
              <div className="mt-3">
                <PlanFloorControl
                  value={balance.risk}
                  legs={balance.isPreviewing ? balanceAllocations : allocations}
                  savedLegs={allocations}
                  isPreviewing={balance.isPreviewing}
                  accent={(() => {
                    const id = strategyToArchetype(strategyKey);
                    return id ? ARCHETYPES[id].accent : undefined;
                  })()}
                  onChange={(risk) => {
                    setFocusedToken(null);
                    balance.select(risk);
                    haptics.tap();
                    trackFunnelEvent('marquee_select', { source: 'shield_balance', selection: risk });
                  }}
                  onApply={isDemo ? undefined : () => {
                    if (balance.commit()) {
                      setFocusedToken(null);
                      haptics.confirm();
                      showToast('Balance saved. Your holdings have not moved.', 'success');
                    }
                  }}
                  onCancel={() => { balance.cancel(); setFocusedToken(null); haptics.tap(); }}
                />
              </div>
            ) : undefined}
          />
          {comparing && (
            <div data-testid="shield-compare" className="mt-3">
              <ProtectionPlanGallery
                selectedId={focusedPhilosophy}
                onInspect={(id) => {
                  setFocusedToken(null);
                  setFocusedPhilosophy((prev) => (prev === id ? null : id));
                  trackFunnelEvent("marquee_select", {
                    strategy: id,
                    source: "shield_compare",
                  });
                }}
              />
            </div>
          )}
          {!comparing && !balance.isPreviewing && shape === "gap" && !focusedToken &&
            biggestGap && address &&
            guardianState !== "monitoring" && (
            <div data-testid="shield-gap-cta" className="mt-3">
              <button
                type="button"
                data-testid="shield-biggest-gap-cta"
                onClick={() => handleMarqueeSelect(biggestGap.token)}
                className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
              >
                Close the biggest gap: {biggestGap.token} ~
                {fmt((biggestGap.gap / 100) * totalValue)}
              </button>
            </div>
          )}
          {shape === "fund" && !comparing && !balance.isPreviewing && (
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
                  className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
                >
                  Copy address
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  // The sleeve is shape-independent: a deep-link (?sleeve=rwa) or a vault
  // tap opens it even on the picker shape — the doorway must work
  // walletless and planless.
  const inspectorSel = balance.isPreviewing
    ? null
    : comparing
    ? focusedPhilosophy
    : isSleeveSelection(focusedToken) || shape !== "picker"
      ? focusedToken
      : focusedPhilosophy;

  const inspector = (
    <ShieldSliceInspector
      inspectorSel={inspectorSel}
      isPreviewing={balance.isPreviewing}
      comparing={comparing}
      focusedPhilosophy={focusedPhilosophy}
      focusedToken={focusedToken}
      shape={shape}
      strategyKey={strategyKey}
      setFocusedToken={setFocusedToken}
      setFocusedPhilosophy={setFocusedPhilosophy}
      sleeveOpen={sleeveOpen}
      rwa={rwa}
      rwaServOn={rwaServOn}
      setRwaServOn={setRwaServOn}
      sleeveHostSymbol={sleeveHostSymbol}
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
      setShowMobileWizard={setShowMobileWizard}
      showToast={showToast}
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
      planRingVisible={planRingVisible}
      sleeveHostSymbol={sleeveHostSymbol}
      address={address}
      isDemo={isDemo}
      biggestGap={biggestGap}
      alignmentScore={alignment.score}
      floorOffer={floorOffer}
      showFloorPrompt={showFloorPrompt}
      balanceSelect={balance.select}
      exitCompare={exitCompare}
      navigateToGuardian={navigateToGuardian}
      setFocusedToken={setFocusedToken}
      setShowMobileWizard={setShowMobileWizard}
    />
  );

  if (!address && !isDemo) {
    // The deep-linked sleeve (?sleeve=rwa) still opens its inspector on
    // this morph — the doorway works walletless. Everything else about
    // the unconnected object is unchanged.
    return (
      <ProtectionNotConnected
        experienceMode={experienceMode}
        onEnableDemo={enableDemoMode}
        inspector={sleeveOpen ? inspector : undefined}
      />
    );
  }

  return (
    <div className="relative">
      <InstrumentShell
        layout={inspectorSel === null && !balance.isPreviewing ? "calibrated" : "natural"}
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

      {showMobileWizard && address && (
        <GuardianMobileWizard
          userAddress={address}
          vaultAddress={vault.vault?.circleWalletAddress}
          onComplete={() => {
            setShowMobileWizard(false);
            if (address) vault.refresh(address);
          }}
          onCancel={() => setShowMobileWizard(false)}
          onCreateVault={async (strategy) => {
            return vault.createVault(address, strategy);
          }}
          onRequestPermission={async (dailyLimit) => {
            if (!address || !chainId) return false;
            try {
              const provider = (window as any).ethereum;
              if (!provider) return false;
              const { ethers } = await import("ethers");
              const ethersProvider = new ethers.providers.Web3Provider(provider);
              const signer = ethersProvider.getSigner();
              const result = await requestPermission("GUARDIAN", address, signer, chainId, {
                spendingLimitUSD: dailyLimit * 30,
                dailyLimitUSD: dailyLimit,
              });
              if (result) {
                await vault.refresh(address);
                return true;
              }
              return false;
            } catch {
              return false;
            }
          }}
        />
      )}
    </div>
  );
}

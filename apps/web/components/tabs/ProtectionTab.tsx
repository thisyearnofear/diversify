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
import { useToast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { useSinceLastVisit } from "@/hooks/use-since-last-visit";
import { MIN_SNAPSHOT_AGE_MS, formatElapsed } from "@/lib/since-last-visit";
import { useGuardianVisibility } from "@/context/app/GuardianVisibilityContext";
import { findTokenAttribution, newestExecutionAnchor } from "@/lib/agent/decision-attribution";
import { formatDuration, timeAgo } from "@/lib/format-duration";
import type { GuardianDecisionRef } from "@/context/app/NavigationContext";
import { motion, useReducedMotion } from "framer-motion";
import { springPop } from "@/lib/motion-tokens";
import { trackFunnelEvent } from "@/lib/analytics";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanRing } from "./protect/ProtectionPlanRing";
import { ProtectionPlanGallery } from "./protect/ProtectionPlanGallery";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { shieldPatternFor } from "./protect/shield-pattern";
import {
  describePlanDelta,
  getArchetypeAllocations,
  legsForRisk,
} from "@/components/protection-cards/plan-preview";
import { scorePlanAlignment } from "@/lib/plan-alignment";
import { canonicalToken, configTokenFor, isLegFillable, pickBiggestFillableGap } from "@/lib/plan-legs";
import { PlanFloorControl } from "./protect/PlanFloorControl";
import { deriveShieldShape } from "./protect/shield-shape";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import { useGuardianTierSnapshotFrom } from "../agent/AgentTierStatus";
import { PaymentCycleReport } from "./protect/PaymentCycleReport";
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
import { ProtectionCalculator } from "../inflation/ProtectionCalculator";
import ProtectionSkeleton from "../ui/skeletons/ProtectionSkeleton";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { TokenIcon } from "../shared/TokenIcon";
import { buildWalletPortfolioView, canSafelyExecute } from "@/lib/wallet-portfolio-view";
import StatusBadge from "../shared/StatusBadge";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { rwaLegFor } from "./protect/RwaAssetCards";
import { RwaVaultSleeve } from "./protect/RwaVaultSleeve";
import { SLEEVE_ID, VAULT_SLICE_PREFIX, isSleeveSelection } from "./protect/ProtectionPlanRing";
import { useRwaAllocation } from "@/hooks/use-rwa-allocation";
import { IXS_VAULT_BY_ID } from "@diversifi/shared/src/services/serv/ixs-vault-catalog";
import WalletButton from "../wallet/WalletButton";
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
  const { navigateToSwap, navigateToGuardian, compareRequested, consumeCompareRequest } = useNavigation();
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
    // One-shot URL consumption on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const sleeveOpen = !comparing && isSleeveSelection(focusedToken);
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

  const strategyKey = (selectedStrategy || financialStrategy) as string | null;
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

    setActiveTab?.("exchange");
    navigateToSwap({
      fromToken: sourceToken,
      toToken: swapToken,
      amount: swapAmount,
      reason: `Review protection move to ${targetToken} for ${planName}`,
      fromChainId,
      toChainId,
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
  const alignmentSinceLine = (() => {
    if (!hasPlan || !previousAlignment || alignment.score == null) return null;
    const now = Date.now();
    if (now - previousAlignment.at < MIN_SNAPSHOT_AGE_MS) return null;
    const current = Math.round(alignment.score);
    const elapsed = formatElapsed(previousAlignment.at, now);
    if (previousAlignment.value === current) {
      return `Alignment steady at ${current}% since your last visit (${elapsed})`;
    }
    return `Since you were here (${elapsed}): alignment ${previousAlignment.value}% → ${current}%`;
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

  // Deep link (e.g. Home's "Compare philosophies →"): open the ring's compare
  // mode once. No plan → the picker already IS the gallery; just consume.
  useEffect(() => {
    if (!compareRequested) return;
    if (hasPlan && shape !== "picker") {
      setFocusedToken(null);
      setComparing(true);
    }
    consumeCompareRequest();
  }, [compareRequested, hasPlan, shape, consumeCompareRequest]);

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
            legs={comparing ? previewAllocations : allocations}
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={focusedToken}
            onSelectToken={comparing ? handleCompareSliceSelect : handleMarqueeSelect}
            alignmentScore={comparing ? previewAlignment.score : alignment.score}
            empty={shape === "fund"}
            onHoleTap={toggleCompare}
            holeHintOverride={
              comparing && focusedPhilosophy ? "under this plan" : undefined
            }
            sleeveOpen={sleeveOpen}
            sleeveVaults={rwa.allocations}
          />
          {!comparing && (
            <div className="mt-3">
              <PlanFloorControl
                value={config.riskTolerance}
                legs={allocations}
                accent={(() => {
                  const id = strategyToArchetype(strategyKey);
                  return id ? ARCHETYPES[id].accent : undefined;
                })()}
                onChange={setRiskTolerance}
              />
            </div>
          )}
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
          {!comparing && shape === "gap" && !focusedToken &&
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
          {shape === "fund" && !comparing && (
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
  const inspectorSel = comparing
    ? focusedPhilosophy
    : isSleeveSelection(focusedToken) || shape !== "picker"
      ? focusedToken
      : focusedPhilosophy;

  const inspector = (
    <InspectorSheet
      selectedId={inspectorSel}
      onClose={() => {
        setFocusedToken(null);
        setFocusedPhilosophy(null);
      }}
      title={
        !comparing && isSleeveSelection(focusedToken)
          ? focusedToken === SLEEVE_ID
            ? "RWA vault sleeve"
            : (IXS_VAULT_BY_ID[focusedToken!.slice(VAULT_SLICE_PREFIX.length)]?.name ??
              "RWA vault")
          : shape === "picker" || comparing
            ? (STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? "Plan")
            : (focusedToken ?? "Slice")
      }
    >
      {sleeveOpen && (
        <RwaVaultSleeve
          allocations={rwa.allocations}
          summary={rwa.summary}
          source={rwa.source}
          loading={rwa.loading}
          degradedReason={rwa.degradedReason}
          receipt={rwa.receipt}
          servOn={rwaServOn}
          onToggleServ={setRwaServOn}
          focusedVaultId={
            focusedToken?.startsWith(VAULT_SLICE_PREFIX)
              ? focusedToken.slice(VAULT_SLICE_PREFIX.length)
              : null
          }
          onSelectVault={(id) =>
            setFocusedToken(id ? `${VAULT_SLICE_PREFIX}${id}` : SLEEVE_ID)
          }
          sleeveContext={sleeveHostSymbol ? `${sleeveHostSymbol} leg` : "preview"}
        />
      )}
      {(shape === "picker" || comparing) && focusedPhilosophy && (
        <div className="space-y-3">
          {comparing && (
            <p
              data-testid="plan-delta"
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              {focusedPhilosophy !== strategyKey
                ? describePlanDelta(allocations, previewAllocations)
                : "Your current plan"}
            </p>
          )}
          {(() => {
            const values =
              STRATEGIES.find((s) => s.id === focusedPhilosophy)?.values ?? [];
            if (values.length === 0) return null;
            return (
              <div data-testid="plan-values" className="flex flex-wrap gap-1.5">
                {values.slice(0, 3).map((v) => (
                  <span
                    key={v}
                    className="text-[11px] rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-500"
                  >
                    {v}
                  </span>
                ))}
              </div>
            );
          })()}
          {(() => {
            if (!comparing || !focusedToken) return null;
            const leg = previewAllocations.find((l) => l.token === focusedToken);
            if (!leg) return null;
            return (
              <div>
                <div
                  data-testid="compare-leg"
                  className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <TokenIcon symbol={leg.token} size={20} />
                  <span>
                    {leg.token} · {leg.percent}% — {leg.why}
                  </span>
                </div>
                {!isLegFillable(leg.token, chainId) && (
                  <p
                    data-testid="leg-unfillable"
                    className="mt-1 text-[11px] text-amber-600 dark:text-amber-400"
                  >
                    Not on this network — needs a bridge
                  </p>
                )}
              </div>
            );
          })()}
          <ProtectionCalculator
            amount={learnAmount}
            onAmountChange={setLearnAmountOverride}
            amountLabel={totalValue > 0 ? "Wallet value (editable)" : "Your savings amount"}
            currencyCode={currencyCode}
            series={learnSeries}
            selectedYear={learnYear}
            years={5}
            mixLabel={learnMixLabel}
            onSelectYear={setLearnYear}
            onProtect={commitFocusedPlan}
            ctaLabel="Use this plan"
          />
          <button
            type="button"
            onClick={() =>
              askAdvisor(
                `I'm considering the ${STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? focusedPhilosophy} protection plan. How does this mix protect ${currencyCode} savings over ${learnYear} years?`,
              )
            }
            className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this plan
          </button>
        </div>
      )}
      {shape !== "picker" && !comparing && focusedToken && !isSleeveSelection(focusedToken) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TokenIcon symbol={focusedToken} size={22} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{focusedToken} position</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={`${selectedHeld.toFixed(0)}% held${totalValue > 0 ? ` · ${fmt((selectedHeld / 100) * totalValue)}` : ""}`}
                  tone="info"
                  compact
                />
                {selectedAlloc ? (
                  <StatusBadge
                    label={`${selectedAlloc.percent}% target${totalValue > 0 ? ` · ${fmt((selectedAlloc.percent / 100) * totalValue)}` : ""}`}
                    tone={gapPct > 2 ? "warning" : "ready"}
                    compact
                  />
                ) : (
                  <StatusBadge label="Not in plan" tone="neutral" compact />
                )}
              </div>
            </div>
          </div>
          {/* One sentence carries gap + plan vs held — numbers do the explaining (§6), badges stay quiet */}
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {selectedAlloc
              ? gapPct > 2
                ? `You're ${gapPct.toFixed(0)} points light${totalValue > 0 ? ` (≈ ${fmt((gapPct / 100) * totalValue)})` : ""} — plan ${selectedAlloc.percent}%, you hold ${selectedHeld.toFixed(0)}%${riskData ? ` · ${riskData.code} is the risk this offsets` : ""}.`
                : `On target — you hold ${selectedHeld.toFixed(0)}% vs ${selectedAlloc.percent}% plan${totalValue > 0 ? ` (≈ ${fmt((selectedHeld / 100) * totalValue)})` : ""}.`
              : `Outside the plan — you hold ${selectedHeld.toFixed(0)}%${totalValue > 0 ? ` (≈ ${fmt((selectedHeld / 100) * totalValue)})` : ""} in a token the plan doesn't use.`}
          </p>
          {(() => {
            const leg = alignment.legs.find((l) => l.token === focusedToken);
            if (!leg?.why || rwaLegFor(focusedToken)) return null;
            return (
              <p data-testid="leg-why" className="text-xs text-gray-500 dark:text-gray-400">
                {leg.why}
              </p>
            );
          })()}
          {/* F1 attribution — informed mode surfaces the Guardian's own
              user-scoped record for this slice (decline / proposal), or its
              last execution. Quiet mode and pre-instrumentation sessions
              render nothing; unmeasured durations are omitted, never 0. */}
          {visibility === "informed" && (() => {
            const attr = findTokenAttribution(sessionInfo, focusedToken);
            const anchor = newestExecutionAnchor(sessionInfo);
            if (!attr && !anchor) return null;
            const ms = formatDuration(attr?.durationMs ?? anchor?.durationMs);
            const line = attr
              ? `Guardian ${attr.kind === "decline" ? `stood down on ${focusedToken}` : `proposed a move for ${focusedToken}`} · ${timeAgo(attr.capturedAt)}${ms ? ` · decided in ${ms}` : ""}`
              : `Guardian's last execution · ${timeAgo(anchor!.capturedAt)}${ms ? ` · took ${ms}` : ""}`;
            const prompt = attr
              ? `Guardian, you ${attr.kind === "decline" ? "stood down" : "made a proposal"} on my ${focusedToken} position (${attr.status}${attr.reason ? ` — ${attr.reason}` : ""}). Explain what you saw and what would change your mind.`
              : `Guardian, walk me through your most recent execution for me (${anchor!.status}). What moved and why?`;
            const decisionRef: GuardianDecisionRef = attr
              ? {
                  capturedAt: attr.capturedAt,
                  kind: attr.kind === "decline" ? "decision" : "proposal",
                  source: attr.source,
                  status: attr.status,
                  reason: attr.reason,
                  targetToken: attr.targetToken,
                  durationMs: attr.durationMs,
                }
              : {
                  capturedAt: anchor!.capturedAt,
                  kind: "execution",
                  status: anchor!.status,
                  txHash: anchor!.txHash,
                  durationMs: anchor!.durationMs,
                };
            return (
              <motion.div
                key={focusedToken}
                initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springPop}
                className="space-y-1"
              >
                <button
                  type="button"
                  data-testid="guardian-attribution"
                  onClick={() => navigateToGuardian({ summary: line, prompt, decisionRef })}
                  className="min-h-[36px] text-left text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  {line} →
                </button>
                {anchor?.explorerUrl && (
                  <a
                    data-testid="guardian-attribution-receipt"
                    href={anchor.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] text-gray-500 dark:text-gray-400 underline decoration-gray-300 dark:decoration-gray-600"
                  >
                    On-chain receipt ({anchor.status})
                  </a>
                )}
              </motion.div>
            );
          })()}
          {!isLegFillable(focusedToken, chainId) && (
            <p
              data-testid="leg-unfillable"
              className="text-[11px] text-amber-600 dark:text-amber-400"
            >
              Not on this network — needs a bridge
            </p>
          )}
          {(() => {
            const rwa = rwaLegFor(focusedToken);
            if (!rwa) return null;
            return (
              <>
                <p data-testid="rwa-leg" className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {rwa.label} — {rwa.description}
                </p>
                <button
                  type="button"
                  data-testid="rwa-sleeve-rail"
                  onClick={() => setFocusedToken(SLEEVE_ID)}
                  className="min-h-[44px] text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  See this sleeve as licensed RWA vaults →
                </button>
              </>
            );
          })()}
          {/* One forward CTA per selection — the inspector is never a dead
              end (design-language §5: selection → gap inspector → one CTA).
              Which action shows depends on wallet state, not on whether the
              user "earned" a forward path. */}
          {!address && (
            <WalletButton variant="primary" className="w-full" />
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue > 0 && canSafelyExecute(walletView.freshness) && (
            <button
              type="button"
              onClick={() => openProtectionFlow(selectedAlloc.token)}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Review move to {selectedAlloc.token} (~
              {fmt((gapPct / 100) * totalValue)})
            </button>
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue > 0 && !canSafelyExecute(walletView.freshness) && (
            <div className="space-y-2">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Refresh wallet data before reviewing an executable protection move.
              </p>
              {refreshBalances && (
                <button
                  type="button"
                  onClick={() => void refreshBalances()}
                  className="min-h-[44px] w-full rounded-xl border border-blue-600 text-blue-600 dark:text-blue-400 text-sm font-bold px-4 transition-colors"
                >
                  Refresh wallet data
                </button>
              )}
            </div>
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue <= 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address);
                  showToast("Address copied — fund this wallet to start the plan", "success");
                } catch {
                  showToast("Could not copy address", "error");
                }
              }}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Fund this plan — copy deposit address
            </button>
          )}
          {address && selectedAlloc && gapPct <= 2 && (
            <button
              type="button"
              onClick={() => {
                if (guardianState === "monitoring") {
                  navigateToGuardian({
                    summary: `${focusedToken} — on target (${selectedHeld.toFixed(0)}% held vs ${selectedAlloc.percent}% plan)`,
                    prompt: `Guardian, keep monitoring my ${focusedToken} holding — it's on target at ${selectedHeld.toFixed(0)}% vs the ${selectedAlloc.percent}% plan for my ${planName} strategy. Flag me if it drifts.`,
                  });
                } else {
                  setShowMobileWizard(true);
                }
              }}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              {guardianState === "monitoring"
                ? "See Guardian activity"
                : "Have Guardian keep this aligned"}
            </button>
          )}
          {address && !selectedAlloc && (
            <button
              type="button"
              onClick={() =>
                askAdvisor(
                  `My ${focusedToken} holding (${selectedHeld.toFixed(0)}% of my wallet) is outside my ${planName} plan. What are my options — hold, swap into a plan token, or something else in ${userRegion}?`,
                )
              }
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Ask Guardian what to do with {focusedToken}
            </button>
          )}
          {(selectedAlloc || !address) && (
            <button
              type="button"
              onClick={() =>
                askAdvisor(
                  `I'm focused on my ${focusedToken} wallet holding (${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ''}). How should I correct this for my ${planName} plan in ${userRegion}?`,
                )
              }
              className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            >
              Ask Guardian about this slice
            </button>
          )}
          {isPaymentCycle && selectedAlloc && (
            <div className="pt-3 mt-3 border-t border-purple-100 dark:border-purple-900/30">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Payment cycle</span>
              </div>
              <PaymentCycleReport
                defaultLocalCurrency={riskData?.code}
                onAskGuardian={(prompt) => askAdvisor(prompt)}
              />
            </div>
          )}
        </div>
      )}
    </InspectorSheet>
  );

  const status = (
    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        {guardianState === "monitoring" ? (
          <StatusBadge label="Guardian monitoring" tone="ready" compact />
        ) : shape === "fund" ? (
          <StatusBadge label="Wallet needs funds" tone="warning" compact />
        ) : shape === "gap" ? (
          <StatusBadge label="Plan needs review" tone="info" compact />
        ) : (
          <StatusBadge label="Choose a plan" tone="neutral" compact />
        )}
        <VerifiedEvidence className="ml-auto" />
      </div>
      {alignmentSinceLine && (
        <p data-testid="shield-since-last-visit" className="text-[11px] text-gray-400 dark:text-gray-500">
          {alignmentSinceLine}
        </p>
      )}
      {/* RWA sleeve rail — the status/transition grammar (§5 rail 4). Plans
          with an RWA leg reach the sleeve through the hatched wedge; every
          other persona reaches it here. */}
      {sleeveOpen ? (
        <button
          type="button"
          data-testid="rwa-sleeve-back"
          onClick={() => setFocusedToken(null)}
          className="font-semibold text-blue-600 dark:text-blue-400"
        >
          ← Back to plan
        </button>
      ) : (
        !comparing &&
        planRingVisible &&
        !sleeveHostSymbol &&
        !focusedToken && (
          <button
            type="button"
            data-testid="rwa-sleeve-entry"
            onClick={() => setFocusedToken(SLEEVE_ID)}
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            RWA vaults: preview a yield sleeve →
          </button>
        )
      )}
      <div className="flex items-center justify-between gap-3">
      {comparing ? (
        <p data-testid="shield-compare-status">
          Comparing philosophies against your wallet ·{" "}
          <button
            type="button"
            onClick={exitCompare}
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            Keep {planName}
          </button>
        </p>
      ) : shape === "quiet" ? (
        <p data-testid="shield-quiet">Plan aligned. Guardian is monitoring.</p>
      ) : guardianState === "monitoring" ? (
        <p>Guardian is monitoring this plan.</p>
      ) : shape === "gap" && !focusedToken && biggestGap ? (
        // The biggest-gap CTA beneath the ring names the job — no
        // duplicate sentence here.
        null
      ) : (
        <p>
          {shape === "gap"
            ? "Tap a slice to close the gap."
            : shape === "fund"
              ? "Fund this plan to start protection."
              : "Choose your protection philosophy."}
        </p>
      )}
      {!comparing && address && guardianState === "monitoring" && (
        <button
          type="button"
          onClick={() => {
            // Carry the focused slice (or plan) so Guardian opens with
            // the user's context, not a generic status page.
            navigateToGuardian(
              focusedToken
                ? {
                    summary: `${focusedToken} — ${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ""}`,
                    prompt: `Guardian, what's the status on my ${focusedToken} holding (${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ""}) for my ${planName} plan?`,
                  }
                : undefined,
            );
          }}
          className="min-h-[44px] px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Guardian activity
        </button>
      )}
      {!comparing && address && guardianState !== "monitoring" &&
        !(shape === "gap" && !focusedToken && biggestGap) &&
        (shape === "quiet" || (alignment.score != null && alignment.score >= 80)) && (
        <button
          type="button"
          onClick={() => setShowMobileWizard(true)}
          className="min-h-[44px] px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Set up Guardian
        </button>
      )}
      </div>
    </div>
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

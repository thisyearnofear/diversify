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
import { trackFunnelEvent } from "@/lib/analytics";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanRing } from "./protect/ProtectionPlanRing";
import { ProtectionPlanGallery } from "./protect/ProtectionPlanGallery";
import { strategyToArchetype } from "@/components/protection-cards/tokens";
import { shieldPatternFor } from "./protect/shield-pattern";
import { getArchetypeAllocations } from "@/components/protection-cards/plan-preview";
import { scorePlanAlignment } from "@/lib/plan-alignment";
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
import WalletButton from "../wallet/WalletButton";

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
  const { config, currentGoalLabel } = useProtectionProfile();
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
    setFocusedToken(token);
    if (token) trackFunnelEvent("marquee_select", { token, source: "shield_ring" });
  }, []);

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
    return archetypeId ? getArchetypeAllocations(archetypeId) : [];
  }, [strategyKey]);

  const heldPctByToken = useMemo(() => {
    const map = new Map<string, number>();
    if (totalValue <= 0) return map;
    const balances = (chains ?? []).flatMap((c) => c.balances as TokenBalance[]);
    for (const b of balances) {
      if (b.value > 0) {
        map.set(b.symbol, (map.get(b.symbol) ?? 0) + (b.value / totalValue) * 100);
      }
    }
    return map;
  }, [chains, totalValue]);

  // Compare mode (Wave D): the ring previews the focused philosophy's plan
  // without committing it — the committed alignment/shape/since-last-visit
  // stay on strategyKey; only the ring and its hole read the preview.
  const previewKey =
    comparing && focusedPhilosophy ? focusedPhilosophy : strategyKey;
  const previewAllocations = useMemo(() => {
    if (!previewKey) return [];
    const archetypeId = strategyToArchetype(previewKey);
    return archetypeId ? getArchetypeAllocations(archetypeId) : [];
  }, [previewKey]);
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
    let toChainId: number | undefined;

    if (fromChainId && NETWORK_TOKENS[fromChainId]?.includes(targetToken)) {
      toChainId = fromChainId;
    } else {
      const PREFERRED_CHAINS = [
        NETWORKS.CELO_MAINNET.chainId,
        NETWORKS.ARBITRUM_ONE.chainId,
      ];
      for (const id of PREFERRED_CHAINS) {
        if (NETWORK_TOKENS[id]?.includes(targetToken)) {
          toChainId = id;
          break;
        }
      }
      if (!toChainId) {
        for (const [chainIdStr, tokens] of Object.entries(NETWORK_TOKENS)) {
          if (tokens.includes(targetToken)) {
            toChainId = Number(chainIdStr);
            break;
          }
        }
      }
    }

    setActiveTab?.("exchange");
    navigateToSwap({
      fromToken: sourceToken,
      toToken: targetToken,
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

  const learnMix = useMemo(
    () => mixForPhilosophy(focusedPhilosophy),
    [focusedPhilosophy],
  );
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

  if (!address && !isDemo) {
    return (
      <ProtectionNotConnected
        experienceMode={experienceMode}
        onEnableDemo={enableDemoMode}
      />
    );
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
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={focusedToken}
            onSelectToken={comparing ? () => {} : handleMarqueeSelect}
            alignmentScore={comparing ? previewAlignment.score : alignment.score}
            empty={shape === "fund"}
            onHoleTap={toggleCompare}
            holeHintOverride={
              comparing && focusedPhilosophy ? "under this plan" : undefined
            }
          />
          {comparing && (
            <div data-testid="shield-compare" className="mt-3">
              <ProtectionPlanGallery
                selectedId={focusedPhilosophy}
                onInspect={(id) => {
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
            alignment.biggestGap && address &&
            guardianState !== "monitoring" && (
            <div data-testid="shield-gap-cta" className="mt-3">
              <button
                type="button"
                data-testid="shield-biggest-gap-cta"
                onClick={() => handleMarqueeSelect(alignment.biggestGap!.token)}
                className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
              >
                Close the biggest gap: {alignment.biggestGap.token} ~
                {fmt((alignment.biggestGap.gap / 100) * totalValue)}
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

  const inspector = (
    <InspectorSheet
      selectedId={
        shape === "picker" || comparing ? focusedPhilosophy : focusedToken
      }
      onClose={() => {
        setFocusedToken(null);
        setFocusedPhilosophy(null);
      }}
      title={
        shape === "picker" || comparing
          ? (STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? "Plan")
          : (focusedToken ?? "Slice")
      }
    >
      {(shape === "picker" || comparing) && focusedPhilosophy && (
        <div className="space-y-3">
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
      {shape !== "picker" && !comparing && focusedToken && (
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
          {(() => {
            const rwa = rwaLegFor(focusedToken);
            if (!rwa) return null;
            return (
              <p data-testid="rwa-leg" className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {rwa.label} — {rwa.description}
              </p>
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
      <div className="flex items-center justify-between gap-3">
      {comparing ? (
        <p data-testid="shield-compare-status">
          Comparing against your wallet ·{" "}
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
      ) : shape === "gap" && !focusedToken && alignment.biggestGap ? (
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
        !(shape === "gap" && !focusedToken && alignment.biggestGap) &&
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
      {!comparing &&
        (shape === "gap" || shape === "fund") &&
        (alignment.score == null || alignment.score < 50) && (
          <p
            data-testid="shield-compare-hint"
            className="text-[11px] text-gray-400 dark:text-gray-500"
          >
            Not the right fit? Tap the ring centre to compare philosophies.
          </p>
        )}
    </div>
  );

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

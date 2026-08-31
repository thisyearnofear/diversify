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
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useAdvisor } from "@/hooks/use-advisor";
import { useFinancialStrategies } from "@/hooks/useFinancialStrategies";
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import { useToast } from "@/components/ui/Toast";
import { trackFunnelEvent } from "@/lib/analytics";
import { DEMO_PORTFOLIO } from "@/lib/demo-data";

import { ProtectionNotConnected } from "./protect/ProtectionNotConnected";
import { ProtectionPlanRing } from "./protect/ProtectionPlanRing";
import { ProtectionPlanGallery } from "./protect/ProtectionPlanGallery";
import { strategyToArchetype } from "@/components/protection-cards/tokens";
import { getArchetypeAllocations } from "@/components/protection-cards/plan-preview";
import { deriveShieldShape } from "./protect/shield-shape";
import DepositHub from "../onramp/DepositHub";
import { GuardianMobileWizard } from "../agent/GuardianMobileWizard";
import { useGuardianTierSnapshotFrom } from "../agent/AgentTierStatus";
import { PaymentCycleReport } from "./protect/PaymentCycleReport";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import { useVault } from "@/hooks/use-vault";
import { useSessionKey } from "@/hooks/use-session-key";
import ProtectionSkeleton from "../ui/skeletons/ProtectionSkeleton";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { TokenIcon } from "../shared/TokenIcon";

interface ProtectionTabProps {
  userRegion: Region;
  portfolio: MultichainPortfolio;
  isLoading?: boolean;
  onSelectStrategy?: (strategy: string) => void;
  setActiveTab?: (tab: import("@/constants/tabs").TabId) => void;
}

export default function ProtectionTab({
  userRegion,
  portfolio,
  isLoading,
  setActiveTab,
}: ProtectionTabProps) {
  const { address, chainId } = useWalletContext();
  const { navigateToSwap } = useNavigation();
  const { demoMode, enableDemoMode } = useDemoMode();
  const { experienceMode } = useExperience();
  const { askAdvisor } = useAdvisor();
  const isDemo = demoMode.isActive;

  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

  const [showMobileWizard, setShowMobileWizard] = useState(false);
  const { financialStrategy } = useStrategy();
  const vault = useVault();
  const { requestPermission, signedPermission, sessionInfo, deriveGuardianState } =
    useSessionKey();
  const { guardianState } = useGuardianTierSnapshotFrom(vault, {
    signedPermission,
    sessionInfo,
    deriveGuardianState,
  });

  const { totalValue, chains, regionData } = activePortfolio;
  const { config, currentGoalLabel } = useProtectionProfile();
  const { riskData } = useCurrencyRisk();
  const { selectedStrategy, getStrategyById } = useFinancialStrategies();
  const { showToast } = useToast();

  const [focusedToken, setFocusedToken] = useState<string | null>(null);
  const handleMarqueeSelect = useCallback((token: string | null) => {
    setFocusedToken(token);
    if (token) trackFunnelEvent("marquee_select", { token, source: "shield_ring" });
  }, []);

  const strategyKey = (selectedStrategy || financialStrategy) as string | null;
  const hasPlan = Boolean(strategyKey);
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
      reason: `Review protection move to ${targetToken} for ${currentGoalLabel}`,
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

  const protectionScore = Math.round(
    ((activePortfolio.diversificationScore ?? 0) +
      (100 - (activePortfolio.weightedInflationRisk || 0) * 5)) /
      2,
  );

  const strategyAlignmentScore = useMemo(() => {
    if (!selectedStrategy || !regionData.length) return protectionScore;
    const totalVal = regionData.reduce(
      (sum, region) => sum + (region.usdValue || region.value || 0),
      0,
    );
    if (totalVal === 0) return 0;
    const regionAllocations = regionData.reduce(
      (acc, region) => {
        acc[region.region] = ((region.usdValue || region.value || 0) / totalVal) * 100;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Math.round(
      StrategyService.calculateScore(selectedStrategy, regionAllocations as never).score,
    );
  }, [selectedStrategy, regionData, protectionScore]);

  const prevStrategyRef = useRef(selectedStrategy);
  useEffect(() => {
    if (
      prevStrategyRef.current &&
      selectedStrategy &&
      prevStrategyRef.current !== selectedStrategy
    ) {
      const data = getStrategyById(selectedStrategy);
      const msg = `${data?.icon ?? ""} Switched to ${
        data?.name ?? selectedStrategy
      } — ${strategyAlignmentScore}% aligned.`;
      showToast(msg, strategyAlignmentScore < 50 ? "warning" : "success");
    }
    prevStrategyRef.current = selectedStrategy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStrategy]);

  const patternClass = useMemo(() => {
    if (!strategyKey) return "";
    const normalized = strategyKey.replace("_finance", "").replace("_diversification", "");
    return `shields-pattern--${normalized}`;
  }, [strategyKey]);

  const patternColor = useMemo(() => {
    switch (strategyKey) {
      case "africapitalism":
        return "#d97706";
      case "buen_vivir":
        return "#0d9488";
      case "pan_caribbean":
        return "#06b6d4";
      case "confucian":
        return "#b91c1c";
      case "gotong_royong":
        return "#ea580c";
      case "islamic":
        return "#059669";
      case "halo":
        return "#7c3aed";
      case "taco":
        return "#0284c7";
      case "global_diversification":
      case "global":
        return "#0284c7";
      default:
        return "#64748b";
    }
  }, [strategyKey]);

  const shape = deriveShieldShape({
    hasPlan,
    hasFunds: totalValue > 0,
    alignmentScore: strategyAlignmentScore,
    guardianMonitoring: guardianState === "monitoring",
  });

  const selectedAlloc = allocations.find((a) => a.token === focusedToken) ?? null;
  const selectedHeld = selectedAlloc
    ? heldPctByToken.get(selectedAlloc.token) ?? 0
    : 0;
  const gapPct = selectedAlloc ? selectedAlloc.percent - selectedHeld : 0;
  const isPaymentCycle = config.moneyPurpose === "upcoming_payment";

  if (isLoading && address && !isDemo) {
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
          <ProtectionPlanGallery mobile />
        </div>
      )}
      {planRingVisible && shape !== "picker" && (
        <div data-testid="shield-ring">
          <ProtectionPlanRing
            strategyKey={strategyKey}
            portfolio={activePortfolio as MultichainPortfolio}
            selectedToken={focusedToken}
            onSelectToken={handleMarqueeSelect}
          />
        </div>
      )}
      {shape === "fund" && (
        <div className="mt-4" data-testid="shield-fund">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Add funds to put this plan to work.
          </p>
          <DepositHub compact />
        </div>
      )}
    </>
  );

  const inspector = (
    <InspectorSheet
      selectedId={focusedToken}
      onClose={() => setFocusedToken(null)}
      title={focusedToken ?? "Slice"}
    >
      {selectedAlloc && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TokenIcon symbol={selectedAlloc.token} size={22} />
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {gapPct > 2 ? (
                <>
                  You hold <strong>{selectedHeld.toFixed(0)}%</strong> — the plan
                  calls for <strong>{selectedAlloc.percent}%</strong>.
                </>
              ) : (
                <>
                  You hold <strong>{selectedHeld.toFixed(0)}%</strong> of a{" "}
                  <strong>{selectedAlloc.percent}%</strong> target — this slice is
                  on plan.
                </>
              )}
            </p>
          </div>
          {riskData && gapPct > 2 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {riskData.code} exposure is the risk this slice is meant to offset.
            </p>
          )}
          {gapPct > 2 && totalValue > 0 && (
            <button
              type="button"
              onClick={() => openProtectionFlow(selectedAlloc.token)}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Review move to {selectedAlloc.token} (~
              {fmt((gapPct / 100) * totalValue)})
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              askAdvisor(
                `I'm focused on my ${selectedAlloc.token} slice (${selectedHeld.toFixed(0)}% held vs ${selectedAlloc.percent}% target). How should I correct this for my ${currentGoalLabel} plan in ${userRegion}?`,
              )
            }
            className="min-h-[44px] w-full rounded-xl text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this slice
          </button>
          {isPaymentCycle && (
            <PaymentCycleReport
              defaultLocalCurrency={riskData?.code}
              onAskGuardian={(prompt) => askAdvisor(prompt)}
            />
          )}
        </div>
      )}
    </InspectorSheet>
  );

  const status = (
    <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
      {shape === "quiet" ? (
        <p data-testid="shield-quiet">Plan aligned. Guardian is monitoring.</p>
      ) : guardianState === "monitoring" ? (
        <p>Guardian is monitoring this plan.</p>
      ) : (
        <p>
          {shape === "gap"
            ? "Tap a slice to close the gap."
            : shape === "fund"
              ? "Fund the plan, then Guardian can watch it."
              : "Pick the philosophy the ring will follow."}
        </p>
      )}
      {address && (
        <button
          type="button"
          onClick={() => {
            if (guardianState === "monitoring") {
              setActiveTab?.("agent");
            } else {
              setShowMobileWizard(true);
            }
          }}
          className="min-h-[44px] px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          {guardianState === "monitoring" ? "Guardian activity" : "Set up Guardian"}
        </button>
      )}
    </div>
  );

  return (
    <div className="relative">
      {patternClass && (
        <div
          className={`shields-pattern-layer ${patternClass}`}
          style={{ color: patternColor }}
          aria-hidden="true"
        />
      )}
      <InstrumentShell object={object} inspector={inspector} status={status} />

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

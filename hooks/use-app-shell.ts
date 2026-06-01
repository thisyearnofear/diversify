/**
 * useAppShell — Aggregates all app-level state for the AppShell component.
 *
 * Prior to this hook, index.tsx passed 26 props through AppShell,
 * coupling the page orchestrator to every tab component.
 * This hook consolidates the state so AppShell can call it internally,
 * keeping index.tsx focused on the page-level concerns (onboarding gate,
 * confetti, SEO meta).
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigation } from "../context/app/NavigationContext";
import { useExperience } from "../context/app/ExperienceContext";
import { useUserRegion, type Region, REGIONS } from "./use-user-region";
import { useInflationData } from "./use-inflation-data";
import { useCurrencyPerformance } from "./use-currency-performance";
import { useMultichainBalances } from "./use-multichain-balances";
import { getChainAssets, NETWORKS } from "../config";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { useWalletTutorial } from "../components/wallet/WalletTutorial";
import { useVoiceIntent } from "./use-voice-intent";
import { useAnalytics } from "./use-analytics";
import { useAdvisor } from "./use-advisor";
import { useStreakRewards } from "./use-streak-rewards";
import { useProtectionProfile } from "./use-protection-profile";

export function useAppShell() {
  // ── Navigation ──
  const { activeTab, setActiveTab } = useNavigation();
  const { trackTabChange } = useAnalytics();

  // ── Experience mode ──
  const { experienceMode, setExperienceMode } = useExperience();

  // ── Wallet ──
  const {
    isMiniPay, isFarcaster, address, chainId: walletChainId, connect: connectWallet,
  } = useWalletContext();

  // ── Advisor ──
  const { openAdvisor, unreadCount } = useAdvisor();

  // ── Streak / Rewards ──
  const { isWhitelisted } = useStreakRewards();

  // ── Region ──
  const { region: detectedRegion, isLoading: isRegionLoading } = useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");

  useEffect(() => {
    if (!isRegionLoading && detectedRegion) setUserRegion(detectedRegion);
  }, [detectedRegion, isRegionLoading]);

  // ── Portfolio ──
  const { config: profileConfig } = useProtectionProfile();
  const multichainPortfolio = useMultichainBalances(address, profileConfig.userGoal || undefined);
  const { isLoading: isMultichainLoading, refresh } = multichainPortfolio;

  // ── Tokens ──
  const availableTokens = useMemo(
    () => getChainAssets(walletChainId || NETWORKS.CELO_MAINNET.chainId),
    [walletChainId],
  );

  // ── Data ──
  const { inflationData } = useInflationData();
  const shouldLoadCurrencyPerformance = activeTab === "overview";
  const { data: currencyPerformanceData } = useCurrencyPerformance("USD", shouldLoadCurrencyPerformance);

  // ── Wallet tutorial ──
  const { isTutorialOpen, openTutorial: openWalletTutorial, closeTutorial } = useWalletTutorial();

  // ── Voice ──
  const { handleTranscription } = useVoiceIntent({ onOpenWalletTutorial: openWalletTutorial });

  return {
    // Navigation
    activeTab,
    setActiveTab,
    trackTabChange,

    // Experience
    experienceMode,
    setExperienceMode,

    // Wallet
    address,
    walletChainId,
    isMiniPay,
    isFarcaster,
    connectWallet,
    isWhitelisted,

    // Advisor
    openAdvisor,
    unreadCount,

    // Region
    userRegion,
    setUserRegion,
    isRegionLoading,
    REGIONS,

    // Portfolio
    multichainPortfolio,
    isMultichainLoading,
    refresh,

    // Data
    inflationData,
    currencyPerformanceData,
    availableTokens,

    // Tutorial
    isTutorialOpen,
    openWalletTutorial,
    closeTutorial,

    // Voice
    handleTranscription,
  };
}
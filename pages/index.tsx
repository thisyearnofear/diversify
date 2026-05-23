import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useNavigation } from "../context/app/NavigationContext";
import { useExperience } from "../context/app/ExperienceContext";
import { useUserRegion, type Region, REGIONS } from "../hooks/use-user-region";
import { useInflationData, type RegionalInflationData } from "../hooks/use-inflation-data";
import { useCurrencyPerformance } from "../hooks/use-currency-performance";
import { useMultichainBalances } from "../hooks/use-multichain-balances";
import { getChainAssets, NETWORKS } from "../config";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { useWalletTutorial } from "../components/wallet/WalletTutorial";
import { useToast } from "../components/ui/Toast";
import { useVoiceIntent } from "../hooks/use-voice-intent";
import { useAnalytics } from "../hooks/use-analytics";
import { useAdvisor } from "../hooks/use-advisor";
import { useStreakRewards } from "../hooks/use-streak-rewards";
import { useProtectionProfile } from "../hooks/use-protection-profile";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";
import AppShell from "../components/app/AppShell";
import confetti from "canvas-confetti";

const ogImageUrl = "https://diversifiapp.vercel.app/embed-image.png";

const farcasterMeta = {
  version: "1",
  imageUrl: ogImageUrl,
  button: {
    title: "Open DiversiFi",
    action: {
      name: "DiversiFi",
      url: "https://diversifiapp.vercel.app",
      splashImageUrl: "https://diversifiapp.vercel.app/splash.png",
      splashBackgroundColor: "#8B5CF6",
    },
  },
};

export default function DiversiFiPage() {
  const { activeTab, setActiveTab } = useNavigation();
  const { experienceMode, setExperienceMode } = useExperience();
  const { showToast } = useToast();
  const { openAdvisor, unreadCount } = useAdvisor();
  const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal } = useStrategyModal();
  const { isWhitelisted } = useStreakRewards();

  const {
    isMiniPay, isFarcaster, address, chainId: walletChainId, connect: connectWallet,
  } = useWalletContext();

  const {
    isTutorialOpen, openTutorial: openWalletTutorial, closeTutorial,
  } = useWalletTutorial();

  const { handleTranscription } = useVoiceIntent({ onOpenWalletTutorial: openWalletTutorial });
  const { trackTabChange } = useAnalytics();

  const { region: detectedRegion, isLoading: isRegionLoading } = useUserRegion();
  const [userRegion, setUserRegion] = useState<Region>("Africa");

  const { config: profileConfig } = useProtectionProfile();
  const multichainPortfolio = useMultichainBalances(address, profileConfig.userGoal || undefined);
  const { isLoading: isMultichainLoading, refresh } = multichainPortfolio;

  const availableTokens = useMemo(
    () => getChainAssets(walletChainId || NETWORKS.CELO_MAINNET.chainId),
    [walletChainId],
  );

  const { inflationData } = useInflationData();
  const shouldLoadCurrencyPerformance = activeTab === "overview";
  const { data: currencyPerformanceData } = useCurrencyPerformance("USD", shouldLoadCurrencyPerformance);

  useEffect(() => {
    if (!isRegionLoading && detectedRegion) setUserRegion(detectedRegion);
  }, [detectedRegion, isRegionLoading]);

  // Onboarding gate — show only the modal until user completes
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("onboardingCompleted") === "true";
  });

  // Fire confetti the first time wallet connects
  const [hasCelebratedConnect, setHasCelebratedConnect] = useState(false);
  useEffect(() => {
    if (address && !hasCelebratedConnect) {
      setHasCelebratedConnect(true);
      if (onboardingComplete) {
        // Only celebrate if onboarding is already done (avoids double-confetti)
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
      }
    }
  }, [address, hasCelebratedConnect, onboardingComplete]);

  const handleOnboardingComplete = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setOnboardingComplete(true);
    closeStrategyModal();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-2 sm:p-4 transition-colors relative">
      <Head>
        <title>DiversiFi - Protect Your Savings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />

        <meta property="og:title" content="DiversiFi - Protect Your Savings" />
        <meta property="og:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DiversiFi - Protect Your Savings" />
        <meta name="twitter:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        <meta name="twitter:image" content={ogImageUrl} />

        <meta name="fc:miniapp" content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button, action: { ...farcasterMeta.button.action, type: "launch_miniapp" } } })} />
        <meta name="fc:frame" content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button.action, type: "launch_frame" } })} />
      </Head>

      {/* Onboarding gate: show only the StrategyModal for first-time users */}
      {!onboardingComplete && (
        <StrategyModal
          isOpen={true}
          onClose={handleOnboardingComplete}
          onConnectWallet={connectWallet}
          isWalletConnected={!!address}
          chainId={walletChainId ?? undefined}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* App shell: full app for returning/completed users */}
      {onboardingComplete && (
        <AppShell
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          trackTabChange={trackTabChange}
          experienceMode={experienceMode}
          setExperienceMode={setExperienceMode}
          address={address}
          isWhitelisted={isWhitelisted}
          isMiniPay={isMiniPay}
          isFarcaster={isFarcaster}
          walletChainId={walletChainId}
          connectWallet={connectWallet}
          openAdvisor={openAdvisor}
          unreadCount={unreadCount}
          multichainPortfolio={multichainPortfolio}
          isRegionLoading={isRegionLoading}
          userRegion={userRegion}
          setUserRegion={setUserRegion}
          REGIONS={REGIONS}
          inflationData={inflationData as Record<string, RegionalInflationData>}
          isMultichainLoading={isMultichainLoading}
          refresh={refresh}
          currencyPerformanceData={currencyPerformanceData}
          availableTokens={availableTokens}
          openWalletTutorial={openWalletTutorial}
          closeTutorial={closeTutorial}
          isTutorialOpen={isTutorialOpen}
          handleTranscription={handleTranscription}
        />
      )}
    </div>
  );
}

/**
 * AppShell — The main application layout once the user has completed onboarding.
 *
 * Calls useAppShell() for all state, then delegates to:
 *   - TabContentRouter  (tab routing, swipe, dynamic imports)
 *   - FloatingControls  (advisor FAB, tour triggers, guided tour)
 *
 * index.tsx handles only page-level concerns (onboarding gate, SEO, confetti).
 */
import { useAppShell } from "@/hooks/use-app-shell";
import { NETWORKS } from "@/config";
import TabNavigation from "@/components/ui/TabNavigation";
import { WalletTutorial } from "@/components/wallet/WalletTutorial";
import AppHeader from "@/components/app/AppHeader";

import TabContentRouter from "./TabContentRouter";
import FloatingControls from "./FloatingControls";

export default function AppShell() {
  const shell = useAppShell();

  const {
    activeTab, setActiveTab, trackTabChange,
    experienceMode, setExperienceMode,
    address, isWhitelisted, isFarcaster, walletChainId,
    connectWallet, openAdvisor, unreadCount,
    multichainPortfolio, isRegionLoading, userRegion, setUserRegion, REGIONS,
    inflationData, isMultichainLoading, refresh, currencyPerformanceData,
    availableTokens, isMiniPay,
    openWalletTutorial, closeTutorial, isTutorialOpen,
    handleTranscription,
  } = shell;

  const isTestnet = !!(
    walletChainId &&
    (walletChainId === NETWORKS.CELO_SEPOLIA.chainId ||
      walletChainId === NETWORKS.ARC_TESTNET.chainId ||
      walletChainId === NETWORKS.RH_TESTNET.chainId)
  );

  return (
    <div className="max-w-md mx-auto">
      <FloatingControls openAdvisor={openAdvisor} unreadCount={unreadCount} />

      {/* Testnet Warning Banner */}
      {isTestnet && (
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 mb-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span>🧪</span>
            <span>
              Testnet —&nbsp;
              {walletChainId === NETWORKS.CELO_SEPOLIA.chainId
                ? "Celo Sepolia"
                : walletChainId === NETWORKS.ARC_TESTNET.chainId
                  ? "Arc Testnet"
                  : "Robinhood Testnet"}
              &nbsp;(play money)
            </span>
          </div>
          <a
            href={
              walletChainId === NETWORKS.CELO_SEPOLIA.chainId
                ? "https://faucet.celo.org/sepolia"
                : walletChainId === NETWORKS.ARC_TESTNET.chainId
                  ? "https://faucet.circle.com"
                  : "https://faucet.testnet.chain.robinhood.com"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 dark:text-amber-300 underline hover:no-underline whitespace-nowrap"
          >
            Get funds →
          </a>
        </div>
      )}

      {/* Header */}
      <AppHeader
        experienceMode={experienceMode}
        setExperienceMode={setExperienceMode}
        address={address}
        isWhitelisted={isWhitelisted}
        isFarcaster={isFarcaster}
        handleTranscription={handleTranscription}
      />

      <TabNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        badges={{}}
        experienceMode={experienceMode}
      />

      {/* Tab content */}
      <TabContentRouter
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        trackTabChange={trackTabChange}
        multichainPortfolio={multichainPortfolio}
        isMultichainLoading={isMultichainLoading}
        refresh={refresh}
        isRegionLoading={isRegionLoading}
        userRegion={userRegion}
        setUserRegion={setUserRegion}
        REGIONS={REGIONS}
        inflationData={inflationData}
        currencyPerformanceData={currencyPerformanceData}
        availableTokens={availableTokens}
        walletChainId={walletChainId}
        isMiniPay={isMiniPay}
        isFarcaster={isFarcaster}
      />

      <WalletTutorial
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        onConnect={connectWallet}
        isMiniPay={isMiniPay}
      />
    </div>
  );
}
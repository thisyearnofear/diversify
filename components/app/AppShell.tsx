/**
 * AppShell — The main application layout once the user has completed onboarding.
 *
 * Calls useAppShell() once via AppShellProvider, then delegates to:
 *   - TabContentRouter  (tab routing, swipe, dynamic imports) — reads the
 *     same shared state via useAppShellContext(), no second hook instance.
 *   - FloatingControls  (advisor FAB, tour triggers, guided tour)
 *
 * index.tsx handles only page-level concerns (onboarding gate, SEO).
 */
import { AppShellProvider, useAppShellContext } from "@/context/app/AppShellContext";
import { NETWORKS } from "@/config";
import { shouldShowTestnetBanner } from "@/constants/testnet";
import TabNavigation from "@/components/ui/TabNavigation";
import { WalletTutorial } from "@/components/wallet/WalletTutorial";
import AppHeader from "@/components/app/AppHeader";
import { TabDiscoveryProvider } from "@/hooks/use-tab-discovery";

import TabContentRouter from "./TabContentRouter";
import FloatingControls from "./FloatingControls";

export default function AppShell() {
  return (
    <AppShellProvider>
      <AppShellInner />
    </AppShellProvider>
  );
}

function AppShellInner() {
  const {
    activeTab, setActiveTab,
    experienceMode, setExperienceMode,
    address, isWhitelisted, isFarcaster, walletChainId,
    connectWallet, openAdvisor, unreadCount,
    guardianUpdates, openGuardianReview, dismissGuardianUpdate, muteGuardianUpdateType,
    isMiniPay,
    openWalletTutorial, closeTutorial, isTutorialOpen,
    handleTranscription,
  } = useAppShellContext();

  const showTestnetBanner = shouldShowTestnetBanner(walletChainId);

  return (
    <div className="max-w-md mx-auto">
      <FloatingControls
        openAdvisor={openAdvisor}
        unreadCount={unreadCount}
        guardianUpdates={guardianUpdates}
        onOpenGuardianReview={openGuardianReview}
        onDismissGuardianUpdate={dismissGuardianUpdate}
        onMuteGuardianUpdateType={muteGuardianUpdateType}
        experienceMode={experienceMode}
      />

      {/* Testnet banner — only for dev flag or explicit user opt-in */}
      {showTestnetBanner && (
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

      <TabDiscoveryProvider>
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          badges={{}}
          experienceMode={experienceMode}
        />

        {/* Tab content */}
        <TabContentRouter />
      </TabDiscoveryProvider>

      <WalletTutorial
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        onConnect={connectWallet}
        isMiniPay={isMiniPay}
      />
    </div>
  );
}

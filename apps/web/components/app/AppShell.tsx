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
import TabNavigation, { DesktopRail } from "@/components/ui/TabNavigation";
import { WalletTutorial } from "@/components/wallet/WalletTutorial";
import AppHeader from "@/components/app/AppHeader";
import { TabDiscoveryProvider } from "@/hooks/use-tab-discovery";
import { useStrategy } from "@/context/app/StrategyContext";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";

import TabContentRouter from "./TabContentRouter";
import FloatingControls from "./FloatingControls";

/**
 * AppBackdrop — the post-onboarding continuation of onboarding's ambience.
 *
 * Onboarding bathes the screen in philosophy-tinted radial light; the app
 * shell then dropped to a flat gray-100/gray-900 and the identity vanished.
 * This restores it, statically: two ultra-quiet radial washes tinted by the
 * user's chosen archetype accent (warm amber counterpoint, same pairing the
 * welcome screen uses). No animation — the motion budget stays spent on the
 * one expressive object per screen, and §5 retires ambient loops. On
 * desktop the wide margins around the max-w-md column are where this
 * actually lives; on mobile it reads as a subtle top glow behind the header.
 */
function AppBackdrop({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        background: [
          `radial-gradient(90% 55% at 50% 0%, ${accent}14 0%, transparent 70%)`,
          `radial-gradient(70% 40% at 50% 100%, rgba(251,191,36,0.06) 0%, transparent 70%)`,
        ].join(', '),
      }}
    />
  );
}

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
    guardianUpdates, openGuardianReview, dismissGuardianUpdate, snoozeGuardianUpdate, muteGuardianUpdateType,
    isMiniPay,
    openWalletTutorial, closeTutorial, isTutorialOpen,
    handleTranscription,
  } = useAppShellContext();

  const showTestnetBanner = shouldShowTestnetBanner(walletChainId);

  // Philosophy accent for the ambient backdrop (static, §5-compliant).
  const { financialStrategy } = useStrategy();
  const archetype = ARCHETYPES[strategyToArchetype(financialStrategy) ?? 'custom'];

  return (
    <div className="lg:pl-20">
      <DesktopRail
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        experienceMode={experienceMode}
      />
      <div className="max-w-md mx-auto lg:max-w-2xl">
      <AppBackdrop accent={archetype.accent} />
      <FloatingControls
        openAdvisor={openAdvisor}
        unreadCount={unreadCount}
        guardianUpdates={guardianUpdates}
        onOpenGuardianReview={openGuardianReview}
        onDismissGuardianUpdate={dismissGuardianUpdate}
        onSnoozeGuardianUpdate={(id) => snoozeGuardianUpdate(id, new Date(Date.now() + 60 * 60 * 1000))}
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
    </div>
  );
}

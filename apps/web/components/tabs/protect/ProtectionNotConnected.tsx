/**
 * ProtectionNotConnected — Shown when the user has no wallet connected.
 * Uses the shared UnconnectedStateShell for consistent layout.
 */
import React from "react";
import { Card, ConnectWalletPrompt } from "../../shared/TabComponents";
import WalletButton from "../../wallet/WalletButton";
import type { UserExperienceMode } from "@/context/app/types";
import { WALLET_CONNECT_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import { LiveProofTicker } from "../../shared/LiveProofCard";
import { UnconnectedStateShell } from "../../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../../shared/UnconnectedStateShell";
import { GuardianStateScrollytelling } from "./GuardianStateScrollytelling";
import { ProtectionPlanGallery } from "./ProtectionPlanGallery";
import { useStrategy } from "@/context/app/StrategyContext";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { PhilosophyHeroCard } from "@/components/protection-cards/PhilosophyHeroCard";
import { ApacRailHonestyBanner } from "../../shared/ApacRailHonestyBanner";
import { needsApacRailMessaging } from "@/constants/apac-rail";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useUserRegion } from "@/hooks/use-user-region";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
}

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: "📈",
    title: "Review risk context",
    text: "After you connect, compare portfolio information with available market and inflation data.",
  },
  {
    icon: "🎯",
    title: "Choose a values lens",
    text: "Explore approaches that reflect your goals and relationship with money.",
  },
  {
    icon: "🔄",
    title: "Review your options",
    text: "Consider diversification across currencies and asset types before acting.",
  },
];

export function ProtectionNotConnected({ experienceMode, onEnableDemo }: Props) {
  const { financialStrategy } = useStrategy();
  const { config: profileConfig } = useProtectionProfile();
  const { region: detectedRegion } = useUserRegion();
  const archetypeId = strategyToArchetype(financialStrategy);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const showApacBanner = needsApacRailMessaging(
    financialStrategy ?? profileConfig.philosophy,
    profileConfig.userRegion ?? detectedRegion,
  );

  const heroCard = archetype ? (
    <PhilosophyHeroCard
      archetype={archetype}
      variant="hero"
      experienceMode={experienceMode}
      walletMessage={WALLET_CONNECT_COPY.activatePlan(archetype.name)}
    />
  ) : (
    <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">
            Shield your purchasing power
          </h3>
          <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
            Explore risk context and values-led protection approaches.
          </p>
        </div>
        <span className="text-3xl">🤖</span>
      </div>
      <ConnectWalletPrompt
        message={WALLET_CONNECT_COPY.generic}
        WalletButtonComponent={<WalletButton variant="inline" />}
        experienceMode={experienceMode}
      />
    </Card>
  );

  return (
    <UnconnectedStateShell
      heroCard={heroCard}
      showProofCard={true}
      proofCardSide="below"
      proofCardVariant={experienceMode === 'beginner' ? 'compact' : 'full'}
      showDemoCta={true}
      onEnableDemo={onEnableDemo}
      demoCtaSide="above"
      howItWorks={HOW_IT_WORKS}
    >
      {!archetype && (
        <div className="rounded-2xl bg-white/[0.02] backdrop-blur-sm py-5 -mx-4 sm:mx-0 sm:rounded-3xl">
          <ProtectionPlanGallery mobile />
        </div>
      )}

      {showApacBanner && (
        <div className="mb-4">
          <ApacRailHonestyBanner />
        </div>
      )}

      <GuardianStateScrollytelling />

      <LiveProofTicker limit={3} />
    </UnconnectedStateShell>
  );
}

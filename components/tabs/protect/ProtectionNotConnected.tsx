/**
 * ProtectionNotConnected — Shown when the user has no wallet connected.
 * Uses the shared UnconnectedStateShell for consistent layout.
 */
import React from "react";
import { Card, ConnectWalletPrompt } from "../../shared/TabComponents";
import WalletButton from "../../wallet/WalletButton";
import type { UserExperienceMode } from "@/context/app/types";
import { WALLET_CONNECT_COPY } from "@diversifi/shared";
import { LiveProofTicker } from "../../shared/LiveProofCard";
import { UnconnectedStateShell } from "../../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../../shared/UnconnectedStateShell";
import { GuardianStateScrollytelling } from "./GuardianStateScrollytelling";
import { ProtectionPlanGallery } from "./ProtectionPlanGallery";
import { useStrategy } from "@/context/app/StrategyContext";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import { PhilosophyHeroCard } from "@/components/protection-cards/PhilosophyHeroCard";
import { ApacRailHonestyBanner } from "../../shared/ApacRailHonestyBanner";
import { needsApacRailHonesty } from "@/constants/apac-rail";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { useUserRegion } from "@/hooks/use-user-region";

interface Props {
  experienceMode: UserExperienceMode;
  onEnableDemo?: () => void;
}

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: "📈",
    title: "Analyze Your Risk",
    text: "Your portfolio is scanned against real-time global inflation data.",
  },
  {
    icon: "🎯",
    title: "Set Your Goal",
    text: "Choose a protection strategy that fits your needs and risk tolerance.",
  },
  {
    icon: "🔄",
    title: "Diversify Assets",
    text: "Move into stable currencies and real-world assets to preserve value.",
  },
];

export function ProtectionNotConnected({ experienceMode, onEnableDemo }: Props) {
  const { financialStrategy } = useStrategy();
  const { config: profileConfig } = useProtectionProfile();
  const { region: detectedRegion } = useUserRegion();
  const archetypeId = strategyToArchetype(financialStrategy);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const showApacHonesty = needsApacRailHonesty(
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
            Protection Plan
          </h3>
          <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
            Build your inflation protection plan
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
      proofCardSide="above"
      proofCardVariant={experienceMode === 'beginner' ? 'compact' : 'full'}
      showDemoCta={true}
      onEnableDemo={onEnableDemo}
      howItWorks={HOW_IT_WORKS}
    >
      {!archetype && (
        <div className="rounded-2xl bg-white/[0.02] backdrop-blur-[1px] py-5 -mx-4 sm:mx-0 sm:rounded-3xl">
          <ProtectionPlanGallery mobile />
        </div>
      )}

      {showApacHonesty && (
        <div className="mb-4">
          <ApacRailHonestyBanner />
        </div>
      )}

      <GuardianStateScrollytelling />

      <LiveProofTicker limit={3} />
    </UnconnectedStateShell>
  );
}

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
import { TokenIcon } from "../../shared/TokenIcon";

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
  const archetypeId = strategyToArchetype(financialStrategy);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

  const heroCard = archetype ? (
    <Card
      className="text-white p-6 border-2"
      style={{ borderColor: `${archetype.accent}40` }}
    >
      <div
        className="rounded-2xl p-6 -m-6"
        style={{
          background: `linear-gradient(135deg, ${archetype.surface.start} 0%, ${archetype.surface.mid} 60%, ${archetype.surface.end} 100%)`,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: archetype.accentSoft }}>
              {archetype.name}
            </h3>
            <p className="text-white/80 text-xs font-bold opacity-80 mt-1">
              {archetype.philosophy}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
            style={{ background: archetype.accent }}
          >
            {archetype.name[0]}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {archetype.allocation.map((asset, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold"
              style={{
                background: `${archetype.accentSoft}20`,
                color: archetype.accentSoft,
              }}
            >
              <TokenIcon symbol={asset} size={12} />
              {asset}
            </span>
          ))}
        </div>
        <ConnectWalletPrompt
          message={WALLET_CONNECT_COPY.activatePlan(archetype.name)}
          WalletButtonComponent={<WalletButton variant="inline" />}
          experienceMode={experienceMode}
        />
      </div>
    </Card>
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

      <GuardianStateScrollytelling />

      <LiveProofTicker limit={3} />
    </UnconnectedStateShell>
  );
}

/**
 * ProtectionNotConnected — Shown when the user has no wallet connected.
 * Uses the shared UnconnectedStateShell for consistent layout.
 */
import React from "react";
import { Card, ConnectWalletPrompt } from "../../shared/TabComponents";
import WalletButton from "../../wallet/WalletButton";
import { USER_GOALS } from "@/hooks/use-protection-profile";
import type { UserExperienceMode } from "@/context/app/types";
import { LiveProofTicker } from "../../shared/LiveProofCard";
import { UnconnectedStateShell } from "../../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../../shared/UnconnectedStateShell";
import { GuardianStateScrollytelling } from "./GuardianStateScrollytelling";
import { ProtectionPlanGallery } from "./ProtectionPlanGallery";
import { useStrategy } from "@/context/app/StrategyContext";
import { ARCHETYPES, type ArchetypeId } from "@/components/protection-cards/tokens";
import { TokenIcon } from "../../shared/TokenIcon";

const STRATEGY_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic: 'islamic_finance',
  global: 'global_diversification',
  custom: 'custom',
};

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
  const archetypeId = financialStrategy ? STRATEGY_TO_ARCHETYPE[financialStrategy] ?? null : null;
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
          message={`Connect your wallet to activate your ${archetype.name} protection plan on Arbitrum and Celo.`}
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
        message="Connect your wallet to analyze your portfolio across Arbitrum and Celo against real-time global inflation data."
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
      showDemoCta={true}
      onEnableDemo={onEnableDemo}
      howItWorks={HOW_IT_WORKS}
    >
      {/* Protection Plan Gallery — the design system, live in the product.
          Same JSX renders here, in the Figma library, and in share PNGs. */}
      <div className="rounded-2xl bg-white/[0.02] backdrop-blur-[1px] py-5 -mx-4 sm:mx-0 sm:rounded-3xl">
        <ProtectionPlanGallery mobile />
      </div>

      {/* Guardian 4-state pipeline scrollytelling — preview before connect */}
      <GuardianStateScrollytelling />

      {/* Live activity ticker — "what's been verified recently" */}
      <LiveProofTicker limit={3} />

      {/* Preview of goals */}
      <Card className="bg-gray-50 border-dashed border-2 p-4">
        <h4 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest text-center">
          Available Protection Goals
        </h4>
        <div className="grid grid-cols-2 gap-2 opacity-50">
          {USER_GOALS.map((goal) => (
            <div
              key={goal.value}
              className="p-3 bg-white rounded-xl text-center shadow-md"
            >
              <div className="text-xl mb-1">{goal.icon}</div>
              <div className="text-xs font-black uppercase text-gray-900">
                {goal.label}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </UnconnectedStateShell>
  );
}

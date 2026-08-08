/**
 * PhilosophyHeroCard — Shared archetype hero for unconnected surfaces.
 *
 * Used on Home (inline framing inside the risk calculator) and Shield
 * (full hero with wallet CTA). One component, two densities.
 */
import React from 'react';
import type { UserExperienceMode } from '@/context/app/types';
import type { Archetype } from './tokens';
import { Card, ConnectWalletPrompt } from '../shared/TabComponents';
import WalletButton from '../wallet/WalletButton';
import { TokenIcon } from '../shared/TokenIcon';
import { TOKEN_DESIGN } from '../../constants/tokens';

function AllocationChips({
  archetype,
  size = 12,
  className = '',
}: {
  archetype: Archetype;
  size?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {archetype.allocation.map((asset) => (
          <span
            key={asset}
            title={TOKEN_DESIGN[asset]?.description ?? asset}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold"
            style={{
              background: `${archetype.accentSoft}20`,
              color: archetype.accentSoft,
            }}
          >
            <TokenIcon symbol={asset} size={size} />
            {asset}
          </span>
        ))}
      </div>
      <p
        className="text-[10px] mt-1.5"
        style={{ color: archetype.accentSoft, opacity: 0.75 }}
      >
        Digital versions of everyday money — dollars, euros, local currencies, gold.
      </p>
    </div>
  );
}

export interface PhilosophyHeroCardProps {
  archetype: Archetype;
  variant?: 'hero' | 'inline';
  experienceMode?: UserExperienceMode;
  walletMessage?: string;
  className?: string;
}

export function PhilosophyHeroCard({
  archetype,
  variant = 'hero',
  experienceMode,
  walletMessage,
  className = '',
}: PhilosophyHeroCardProps) {
  if (variant === 'inline') {
    return (
      <div
        className={`rounded-xl p-3 border ${className}`}
        style={{
          borderColor: `${archetype.accent}40`,
          background: `${archetype.surface.start}15`,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black"
            style={{ background: archetype.accent }}
          >
            {archetype.name[0]}
          </div>
          <p className="text-xs font-bold" style={{ color: archetype.accent }}>
            Your philosophy: {archetype.name}
          </p>
        </div>
        <p className="text-[11px] text-gray-600 dark:text-gray-400">
          {archetype.philosophy}
        </p>
        <AllocationChips archetype={archetype} size={11} className="mt-1.5 gap-1" />
      </div>
    );
  }

  return (
    <Card
      className={`text-white p-6 border-2 ${className}`}
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
            <h3
              className="text-xl font-black uppercase tracking-tight"
              style={{ color: archetype.accentSoft }}
            >
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
        <AllocationChips archetype={archetype} className="mb-4" />
        {walletMessage && experienceMode != null && (
          <ConnectWalletPrompt
            message={walletMessage}
            WalletButtonComponent={<WalletButton variant="inline" />}
            experienceMode={experienceMode}
          />
        )}
      </div>
    </Card>
  );
}

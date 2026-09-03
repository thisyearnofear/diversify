/**
 * phase-config — shared tokens, types, and copy for the onboarding phases.
 *
 * Phase components live next door (DetectPhase / RiskPhase /
 * PhilosophyPhase); WelcomeScreen stays the orchestrator that owns state
 * and renders the right phase.
 */

import type { Variants } from 'framer-motion';
import type { ArchetypeId } from '../../../protection-cards/tokens';
import type { FinancialStrategy } from '@diversifi/shared';

// ── Animation variants ─────────────────────────────────────────────────
// Blur-swap phase transition (transitions.dev "text states swap" pattern)
// Uses filter: blur instead of y-offset for a more cinematic feel.

export const phaseVariants: Variants = {
  initial: {
    opacity: 0,
    filter: 'blur(6px)',
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    filter: 'blur(6px)',
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const staggerChild: Variants = {
  initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

export type Phase = 'detect' | 'risk' | 'philosophy';
export type Horizon = '1yr' | '3yr' | '5yr';
export type ValuesLens = 'local' | 'community' | 'faith' | 'global' | 'custom';

export const STRATEGY_ID: Record<ArchetypeId, FinancialStrategy> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic_finance: 'islamic',
  global_diversification: 'global',
  custom: 'custom',
};

export const VALUES_LENSES: Array<{
  id: ValuesLens;
  label: string;
  description: string;
  archetypes: ArchetypeId[];
  glyph: string;
  accent: string;
}> = [
  {
    id: 'local',
    label: 'Local prosperity',
    description: 'Keep wealth connected to the economies and communities you know.',
    archetypes: ['africapitalism', 'pan_caribbean'],
    glyph: '🌍',
    accent: '#10b981',
  },
  {
    id: 'community',
    label: 'Community & balance',
    description: 'Balance personal resilience with people and place.',
    archetypes: ['buen_vivir', 'gotong_royong'],
    glyph: '🤝',
    accent: '#14b8a6',
  },
  {
    id: 'faith',
    label: 'Faith & ethics',
    description: 'Put clear ethical principles at the centre of your plan.',
    archetypes: ['islamic_finance', 'confucian'],
    glyph: '🕊️',
    accent: '#d4af37',
  },
  {
    id: 'global',
    label: 'Global resilience',
    description: 'Spread risk across regions and asset types.',
    archetypes: ['global_diversification'],
    glyph: '🌐',
    accent: '#0ea5e9',
  },
  {
    id: 'custom',
    label: 'Build my own',
    description: 'Start with your own allocation and priorities.',
    archetypes: ['custom'],
    glyph: '⚙️',
    accent: '#a78bfa',
  },
];

export const PHILOSOPHY_CTA: Record<ArchetypeId, string> = {
  africapitalism: 'Begin building African wealth',
  buen_vivir: 'Start living in balance',
  pan_caribbean: 'Weather every storm',
  confucian: 'Begin with patience',
  gotong_royong: 'Start rising together',
  islamic_finance: 'Begin your Sharia-compliant journey',
  global_diversification: 'Start diversifying globally',
  custom: 'Build your own plan',
};

// Ambient wash per phase — the room's light shifts as the story moves from
// "where are you" (blue) → "here's the danger" (warm) → "here's your plan"
// (emerald). A gold floor glow echoes the coin motif throughout.
export const PHASE_WASH: Record<Phase, string> = {
  detect:
    'radial-gradient(90% 55% at 50% 0%, rgba(59,130,246,0.14) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,191,36,0.10) 0%, transparent 70%)',
  risk:
    'radial-gradient(90% 55% at 50% 0%, rgba(244,63,94,0.13) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,146,60,0.10) 0%, transparent 70%)',
  philosophy:
    'radial-gradient(90% 55% at 50% 0%, rgba(16,185,129,0.13) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,191,36,0.10) 0%, transparent 70%)',
};

/**
 * Philosophy-aware moment framing.
 *
 * The currency moment is neutral (see `currency-moment.ts`): it states the
 * delta and the personal consequence without colouring them. When a visitor
 * has picked a protection philosophy (the archetype from onboarding), the
 * moment borrows the archetype's OWN accent and a consequence reframe in its
 * values register — not a Western loss-aversion red/amber/green.
 *
 * The reframe stays NON-PRESCRIPTIVE. It states the erosion and re-reads it
 * through the philosophy's lens (stewardship, resilience, inter-generational
 * patience, shared risk) — it never tells the user to do anything. Allocation
 * guidance lives in the philosophy system, not here.
 *
 * The `reframe` is a tail appended to the neutral "…now buys X less." so the
 * card keeps its interactive slot (editable amount + impact). Rendered as a
 * second, standalone sentence so it reads cleanly in any language.
 */
import {
  ARCHETYPES,
  strategyToArchetype,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';
import type { FinancialStrategy } from '@diversifi/shared';

export interface MomentFrame {
  archetype: ArchetypeId;
  name: string;
  accent: string;
  accentSoft: string;
  /** Values-register tail that follows the neutral "now buys X less."
      `code` is the currency code. Return null for no reframe (keeps neutral). */
  reframe: (code: string) => string | null;
}

/** Per-archetype reframe (capitalised so it reads as a standalone sentence). */
const REFRAME: Record<ArchetypeId, (code: string) => string | null> = {
  africapitalism: (code) => `Keeping ${code} close to home matters.`,
  buen_vivir: () => 'A balanced life keeps its meaning.',
  pan_caribbean: () => 'Resilience for storms and import shocks.',
  confucian: () => 'A patient, multi-generational line holds its value.',
  gotong_royong: () => 'We carry the risk together.',
  islamic_finance: () => 'Preserving buying power is a trust.',
  global_diversification: () => 'Spread is the shield.',
  custom: () => null, // a custom plan carries no values frame — keep neutral
};

/**
 * Resolve the moment frame for a philosophy. Goal strategies
 * (inflation_protection, rwa_access…) and legacy values return null → the
 * moment keeps its neutral accent + neutral sentence.
 */
export function momentFrameFor(
  strategy: FinancialStrategy | null | undefined,
): MomentFrame | null {
  const archetypeId = strategyToArchetype(strategy);
  if (!archetypeId) return null;
  const a = ARCHETYPES[archetypeId];
  return {
    archetype: archetypeId,
    name: a.name,
    accent: a.accent,
    accentSoft: a.accentSoft,
    reframe: REFRAME[archetypeId],
  };
}

/**
 * Full consequence sentence, philosophy-aware when a frame exists. Used by
 * tests and any non-interactive surface; the card renders the parts itself.
 */
export function consequenceSentence(
  frame: MomentFrame | null,
  code: string,
  impact: string,
): string {
  const base = `${code} now buys ${impact} less.`;
  const reframe = frame?.reframe(code);
  return reframe ? `${base} ${reframe}` : base;
}

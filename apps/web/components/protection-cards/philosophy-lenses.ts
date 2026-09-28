/**
 * philosophyLenses — one LensCoinDef per archetype, the same set the
 * Shield picker/compare rail shows (ARCHETYPE_ORDER, including custom).
 * Ids are strategy ids so `onSelect` reports straight into
 * `setFocusedPhilosophy`; glyph and tagline come from the canonical
 * strategy catalogue via `archetypeToStrategy`.
 */
import type { LensCoinDef } from '@/components/onboarding/LensCoinSelector';
import { STRATEGIES } from '@/constants/strategies';
import {
  ARCHETYPE_ORDER,
  ARCHETYPES,
  archetypeToStrategy,
} from './tokens';

export function philosophyLenses(): LensCoinDef[] {
  return ARCHETYPE_ORDER.map((archetypeId) => {
    const strategyId = archetypeToStrategy(archetypeId);
    const strategy = STRATEGIES.find((s) => s.id === strategyId);
    return {
      id: strategyId,
      label: ARCHETYPES[archetypeId].name,
      description: strategy?.tagline,
      glyph: strategy?.icon ?? '◌',
      accent: ARCHETYPES[archetypeId].accent,
    };
  });
}

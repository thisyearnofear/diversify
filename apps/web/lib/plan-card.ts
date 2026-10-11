/**
 * plan-card — the shareable Shield card's content, derived only from a
 * philosophy id. The card shares a creed and its target ideals, never a
 * person's holdings. Unknown / custom / exploring ids → null → neutral
 * brand card / 404, never a guess.
 */
// Deep leaf import — NOT the barrel — keeps the AI/ethers stack out of
// the edge bundle.
import { STRATEGY_PLANS } from '@diversifi/shared/src/config/allocation-plans';
import { exposureLabel } from '@diversifi/shared/src/config/exposures';
import type { FinancialStrategy } from '@diversifi/shared/src/types/strategy';
import { STRATEGIES } from '@/constants/strategies';

export interface PlanCardContent {
  id: FinancialStrategy;
  name: string;
  nativeName?: string;
  tagline: string;
  icon: string;
  /** Target ideals, e.g. [{ region: 'Africa', ideal: 50 }]. */
  targets: { region: string; ideal: number }[];
}

/** Philosophies that can be shared as a card — a named creed with real
 *  targets. 'custom'/'exploring' are a person's own mix, not a creed. */
export function planCardContent(
  idParam: string | null | undefined,
): PlanCardContent | null {
  if (!idParam) return null;
  const strategy = STRATEGIES.find((s) => s.id === idParam);
  if (!strategy) return null;
  if (strategy.id === 'custom' || strategy.id === 'exploring') return null;

  const slices = STRATEGY_PLANS[strategy.id]?.slices;
  if (!slices || slices.length === 0) return null;

  return {
    id: strategy.id,
    name: strategy.name,
    nativeName: strategy.nativeName,
    tagline: strategy.tagline,
    icon: strategy.icon,
    targets: slices.map(({ exposure, target, prefer }) => ({
      region: `${exposureLabel(exposure)}${prefer === 'yield' ? ' yield' : ''}`,
      ideal: target,
    })),
  };
}

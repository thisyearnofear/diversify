import { getTokenRegion } from '@/config';
import { configTokenFor } from '@/lib/plan-legs';
import type { TreasuryIntent } from '@/context/app/NavigationContext';

/**
 * Resolve a cross-tab TreasuryIntent to the single plan slice that best
 * answers it. Asset beats region; region prefers the plan leg whose gap to
 * the held share is largest, then the largest held token in that region.
 * Returns the token's own canonical spelling, or null when nothing matches.
 */
export function resolveIntentFocus(
  intent: TreasuryIntent,
  planLegs: { token: string; percent: number }[],
  heldPctByToken: Map<string, number>,
  regionOf: (symbol: string) => string = getTokenRegion,
): string | null {
  if (intent.asset) {
    const wanted = intent.asset.toLowerCase();
    const leg = planLegs.find((l) => l.token.toLowerCase() === wanted);
    if (leg) return leg.token;
    for (const [token, pct] of heldPctByToken) {
      if (pct > 0 && token.toLowerCase() === wanted) return token;
    }
  }

  if (intent.region) {
    const region = intent.region.toLowerCase();
    // Legs and held keys speak plan-leg names (cUSD); regionOf reads the
    // config (Mento) vocabulary — canonicalize before asking.
    const inRegion = (token: string) =>
      regionOf(configTokenFor(token, null)).toLowerCase() === region;

    let best: { token: string; gap: number; percent: number } | null = null;
    for (const leg of planLegs) {
      if (!inRegion(leg.token)) continue;
      const held = heldPctByToken.get(leg.token) ?? 0;
      const gap = Math.abs(leg.percent - held);
      if (
        !best ||
        gap > best.gap ||
        (gap === best.gap && leg.percent > best.percent)
      ) {
        best = { token: leg.token, gap, percent: leg.percent };
      }
    }
    if (best) return best.token;

    let bestHeld: { token: string; pct: number } | null = null;
    for (const [token, pct] of heldPctByToken) {
      if (pct <= 0 || !inRegion(token)) continue;
      if (!bestHeld || pct > bestHeld.pct) bestHeld = { token, pct };
    }
    if (bestHeld) return bestHeld.token;
  }

  return null;
}

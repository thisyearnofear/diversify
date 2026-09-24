/**
 * Home lens triggers — pure, testable. A lens is a state of the existing
 * object entered through the transition slot (design-language §5); the
 * trigger decides whether the prompt earns the slot.
 */

export interface ConcentrationLens {
  region: string;
  pct: number;
  value: number;
}

/**
 * One region carrying half the wallet or more is a fact worth a lens.
 * Top region by value; pct ≥ 50 and a non-empty wallet, else null.
 */
export function concentrationOf(
  regionData: ReadonlyArray<{ region: string; value: number }>,
  totalValue: number,
): ConcentrationLens | null {
  if (totalValue <= 0 || regionData.length === 0) return null;
  const top = regionData.reduce((a, b) => (b.value > a.value ? b : a));
  const pct = (top.value / totalValue) * 100;
  if (pct < 50) return null;
  return { region: top.region, pct, value: top.value };
}

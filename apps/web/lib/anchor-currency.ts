/**
 * Anchor currency — the currency a user thinks in. It names the risk dial's
 * reserve and is what Guardian sizes moves in. Pure, so the default order
 * is testable: saved choice → payment-cycle local currency → largest held
 * local-currency stablecoin → USD. `userRegion` is continent-level and never
 * decides it. Holdings only set a local anchor when that currency outweighs
 * the wallet's dollars — a dollar-majority wallet is a USD user.
 */
import { EXCHANGE_RATES } from "@/config";
import {
  EXPOSURE_LABELS,
  exposureOf,
  instrumentsFor,
  type Exposure,
} from "@diversifi/shared/src/config/exposures";

const NON_CURRENCY: ReadonlySet<Exposure> = new Set(["XAU", "XAG", "US_EQUITY"]);

/** Currencies the app has at least one instrument for — USD first. */
export const ANCHOR_CURRENCIES: readonly Exposure[] = (
  Object.keys(EXPOSURE_LABELS) as Exposure[]
).filter((e) => !NON_CURRENCY.has(e) && instrumentsFor(e).length > 0);

export type AnchorSource = "profile" | "payment-cycle" | "holdings" | "default";

export interface AnchorChoice {
  currency: Exposure;
  source: AnchorSource;
}

export function asAnchorCurrency(code: string | null | undefined): Exposure | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return (ANCHOR_CURRENCIES as readonly string[]).includes(upper) ? (upper as Exposure) : null;
}

export interface AnchorInputs {
  saved?: string | null;
  cycleLocalCurrency?: string | null;
  holdings?: ReadonlyArray<{ symbol: string; value: number }>;
}

export function resolveAnchorCurrency({
  saved,
  cycleLocalCurrency,
  holdings = [],
}: AnchorInputs): AnchorChoice {
  const fromProfile = asAnchorCurrency(saved);
  if (fromProfile) return { currency: fromProfile, source: "profile" };
  const fromCycle = asAnchorCurrency(cycleLocalCurrency);
  if (fromCycle) return { currency: fromCycle, source: "payment-cycle" };

  const byExposure = new Map<Exposure, number>();
  for (const { symbol, value } of holdings) {
    const exposure = exposureOf(symbol);
    if (!exposure || !asAnchorCurrency(exposure) || !(value > 0)) continue;
    byExposure.set(exposure, (byExposure.get(exposure) ?? 0) + value);
  }
  let largest: Exposure | null = null;
  for (const [exposure, value] of byExposure) {
    if (largest === null || value > (byExposure.get(largest) ?? 0)) largest = exposure;
  }
  if (largest && largest !== "USD") return { currency: largest, source: "holdings" };
  return { currency: "USD", source: "default" };
}

export const ANCHOR_SOURCE_LABEL: Record<AnchorSource, string> = {
  profile: "Your choice",
  "payment-cycle": "Auto · from your payment cycle",
  holdings: "Auto · your largest local holding",
  default: "Auto · default",
};

/**
 * Units of `currency` per 1 USD from the static fallback table, or null
 * when the table has no row — callers show nothing rather than a guess.
 */
export function fallbackUsdRate(currency: Exposure): number | null {
  if (currency === "USD") return 1;
  const usdPerUnit = EXCHANGE_RATES[`${currency}m`] ?? EXCHANGE_RATES[currency];
  return usdPerUnit && usdPerUnit > 0 ? 1 / usdPerUnit : null;
}

export type AnchorFx =
  | { rate: number; source: "identity" }
  | { rate: number; source: "live"; date: string }
  | { rate: number; source: "fallback" };

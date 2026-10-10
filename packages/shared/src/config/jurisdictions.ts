/**
 * Jurisdiction + feature gating — single source of truth for compliance.
 *
 * Everything here defaults OFF or closed: sanctioned locations are blocked,
 * gated features ship disabled until counsel signs off and the env switch
 * is flipped. Reference each NEXT_PUBLIC_ env literally (no dynamic keys)
 * so Next can inline it on the client.
 */

export type GatedFeature = 'fees' | 'thesis' | 'perps';

// OFAC comprehensive embargoes; counsel may extend. ISO 3166-1 alpha-2.
export const SANCTIONED_COUNTRIES: readonly string[] = ['CU', 'IR', 'KP', 'SY'];

// Sub-national sanctioned regions: country -> ISO 3166-2 subdivision suffixes.
// UA: 43 Crimea, 40 Sevastopol, 14 Donetsk, 09 Luhansk.
export const SANCTIONED_REGIONS: Readonly<Record<string, readonly string[]>> = {
  UA: ['43', '40', '14', '09'],
};

/**
 * Features that take money from the user. These never run on a deny-list:
 * they are on only in counsel-cleared markets, and an unknown location
 * fails closed. Non-money features keep the global-switch + per-country
 * deny-override model below.
 */
const MONEY_FEATURES: ReadonlySet<GatedFeature> = new Set(['fees']);

/**
 * Counsel-cleared markets per money feature (ISO 3166-1 alpha-2). Empty =
 * the feature is off for everyone even when its env switch is on. Entries
 * are added only on written advice — opening a market is adding a code
 * here, never flipping a global switch and trusting the deny table.
 */
export const CLEARED_COUNTRIES: Readonly<
  Partial<Record<GatedFeature, readonly string[]>>
> = {
  fees: [],
};

// Per-country overrides, filled only after counsel sign-off.
// false = feature off there even when the global switch is on.
export const JURISDICTION_OVERRIDES: Readonly<
  Record<string, Partial<Record<GatedFeature, boolean>>>
> = {
  // UK financial-promotions regime (Oct 2023): thesis/claims surfaces are
  // promotions — keep them off in GB until counsel confirms a compliant path.
  GB: { thesis: false },
};

/**
 * True when the location (ISO alpha-2 country, optional ISO 3166-2 region
 * in either "43" or "UA-43" form) is comprehensively sanctioned. Missing
 * country returns false — local dev has no geo header and must not block.
 */
export function isBlockedLocation(
  country?: string | null,
  region?: string | null,
): boolean {
  if (!country) return false;
  const cc = country.toUpperCase();
  if (SANCTIONED_COUNTRIES.includes(cc)) return true;
  if (!region) return false;
  const suffix = region.toUpperCase().startsWith(`${cc}-`)
    ? region.slice(cc.length + 1).toUpperCase()
    : region.toUpperCase();
  return SANCTIONED_REGIONS[cc]?.includes(suffix) ?? false;
}

/**
 * Env-level "is this feature switched on at all". For money features this
 * is only true once at least one market is counsel-cleared — an env switch
 * with an empty allowlist opens nothing. Used by fail-closed checks (e.g.
 * screening unavailable blocks swaps once fees can actually be taken).
 */
export function featureConfigured(feature: GatedFeature): boolean {
  const globalOn =
    feature === 'fees'
      ? process.env.NEXT_PUBLIC_FEATURE_FEES === 'true'
      : feature === 'thesis'
        ? process.env.NEXT_PUBLIC_FEATURE_THESIS === 'true'
        : process.env.NEXT_PUBLIC_FEATURE_PERPS === 'true';
  if (!globalOn) return false;
  if (MONEY_FEATURES.has(feature)) {
    return (CLEARED_COUNTRIES[feature]?.length ?? 0) > 0;
  }
  return true;
}

/**
 * A gated feature is on for a user only when it is configured AND the
 * country (when known) hasn't overridden it off. Money features
 * additionally require the country to sit on the counsel-cleared
 * allowlist — unknown geo fails closed. Sanctioned countries never reach
 * a gated feature — geo blocking happens at the edge before this is read,
 * but the belt is cheap.
 */
export function featureEnabled(
  feature: GatedFeature,
  country?: string | null,
): boolean {
  if (!featureConfigured(feature)) return false;
  const cc = country?.toUpperCase();
  if (cc && JURISDICTION_OVERRIDES[cc]?.[feature] === false) return false;
  if (MONEY_FEATURES.has(feature)) {
    return !!cc && (CLEARED_COUNTRIES[feature]?.includes(cc) ?? false);
  }
  return true;
}

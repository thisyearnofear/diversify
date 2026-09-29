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

// Per-country overrides, filled only after counsel sign-off.
// false = feature off there even when the global switch is on.
export const JURISDICTION_OVERRIDES: Readonly<
  Record<string, Partial<Record<GatedFeature, boolean>>>
> = {};

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
 * A gated feature is on only when its global switch is exactly 'true'
 * AND the country (when known) hasn't overridden it off. Sanctioned
 * countries never reach a gated feature — geo blocking happens at the
 * edge before this is read, but the belt is cheap.
 */
export function featureEnabled(
  feature: GatedFeature,
  country?: string | null,
): boolean {
  const globalOn =
    feature === 'fees'
      ? process.env.NEXT_PUBLIC_FEATURE_FEES === 'true'
      : feature === 'thesis'
        ? process.env.NEXT_PUBLIC_FEATURE_THESIS === 'true'
        : process.env.NEXT_PUBLIC_FEATURE_PERPS === 'true';
  if (!globalOn) return false;
  if (!country) return true;
  return JURISDICTION_OVERRIDES[country.toUpperCase()]?.[feature] !== false;
}

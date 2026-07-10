export type FinancialStrategy = 
  | 'inflation_protection' 
  | 'geographic_diversification' 
  | 'rwa_access' 
  | 'exploring' 
  | 'custom'
  | 'africapitalism'
  | 'buen_vivir'
  | 'pan_caribbean'
  | 'confucian'
  | 'gotong_royong'
  | 'islamic'
  | 'global'
  | 'halo'
  | 'taco';

export interface StrategyOption {
  id: FinancialStrategy;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  nativeName?: string;
  values: string[];
}

/**
 * Protection philosophies whose savings home is the APAC rail
 * (see docs/apac-rail.md). Shared by ledger routing (server) and the
 * APAC rail banner (client) — keep this the single source of truth.
 */
export const APAC_PHILOSOPHIES: ReadonlySet<FinancialStrategy> = new Set<FinancialStrategy>([
  'confucian',
  'gotong_royong',
]);

/**
 * Whether a user profile targets the APAC rail: an APAC-facing philosophy
 * chosen from the Asia region. Both signals are required — a Confucian-plan
 * user in Nairobi still routes through Celo/Arbitrum.
 */
export function isApacRailProfile(
  philosophy: string | null | undefined,
  region: string | null | undefined,
): boolean {
  return !!(
    philosophy &&
    APAC_PHILOSOPHIES.has(philosophy as FinancialStrategy) &&
    region === 'Asia'
  );
}

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
 *
 * Inputs are normalized (case, whitespace): callers range from client
 * region detection ('Asia') to server-side profile records, and a silent
 * casing drift must not silently reroute a user's ledger of record.
 */
export function isApacRailProfile(
  philosophy: string | null | undefined,
  region: string | null | undefined,
): boolean {
  if (!philosophy || !region) return false;
  const normalizedPhilosophy = philosophy.trim().toLowerCase() as FinancialStrategy;
  const normalizedRegion = region.trim().toLowerCase();
  return APAC_PHILOSOPHIES.has(normalizedPhilosophy) && normalizedRegion === 'asia';
}

/**
 * Server-side routing context when only vault.strategy is available.
 * APAC philosophies assume Asia region until userRegion is persisted on
 * the vault (see docs/apac-rail.md).
 */
export function deriveLedgerRoutingContextFromVault(
  strategy: string | null | undefined,
): { philosophy: string; region: string } | undefined {
  if (!strategy) return undefined;
  const philosophy = strategy.trim().toLowerCase() as FinancialStrategy;
  if (!APAC_PHILOSOPHIES.has(philosophy)) return undefined;
  return { philosophy, region: 'Asia' };
}

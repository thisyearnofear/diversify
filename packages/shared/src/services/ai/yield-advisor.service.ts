/**
 * Yield Advisor Service
 *
 * AI-driven advisor for yield optimization and vault discovery using LI.FI Earn.
 * ENHANCEMENT FIRST: Extends existing AI advisor with yield-specific intelligence.
 * DRY: Reuses existing infrastructure and data sources.
 * MODULAR: Independent service composable with existing AI advisor.
 */

import { EarnService } from '../../services/earn-service';
import { vaultsFyiService } from '../../services/vaults-fyi.service';
import { getBlueChipStableGmMarkets } from '../../services/gmx-gm.service';
import { canUsePaidInsight, type EngagementContext } from '../../services/insight-tier';
import { getTokenAddresses, NETWORKS } from '../../config';

// ---------------------------------------------------------------------------
// Chain registry: SINGLE source of truth for the chain identity the yield
// pipeline uses. The pipeline has THREE producer shapes (vaults.fyi
// `network` string, GMX literal chain name, free LI.FI numeric chainId)
// and they MUST agree on the focus-key `${chain}:${symbol}` shape used by
// the drawer ↔ surface.
//
// Architecture: merge `NETWORKS` (the app's canonical chain config) at
// module init, then overlay `CHAIN_REGISTRY_EXTENSIONS` (LI.FI-curated /
// vaults.fyi-specific aliases). Two layers, single source — a rename in
// `NETWORKS` propagates automatically; an extension only contributes
// aliases without overriding the canonical name.
// ---------------------------------------------------------------------------

interface ChainRegistryEntry {
  /** Canonical display name (used as the focus-key `chain` field). */
  name: string;
  /** Lowercased alternative spellings the vaults.fyi API surface might return. */
  aliases: readonly string[];
}

/**
 * LI.FI / vaults.fyi-specific extension entries. Two purposes:
 *   1. Add chainIds NOT yet onboarded into `NETWORKS` (e.g. Base, zkSync,
 *      Linea, BNB) — these need a curated name AND aliases.
 *   2. Add EXTRA aliases to NETWORKS-known chains (e.g. 'arb' for
 *      Arbitrum, 'bsc' for BNB, 'mainnet' for Ethereum) so a single
 *      lookup table covers everything vaults.fyi sends.
 *
 * `name` here is the FALLBACK — when a chainId is also in `NETWORKS`,
 * `NETWORKS.name` wins (the app's display name is canonical).
 */
const CHAIN_REGISTRY_EXTENSIONS: Readonly<Record<number, ChainRegistryEntry>> = Object.freeze({
  // NETWORKS-overlapping IDs — only add EXTRA aliases here. The
  // canonical NETWORKS.name wins at merge time.
  42161: { name: 'Arbitrum', aliases: ['arb', 'arbitrum one'] },
  42220: { name: 'Celo', aliases: [] },
  1: { name: 'Ethereum', aliases: ['mainnet'] },
  10: { name: 'Optimism', aliases: [] },
  137: { name: 'Polygon', aliases: [] },
  // NETWORKS-missing IDs — `name` here becomes the canonical display name.
  // (NETWORKS doesn't yet onboard these, so we seed the entire entry.)
  56: { name: 'BNB Smart Chain', aliases: ['bsc', 'bnb'] },
  324: { name: 'zkSync Era', aliases: ['zksync'] },
  59144: { name: 'Linea', aliases: [] },
  8453: { name: 'Base', aliases: [] },
});

/**
 * Build the merged registry. NETWORKS is the source of truth for `name`
 * and seeds `aliases` with [`name.toLowerCase()`]; extensions contribute
 * additive aliases only and never override the canonical name.
 *
 * Collision detection: at module init, every final alias is asserted to
 * be unique across the entire registry. A duplicate would mean the
 * first matching chainId wins at lookup time (`mapVaultsFyiNetworkToChainId`
 * iterates insertion order), which is order-dependent on the source file
 * layout. We `console.warn` once per collision per process at startup so
 * the team catches this BEFORE the focus-key surfaces silently route to
 * the wrong row in production.
 */
/**
 * Composite dedupe key (alias + sorted chainIds) — each distinct
 * collision pattern gets its own log entry. Without the chainId sort,
 * a future alias collision against a DIFFERENT chain set would be
 * silently swallowed behind today's dedupe key.
 */
const _collisionLogged = new Set<string>();
function buildChainRegistry(): Readonly<Record<number, ChainRegistryEntry>> {
  // The dedupe Set survives `vi.resetModules()` cycles (tests re-import
  // the module per test → buildChainRegistry runs again) so a single
  // collision warning fires once per process, NOT once per fresh import.
  const merged: Record<number, ChainRegistryEntry> = {};
  // Layer 1: NETWORKS — canonical name + seed alias.
  for (const net of Object.values(NETWORKS)) {
    const { chainId, name } = net as { chainId: number; name: string };
    merged[chainId] = { name, aliases: Object.freeze([name.toLowerCase()]) };
  }
  // Layer 2: LI.FI / vaults.fyi extensions. Additive aliases only; the
  // extension's `name` is used when NETWORKS doesn't know this chainId.
  for (const [chainIdStr, ext] of Object.entries(CHAIN_REGISTRY_EXTENSIONS)) {
    const chainId = Number(chainIdStr);
    const existing = merged[chainId];
    if (existing) {
      merged[chainId] = {
        name: existing.name,
        aliases: Object.freeze(
          Array.from(new Set([...existing.aliases, ...ext.aliases.map((a) => a.toLowerCase())])),
        ),
      };
    } else {
      merged[chainId] = {
        name: ext.name,
        aliases: Object.freeze(
          Array.from(new Set([ext.name.toLowerCase(), ...ext.aliases.map((a) => a.toLowerCase())])),
        ),
      };
    }
  }
  // Collision pass: alias → list of chainIds that claim it.
  // Collision detection pass: alias → chainIds claiming it. Dedupe
  // key for `_collisionLogged` is composite (alias + sorted chainIds)
  // so each DISTINCT collision pattern logs once — see const comment.
  const aliasOwners: Record<string, number[]> = {};
  for (const [chainIdStr, entry] of Object.entries(merged)) {
    const chainId = Number(chainIdStr);
    for (const alias of entry.aliases) {
      (aliasOwners[alias] ??= []).push(chainId);
    }
  }
  for (const [alias, owners] of Object.entries(aliasOwners)) {
    if (owners.length > 1) {
      const dedupeKey = `${alias}|${owners.slice().sort((a, b) => a - b).join(',')}`;
      if (!_collisionLogged.has(dedupeKey)) {
        _collisionLogged.add(dedupeKey);
         
        console.warn(
          `[ChainRegistry] alias collision: "${alias}" is claimed by chainIds ${owners.join(', ')}. ` +
            `mapVaultsFyiNetworkToChainId resolves to the FIRST match in insertion order — pick a unique alias.`,
        );
      }
    }
  }
  return Object.freeze(merged);
}

const CHAIN_REGISTRY: Readonly<Record<number, ChainRegistryEntry>> = buildChainRegistry();

/**
 * Normalise a network string and return the matching registry chainId, or
 * undefined if no chains claim this alias.
 *
 * Aliases are stored lowercase and compared case-insensitively after a
 * trim so `"  ARBITRUM  "`, `"Arbitrum One"`, and `"arb"` all resolve to
 * 42161. Unmapped networks return undefined rather than fabricating a
 * chainId — the row's `chain` field still carries the display name and
 * the focus-key contract holds.
 */
export function mapVaultsFyiNetworkToChainId(network: string): number | undefined {
  if (typeof network !== 'string') return undefined;
  const normalized = network.trim().toLowerCase();
  if (!normalized) return undefined;
  for (const [chainIdStr, entry] of Object.entries(CHAIN_REGISTRY)) {
    if (entry.aliases.includes(normalized)) {
      return Number(chainIdStr);
    }
  }
  return undefined;
}

/**
 * Resolve a numeric chainId to a single canonical display name. The
 * registry is the source of truth here as well — the lookup prefers the
 * registry entry (which is always curated) over a stringified fallback.
 *
 * Notes:
 * - `NaN` is treated like `undefined` because the registry keys are integer
 *   chainIds — `Number.isFinite` filters it out before any lookup.
 * - Unknown chainIds fall through to the stringified number so the focus key
 *   still composes to `${chain}:${symbol}` rather than silently breaking.
 */
export function getLiquidChainName(chainId: number | null | undefined): string {
  if (chainId == null || !Number.isFinite(chainId)) return '';
  const entry = CHAIN_REGISTRY[chainId];
  if (entry) return entry.name;
  return String(chainId);
}

/**
 * Wrap `mapVaultsFyiNetworkToChainId` so the producer can surface
 * unmapped networks in server logs without the helper API itself
 * having to know about logging.
 *
 * IMPORTANT: The dedupe key is the lowercased network name only — NOT
 * `correlationId + network`. Earlier versions used `correlationId` and
 * silently grew the set unbounded on long-running processes (Hetzner
 * PM2 cron) because correlationId is unique per request. The finite set
 * of unknown networks vaults.fyi could return is naturally small (a
 * handful of new chains per quarter), so the Set stays trivially bounded.
 *
 * Empty / whitespace-only networks are also worth surfacing — an
 * advisory that ships rows without a network field is a real upstream
 * bug. Uses the synthetic `'__empty__'` dedupe key so the empty case is
 * logged once per process, NOT skipped.
 */
const _unknownNetworkLogged = new Set<string>();
export function mapVaultsFyiNetworkToChainIdWithLog(network: string): number | undefined {
  const chainId = mapVaultsFyiNetworkToChainId(network);
  if (chainId !== undefined) return chainId;
  const dedupeKey = (network ?? '').trim().toLowerCase() || '__empty__';
  if (!_unknownNetworkLogged.has(dedupeKey)) {
    _unknownNetworkLogged.add(dedupeKey);
     
    console.warn(
      dedupeKey === '__empty__'
        ? '[yield] vaults.fyi returned a row without a usable network field. Producer will skip.'
        : `[yield] unknown vaults.fyi network "${network}". ` +
          `Add it to CHAIN_REGISTRY_EXTENSIONS in yield-advisor.service.ts to populate chainId top-level.`,
    );
  }
  return undefined;
}

function createCorrelationId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Get AI-driven yield recommendations using LI.FI Earn
 *
 * @param userAddress - User's wallet address
 * @param currentVault - Current vault (if any)
 * @param strategy - User's strategy preference
 * @param maxResults - Maximum number of recommendations
 */
export async function getYieldRecommendations(
    userAddress: string,
    currentVault?: any,
    strategy?: string,
    maxResults: number = 5,
    correlationId: string = createCorrelationId('yield-reco'),
    /**
     * Engagement + usage for the paid-insight gate. Omitting it (or leaving it
     * empty) resolves to the free tier — so the paid vaults.fyi call is
     * DEFAULT-DENIED unless the caller proves the user has earned it.
     */
    engagement: EngagementContext & { paidInsightsUsedToday?: number } = {}
): Promise<any[]> {
    const recommendations: any[] = [];

    try {
        // 0. PERSONALIZED layer (differentiated, paid): if vaults.fyi is
        // configured, prepend its per-wallet best-deposit recommendations —
        // ranked across 1,000+ risk-rated vaults. Degrades to the free LI.FI
        // ranking below when unconfigured or on failure. See
        // docs/arbitrum-yield-strategy.md.
        // Cost gate: only PAY vaults.fyi ($0.20/call) when the user's engagement
        // tier unlocks it AND they're under their daily cap. Default-deny.
        const paidGate = canUsePaidInsight(engagement, engagement.paidInsightsUsedToday ?? 0);
        if (vaultsFyiService.isConfigured() && paidGate.allowed) {
            const best = await vaultsFyiService.getBestDepositOptions(userAddress, { onlyTransactional: true, maxVaultsPerAsset: 2 });
            for (const opt of (best?.options ?? []).slice(0, maxResults)) {
                recommendations.push({
                    id: `vaultsfyi-${opt.vaultAddress}-${Date.now()}`,
                    type: 'opportunity',
                    title: `Best yield for you: ${opt.protocol}`,
                    description: `${opt.protocol} offers ${opt.apyPct.toFixed(2)}% APY on ${opt.assetSymbol} ` +
                        `(TVL $${opt.tvlUsd.toLocaleString()}${opt.risk ? `, risk: ${opt.risk}` : ''}). ` +
                        `Personalized to your holdings across curated vaults.`,
                    impact: opt.apyPct > 15 ? 'positive' : 'neutral',
                    impactAsset: opt.assetSymbol,
                    timestamp: 'Autonomous',
                    // Top-level typed fields — `BestYieldCard` reads these
                    // directly without casting `metadata?.chain` etc.
                    source: 'vaults.fyi',
                    protocol: opt.protocol,
                    chain: opt.network,
                    // Stamp the numeric chainId so chain-aware UI and the
                    // typed `open_yield_review` action have it on hand.
                    // `undefined` here means vaults.fyi surfaced a network
                    // we don't recognise — log once so missing rows are
                    // debuggable in production logs, then continue: the
                    // `chain` (display name) still drives the focus-key.
                    chainId: mapVaultsFyiNetworkToChainIdWithLog(opt.network),
                    symbol: opt.assetSymbol,
                    apy: opt.apyPct,
                    metadata: {
                        correlationId,
                        source: 'vaults.fyi',
                        protocol: opt.protocol,
                        apy: opt.apyPct,
                        risk: opt.risk,
                        tvl: opt.tvlUsd,
                        vaultAddress: opt.vaultAddress,
                        network: opt.network,
                    },
                });
            }
        }

        // 1b. FREE GMX GM-pool venue (not covered by vaults.fyi/LI.FI). Surfaces
        // stable-side GM pool yields on Arbitrum. Discovery only — depositing is
        // a separate testnet-validated build (docs/arbitrum-yield-strategy.md).
        try {
            const gmMarkets = (await getBlueChipStableGmMarkets()).slice(0, 2);
            for (const gm of gmMarkets) {
                recommendations.push({
                    id: `gmx-gm-${gm.marketToken}-${Date.now()}`,
                    type: 'opportunity',
                    title: `GMX GM pool: ${gm.name}`,
                    description: `Provide USDC-side liquidity to the ${gm.name} GM pool for ~${gm.apyPct.toFixed(2)}% APY ` +
                        `(base ${gm.baseApyPct.toFixed(2)}%${gm.bonusAprPct > 0 ? ` + ${gm.bonusAprPct.toFixed(2)}% bonus` : ''}). ` +
                        `Earns a share of GMX trading fees.`,
                    impact: gm.apyPct > 15 ? 'positive' : 'neutral',
                    impactAsset: 'USDC',
                    timestamp: 'Autonomous',
                    // Top-level typed fields — GMX GM-pool deposits settle
                    // in USDC on Arbitrum, so `chain` is the constant
                    // 'Arbitrum' and `symbol` is the pool's marketToken.
                    source: 'gmx',
                    protocol: 'GMX',
                    chain: 'Arbitrum',
                    // GMX GM-pool deposits all settle on Arbitrum — keep
                    // the numeric chainId stamped top-level so consumers
                    // that need routing don't have to re-resolve it.
                    chainId: 42161,
                    symbol: gm.marketToken,
                    apy: gm.apyPct,
                    metadata: {
                        correlationId,
                        source: 'gmx',
                        marketToken: gm.marketToken,
                        apy: gm.apyPct,
                        network: 'arbitrum',
                        venue: 'gm-pool',
                    },
                });
            }
        } catch { /* GMX is best-effort; never blocks the advisor */ }

        // 2. Fetch current yield opportunities from LI.FI Earn (free layer)
        const vaults = await EarnService.fetchVaults({
            risk: ['low', 'medium'],
            categories: getPreferredCategories(strategy)
        });
        const rankedVaults = EarnService.rankVaultsForRecommendation(vaults, {
            minTvlUsd: 25_000,
            allowedRisk: ['low', 'medium'],
            maxResults,
            correlationId,
        });

        // 3. Get user's current positions
        const userPositions = await EarnService.fetchUserPositions(userAddress, { correlationId });
        const currentPositions = getCurrentPositionMap(userPositions);

        // 4. Generate intelligence items for top vaults
        for (let i = 0; i < rankedVaults.length; i++) {
            const vault = rankedVaults[i];
            const existingPosition = currentPositions.get(vault.id);

            recommendations.push({
                id: `earn-vault-${vault.id}-${Date.now()}`,
                type: 'opportunity',
                title: `Yield Opportunity: ${vault.protocol.toUpperCase()}`,
                description: `${vault.protocol} offering ${vault.apy?.toFixed(2) ?? 'N/A'}% APY on ${vault.asset.symbol}. ` +
                    `TVL: ${vault.tvl?.toLocaleString() ?? 'N/A'}. ` +
                    `${existingPosition ? 'Current position exists. ' : ''}` +
                    `Consider diversifying into this emerging market yield opportunity.`,
                impact: (vault.apy ?? 0) > 15 ? 'positive' : 'neutral',
                impactAsset: vault.asset.symbol,
                timestamp: 'Autonomous',
                // Top-level typed fields from the free LI.FI Earn layer.
                // `chain` is emitted as the chainId (stringified) because
                // LI.FI returns a numeric chainId rather than a label;
                // BestYieldCard still uses the same `deriveYieldFocusKey`
                // helper so the drawer and card agree on the key shape.
                source: 'free',
                protocol: vault.protocol,
                // Prefer a human-friendly chain name (NETWORKS name first,
                // curated fallback for chains LI.FI supports that we
                // haven't onboarded, last resort: the stringified chainId
                // so the focus key still composes to `${chain}:${symbol}`).
                chain: getLiquidChainName(vault.chainId ?? undefined),
                // Numeric chainId stamped top-level so the drawer's
                // typed `open_yield_review.chainId` and the surface's
                // chain-aware UI never need to re-resolve it.
                chainId: vault.chainId ?? undefined,
                symbol: vault.asset.symbol,
                apy: vault.apy ?? 0,
                metadata: {
                    correlationId,
                    vaultId: vault.id,
                    protocol: vault.protocol,
                    apy: vault.apy ?? 0,
                    risk: vault.risk,
                    tvl: vault.tvl ?? 0,
                    asset: vault.asset,
                    existingPosition: existingPosition ? existingPosition.amount : '0'
                }
            });
        }

        // 5. Add vault discovery recommendation if user has no positions
        if (userPositions.length === 0) {
            recommendations.push({
                id: `earn-discovery-${Date.now()}`,
                type: 'suggestion',
                title: 'Discover Yield Opportunities',
                description: 'No current yield positions found. Explore LI.FI Earn vaults across 20+ protocols and 60+ chains for inflation protection and high-yield strategies tailored to your risk profile.',
                impact: 'neutral',
                timestamp: 'Autonomous',
                metadata: {
                    correlationId,
                    action: 'discover_yield_opportunities',
                    recommendedChains: ['Celo', 'Arbitrum', 'Base']
                }
            });
        }

    } catch (error) {
        console.warn('[YieldAdvisorService] Could not fetch yield recommendations:', error);
        // Don't fail - return base recommendations
    }

    // Deduplicate and filter
    return deduplicateRecommendations(recommendations);
}

/**
 * Get vault details and quote for a specific yield opportunity
 *
 * @param vaultId - The vault identifier from LI.FI Earn
 * @param userAddress - User's wallet address
 * @param fromToken - Token to deposit (e.g., 'USDC')
 * @param fromChainId - Chain ID of the source token
 */
export async function getVaultQuote(
    vaultId: string,
    userAddress: string,
    fromToken: string,
    fromChainId: number,
    correlationId: string = createCorrelationId('yield-quote')
): Promise<{ quote: any | null; vault: any | null }> {
    try {
        const vault = await EarnService.getVaultDetails(vaultId);
        if (vault.status !== 'active') {
            throw new Error(`Vault ${vault.name || vaultId} is not active. Please choose an active vault.`);
        }

        const fromTokenAddress = resolveTokenAddress(fromToken, fromChainId);
        const quote = await EarnService.getDepositQuote({
            vaultId,
            fromChainId,
            toChainId: vault.chainId,
            fromTokenAddress,
            fromAddress: userAddress,
            amount: '100', // Default quote amount
            slippage: 0.005,
            correlationId,
        });

        if (!quote?.transactionRequest?.to || !quote?.transactionRequest?.data) {
            throw new Error('No executable transaction route was returned for this deposit. Try another token or amount.');
        }

        const expectedOut = Number(quote?.estimate?.toAmount ?? '0');
        const inputAmount = Number(quote?.estimate?.fromAmount ?? '0');
        if (!Number.isFinite(expectedOut) || expectedOut <= 0 || !Number.isFinite(inputAmount) || inputAmount <= 0) {
            throw new Error('Quote output is invalid for this route. Please retry with a supported token and amount.');
        }

        return { vault, quote };
    } catch (error) {
        console.warn('[YieldAdvisorService] Could not fetch vault quote:', error);
        return { vault: null, quote: null };
    }
}

/**
 * Get preferred vault categories based on strategy
 */
function getPreferredCategories(strategy?: string): string[] {
    if (!strategy) return ['stablecoins', 'yield-bearing'];

    switch (strategy) {
        case 'africapitalism':
        case 'gotong_royong':
            return ['stablecoins', 'yield-bearing'];
        case 'islamic':
            return ['stablecoins'];
        case 'global':
            return ['stablecoins', 'yield-bearing', 'tokenized-bonds'];
        default:
            return ['stablecoins', 'yield-bearing'];
    }
}

/**
 * Resolve token symbol to contract address using shared chain config.
 */
function resolveTokenAddress(symbol: string, chainId: number): string {
    if (symbol.startsWith('0x')) return symbol;

    const tokens = getTokenAddresses(chainId);
    const direct = tokens[symbol as keyof typeof tokens];
    if (direct) return direct;

    const upperSymbol = symbol.toUpperCase();
    const fallback = Object.entries(tokens).find(([key]) => key.toUpperCase() === upperSymbol)?.[1];
    if (fallback) return fallback;

    throw new Error(`Token ${symbol} not found on chain ${chainId}`);
}

/**
 * Convert user positions array to Map for easy lookup
 */
function getCurrentPositionMap(positions: any[]): Map<string, any> {
    return new Map(positions.map(pos => [pos.vaultId, pos]));
}

/**
 * Deduplicate recommendations based on content
 */
function deduplicateRecommendations(recommendations: any[]): any[] {
    try {
        const seen = new Set<string>();
        return recommendations.filter(rec => {
            const key = `${rec.type}|${rec.title}|${rec.impactAsset}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return recommendations;
    }
}

// Export singleton instance
export const yieldAdvisorService = {
    getYieldRecommendations,
    getVaultQuote,
    getPreferredCategories,
    getCurrentPositionMap,
    deduplicateRecommendations,
    getTokenAddress: resolveTokenAddress
};

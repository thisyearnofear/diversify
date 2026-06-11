/**
 * Celo token registry
 *
 * Single source of truth for Celo token metadata: address, decimals,
 * stablecoin flag, and the region the token is best suited for.
 *
 * Replaces three previously-duplicated `TOKEN_ADDRESSES` maps in
 *   - pages/api/agent/guardian-loop.ts
 *   - pages/api/vault/rebalance.ts
 *   - components/agent/AIChat.tsx (RwaActionWidget)
 *
 * and the previously-duplicated `TOKENS` map in
 *   - pages/api/vault/_executor.ts
 *
 * All four call sites now import from here. Adding a new Celo token
 * means one edit, one PR.
 */

export interface CeloTokenMetadata {
    /** EIP-55 checksummed EVM address on Celo. */
    address: `0x${string}`;
    /** ERC-20 decimals (Celo stablecoins and CELO itself use 18). */
    decimals: number;
    /** True for stablecoins, false for the native CELO asset. */
    stablecoin: boolean;
    /** ISO region the token is best suited for. */
    region?: string;
}

export const CELO_TOKEN_ADDRESSES: Record<string, CeloTokenMetadata> = {
    CELO: {
        address: '0x471EcE3750Da237f93B8E339c536989b8978a438',
        decimals: 18,
        stablecoin: false,
    },
    cUSD: {
        address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
        decimals: 18,
        stablecoin: true,
        region: 'US',
    },
    cEUR: {
        address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
        decimals: 18,
        stablecoin: true,
        region: 'EU',
    },
    cREAL: {
        address: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
        decimals: 18,
        stablecoin: true,
        region: 'BR',
    },
    KESm: {
        address: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
        decimals: 18,
        stablecoin: true,
        region: 'KE',
    },
    COPm: {
        address: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
        decimals: 18,
        stablecoin: true,
        region: 'CO',
    },
    PHPm: {
        address: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
        decimals: 18,
        stablecoin: true,
        region: 'PH',
    },
};

/** Flat address-only map. Convenient for the swap-orchestrator code path
 *  that only needs the address and not the full metadata. */
export const CELO_TOKEN_ADDRESS_BY_SYMBOL: Record<string, `0x${string}`> = Object.fromEntries(
    Object.entries(CELO_TOKEN_ADDRESSES).map(([symbol, meta]) => [symbol, meta.address]),
) as Record<string, `0x${string}`>;

/**
 * Look up the address for a Celo token symbol.
 *
 * Returns `null` for unknown symbols — callers that need to fail loud
 * can use the boolean return from `isKnownCeloToken` first.
 */
export function getCeloTokenAddress(symbol: string | null | undefined): `0x${string}` | null {
    if (!symbol) return null;
    const meta = CELO_TOKEN_ADDRESSES[symbol];
    return meta?.address ?? null;
}

export function getCeloTokenMetadata(symbol: string | null | undefined): CeloTokenMetadata | null {
    if (!symbol) return null;
    return CELO_TOKEN_ADDRESSES[symbol] ?? null;
}

export function isKnownCeloToken(symbol: string | null | undefined): symbol is keyof typeof CELO_TOKEN_ADDRESSES {
    if (!symbol) return false;
    return Object.prototype.hasOwnProperty.call(CELO_TOKEN_ADDRESSES, symbol);
}

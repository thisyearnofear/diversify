/**
 * Centralized configuration for DiversiFi
 * Single source of truth for all constants, network settings, and asset metadata.
 */

// Network Configuration
export const NETWORKS = {
    CELO_MAINNET: {
        chainId: 42220,
        name: 'Celo',
        rpcUrl: process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org',
        explorerUrl: 'https://celo.blockscout.com',
    },
    ALFAJORES: {
        chainId: 44787,
        name: 'Alfajores',
        rpcUrl: 'https://alfajores-forno.celo-testnet.org',
        explorerUrl: 'https://alfajores.celoscan.io',
        devOnly: true, // Only show in development
    },
    ARC_TESTNET: {
        chainId: 5042002,
        name: 'Arc Testnet',
        rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network',
        explorerUrl: 'https://testnet.arcscan.app',
        devOnly: true, // Only show in development
    },
    ARBITRUM_ONE: {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
    },
    RH_TESTNET: {
        chainId: 46630,
        name: 'Robinhood Chain',
        rpcUrl: process.env.NEXT_PUBLIC_RH_RPC || 'https://rpc.testnet.chain.robinhood.com',
        explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
        devOnly: true,
    },
} as const;

// Arc Data Hub Configuration (X402 Economy)
export const ARC_DATA_HUB_CONFIG = {
    RECIPIENT_ADDRESS: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    PRICING: {
        'alpha_vantage_enhanced': '0.01',
        'world_bank_analytics': '0.015',
        'macro_analysis': '0.03',
        'portfolio_optimization': '0.05',
        'alpha_vantage_premium': '0.02',
        'coingecko_premium': '0.025',
    },
    FREE_LIMITS: {
        'alpha_vantage': 25,
        'coingecko': 50,
        'world_bank': 100,
        'defillama': 200,
        'yearn': 100,
        'fred': 100
    },
    USDC_TESTNET: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    CHAIN_ID: 5042002
};

// =============================================================================
// REGION & CATEGORY CONFIGURATION (Single Source of Truth)
// =============================================================================
// 
// CONCEPTUAL MODEL:
// - Geographic Regions: Where currencies/stablecoins originate (USA, Europe, etc.)
// - Asset Categories: Non-geographic classifications (Global liquidity, Commodities)
// - Asset Region: The union of both - used for token categorization
// - User Region: Geographic only - where the user is located (no Commodities/Global)
//
// TERMINOLOGY:
// - "Global" = Globally liquid, not tied to specific region (e.g., USDC)
// - "Commodities" = Physical asset-backed tokens (e.g., PAXG gold, BCT carbon)
// - "RWA" = Broader category including Commodities + Treasuries + Yield tokens
// =============================================================================

// Geographic regions where users can be located and currencies originate
export const GEOGRAPHIC_REGIONS = {
    USA: 'USA',
    EUROPE: 'Europe',
    LATAM: 'LatAm',
    AFRICA: 'Africa',
    ASIA: 'Asia',
} as const;

// Non-geographic asset categories
export const ASSET_CATEGORIES = {
    GLOBAL: 'Global',        // Globally liquid, USD-pegged (USDC)
    COMMODITIES: 'Commodities', // Physical asset-backed (PAXG, BCT)
} as const;

// Combined: All possible regions for asset categorization
export const REGIONS = {
    ...GEOGRAPHIC_REGIONS,
    ...ASSET_CATEGORIES,
} as const;

// Type exports for consistent usage across codebase
export type GeographicRegion = typeof GEOGRAPHIC_REGIONS[keyof typeof GEOGRAPHIC_REGIONS];
export type AssetCategory = typeof ASSET_CATEGORIES[keyof typeof ASSET_CATEGORIES];
export type AssetRegion = typeof REGIONS[keyof typeof REGIONS];

// Array versions for iteration
export const GEOGRAPHIC_REGION_LIST: GeographicRegion[] = ['USA', 'Europe', 'LatAm', 'Africa', 'Asia'];
export const ASSET_CATEGORY_LIST: AssetCategory[] = ['Global', 'Commodities'];
export const ASSET_REGION_LIST: AssetRegion[] = [...GEOGRAPHIC_REGION_LIST, ...ASSET_CATEGORY_LIST];

// Colors for visualization (canonical, no duplicates)
export const REGION_COLORS: Record<AssetRegion, string> = {
    USA: '#3B82F6',        // Blue
    Europe: '#22C55E',     // Green
    LatAm: '#F59E0B',      // Amber
    Africa: '#EF4444',     // Red
    Asia: '#D946EF',       // Purple
    Global: '#2563EB',     // Deep Blue
    Commodities: '#D69E2E', // Gold
} as const;

// Regional gradients for vibrant, multicultural UI
export const REGION_GRADIENTS: Record<AssetRegion, string> = {
    Africa: 'from-red-500 to-orange-500',      // Sunset over savanna
    LatAm: 'from-amber-500 to-yellow-500',     // Golden warmth
    Asia: 'from-purple-500 to-pink-500',       // Cherry blossoms
    Europe: 'from-green-500 to-emerald-500',   // Lush forests
    USA: 'from-blue-500 to-cyan-500',          // Ocean to ocean
    Global: 'from-indigo-500 to-violet-500',   // Universal
    Commodities: 'from-yellow-600 to-amber-600', // Gold
} as const;

// Regional gradient text colors (for use on white/dark backgrounds)
export const REGION_GRADIENT_TEXT: Record<AssetRegion, string> = {
    Africa: 'from-red-600 to-orange-600',
    LatAm: 'from-amber-600 to-yellow-600',
    Asia: 'from-purple-600 to-pink-600',
    Europe: 'from-green-600 to-emerald-600',
    USA: 'from-blue-600 to-cyan-600',
    Global: 'from-indigo-600 to-violet-600',
    Commodities: 'from-yellow-700 to-amber-700',
} as const;

// =============================================================================
// TOKEN METADATA (Single Source of Truth)
// =============================================================================
// 
// Each token includes:
// - region: Geographic or asset category for diversification tracking
// - apy: Annual percentage yield (null = no yield, 0 = store of value)
// - isInflationHedge: True if asset protects against currency debasement
// - decimals: Token decimals (default 18)
// =============================================================================

export type RegionValue = (typeof REGIONS)[keyof typeof REGIONS];

export interface TokenMetadata {
    name: string;
    region: RegionValue;
    decimals?: number;
    apy?: number | null;        // Annual yield (null = none, number = %)
    isInflationHedge?: boolean; // Protects against currency debasement
}

export const TOKEN_METADATA: Record<string, TokenMetadata> = {
    // Celo Mento Regional Stablecoins (no yield, exposed to local inflation)
    USDm: { name: 'Mento Dollar', region: REGIONS.USA },
    EURm: { name: 'Mento Euro', region: REGIONS.EUROPE },
    BRLm: { name: 'Mento Brazilian Real', region: REGIONS.LATAM },
    KESm: { name: 'Mento Kenyan Shilling', region: REGIONS.AFRICA },
    COPm: { name: 'Mento Colombian Peso', region: REGIONS.LATAM },
    PHPm: { name: 'Mento Philippine Peso', region: REGIONS.ASIA },
    GHSm: { name: 'Mento Ghana Cedi', region: REGIONS.AFRICA },
    XOFm: { name: 'Mento CFA Franc', region: REGIONS.AFRICA },
    GBPm: { name: 'Mento British Pound', region: REGIONS.EUROPE },
    ZARm: { name: 'Mento South African Rand', region: REGIONS.AFRICA },
    CADm: { name: 'Mento Canadian Dollar', region: REGIONS.USA },
    AUDm: { name: 'Mento Australian Dollar', region: REGIONS.ASIA },
    CHFm: { name: 'Swiss Franc', region: REGIONS.EUROPE },
    JPYm: { name: 'Mento Japanese Yen', region: REGIONS.ASIA },
    NGNm: { name: 'Mento Nigerian Naira', region: REGIONS.AFRICA },

    // UBI Token
    'G$': { name: 'GoodDollar', region: REGIONS.GLOBAL, decimals: 18, apy: null, isInflationHedge: false },

    // Global Stablecoins (no yield, low inflation exposure)
    USDT: { name: 'Tether USD', region: REGIONS.USA, decimals: 6 },
    USDC: { name: 'USD Coin', region: REGIONS.GLOBAL, decimals: 6 },
    EURC: { name: 'Euro Coin', region: REGIONS.EUROPE, decimals: 6 },

    // Yield-Bearing Assets (Arbitrum RWAs)
    USDY: { name: 'Ondo US Dollar Yield', region: REGIONS.USA, decimals: 18, apy: 5.0 },
    SYRUPUSDC: { name: 'Syrup USDC', region: REGIONS.USA, decimals: 18, apy: 4.5 },

    // Inflation Hedges (store of value, no yield)
    PAXG: { name: 'Pax Gold', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: true },

    // Stock Tokens (Robinhood Chain Testnet RWAs)
    TSLA: { name: 'Tesla', region: REGIONS.USA, decimals: 18, apy: 0 },
    AMZN: { name: 'Amazon', region: REGIONS.USA, decimals: 18, apy: 0 },
    PLTR: { name: 'Palantir', region: REGIONS.USA, decimals: 18, apy: 0 },
    NFLX: { name: 'Netflix', region: REGIONS.USA, decimals: 18, apy: 0 },
    AMD: { name: 'AMD', region: REGIONS.USA, decimals: 18, apy: 0 },
};

// Helper to get token yield (0 if none)
export function getTokenApy(symbol: string): number {
    const normalized = symbol.toUpperCase();
    return TOKEN_METADATA[normalized]?.apy ?? 0;
}

// Helper to check if token is an inflation hedge
export function isTokenInflationHedge(symbol: string): boolean {
    const normalized = symbol.toUpperCase();
    return TOKEN_METADATA[normalized]?.isInflationHedge ?? false;
}

// Helper to get token region (normalized)
export function getTokenRegion(symbol: string): RegionValue {
    const normalized = symbol.toUpperCase();
    return TOKEN_METADATA[normalized]?.region ?? REGIONS.GLOBAL;
}

// Single Source of Truth for Network Assets
export const NETWORK_TOKENS: Record<number, string[]> = {
    [NETWORKS.CELO_MAINNET.chainId]: ['USDm', 'EURm', 'BRLm', 'KESm', 'COPm', 'PHPm', 'GHSm', 'XOFm', 'GBPm', 'ZARm', 'CADm', 'AUDm', 'CHFm', 'JPYm', 'NGNm', 'G$', 'USDT'],
    [NETWORKS.ALFAJORES.chainId]: ['USDm', 'EURm', 'BRLm', 'XOFm', 'KESm', 'PHPm', 'COPm', 'GHSm', 'GBPm', 'ZARm', 'CADm', 'AUDm', 'G$', 'USDT'],
    [NETWORKS.ARBITRUM_ONE.chainId]: ['USDC', 'PAXG', 'USDY', 'SYRUPUSDC'],
    [NETWORKS.ARC_TESTNET.chainId]: ['USDC', 'EURC'],
    [NETWORKS.RH_TESTNET.chainId]: ['TSLA', 'AMZN', 'PLTR', 'NFLX', 'AMD'],
};

// Helper: Get full asset list with metadata for a specific chain
export function getChainAssets(chainId: number) {
    const symbols = NETWORK_TOKENS[chainId] || NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];
    return symbols.map(symbol => ({
        symbol,
        name: TOKEN_METADATA[symbol]?.name || symbol,
        region: TOKEN_METADATA[symbol]?.region || REGIONS.GLOBAL
    }));
}

// Exchange Rates (USD equivalent) - FALLBACK ONLY
// These are used only when live API prices fail (DefiLlama, CoinGecko, CoinPaprika)
// Live prices are fetched via TokenPriceService with aggressive caching
export const EXCHANGE_RATES: Record<string, number> = {
    USDm: 1,
    EURm: 1.08,
    BRLm: 0.2,
    KESm: 0.0078,
    COPm: 0.00025,
    PHPm: 0.0179,
    GHSm: 0.069,
    XOFm: 0.0016,
    GBPm: 1.27,
    ZARm: 0.055,
    CADm: 0.74,
    AUDm: 0.66,
    CHFm: 1.10,
    JPYm: 0.0067,
    NGNm: 0.00061,
    'G$': 0.0002, // ~$0.0002 per G$ (GoodDollar UBI token, market rate varies)
    USDT: 1,
    USDC: 1,
    EURC: 1.08,
    PAXG: 2650,
    USDY: 1,
    SYRUPUSDC: 1,
    TSLA: 350,
    AMZN: 230,
    PLTR: 110,
    NFLX: 1050,
    AMD: 120,
} as const;

// Transaction Configuration
export const TX_CONFIG = {
    DEFAULT_SLIPPAGE: 0.5,
    MINIPAY_SLIPPAGE: 1.0,
    GAS_LIMITS: { APPROVAL: 300000, SWAP: 800000, FALLBACK: 400000 },
    CONFIRMATIONS: { MAINNET: 1, TESTNET: 2, ARC: 1 }
} as const;

// Circle Configuration
export const CIRCLE_CONFIG = {
    CCTP: {
        DOMAINS: { ETHEREUM: 0, AVALANCHE: 1, OPTIMISM: 2, ARBITRUM: 3, BASE: 6, POLYGON: 7 },
        TOKEN_MESSENGER: {
            ETHEREUM: '0xbd3fa81b58ba92a821df2201e99602b9e6e87292',
            ARBITRUM: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
            BASE: '0x1682Ae6375C4009baf3d690757d822C92fc556aE',
        },
    },
    WALLET: { API_BASE_URL: 'https://api.circle.com/v1/w3s', USER_ID_PREFIX: 'diversifi_agent_' }
};

// ABIs
export const ABIS = {
    ERC20: [
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)',
    ],
    BROKER: {
        PROVIDERS: ['function getExchangeProviders() view returns (address[])'],
        RATE: ['function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)'],
        SWAP: ['function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)'],
    },
    EXCHANGE: ['function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])'],
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
    EXCHANGE_RATE: 60 * 60 * 1000,
    INFLATION_DATA: 24 * 60 * 60 * 1000,
    BALANCE: 5 * 60 * 1000,
    SWAP_ESTIMATE: 30 * 1000,
} as const;

// Swap Strategy Configuration
export const SWAP_CONFIG = {
    STRATEGY_SCORES: {
        [NETWORKS.CELO_MAINNET.chainId]: { 'MentoSwapStrategy': 100, 'OneInchSwapStrategy': 20, 'UniswapV3Strategy': 15, 'LiFiSwapStrategy': 40 },
        [NETWORKS.ALFAJORES.chainId]: { 'MentoSwapStrategy': 100, 'LiFiSwapStrategy': 20 },
        [NETWORKS.ARC_TESTNET.chainId]: { 'CurveArcStrategy': 100, 'ArcTestnetStrategy': 90 },
        [NETWORKS.ARBITRUM_ONE.chainId]: { 'OneInchSwapStrategy': 90, 'UniswapV3Strategy': 80, 'LiFiSwapStrategy': 60, 'DirectRWAStrategy': 30 },
    },
    TOKEN_PREFERENCES: {
        'PAXG': { 'OneInchSwapStrategy': 25 },
        'USDC': { 'OneInchSwapStrategy': 15, 'UniswapV3Strategy': 12 },
        'USDY': { 'UniswapV3Strategy': 100, 'OneInchSwapStrategy': 90 },
        'SYRUPUSDC': { 'UniswapV3Strategy': 100, 'OneInchSwapStrategy': 90 },
    },
    ENABLE_PERFORMANCE_TRACKING: true,
    ENABLE_AUTOMATIC_FALLBACK: true,
    MAX_FALLBACK_ATTEMPTS: 3,
} as const;

// Token Addresses (Legacy exports for backward compatibility)
export const MAINNET_TOKENS = {
    CELO: '0x471ece3750da237f93b8e339c536989b8978a438',
    USDm: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    EURm: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    BRLm: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
    KESm: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
    COPm: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
    PHPm: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
    GHSm: '0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313',
    GBPm: '0xCCF663b1fF11028f0b19058d0f7B674004a40746',
    ZARm: '0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6',
    CADm: '0xff4Ab19391af240c311c54200a492233052B6325',
    AUDm: '0x7175504C455076F15c04A2F90a8e352281F492F9',
    XOFm: '0x73F93dcc49cB8A239e2032663e9475dd5ef29A08',
    CHFm: '0xb55a79F398E759E43C95b979163f30eC87Ee131D',
    JPYm: '0xc45eCF20f3CD864B32D9794d6f76814aE8892e20',
    NGNm: '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
    'G$': '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', // GoodDollar UBI token (checksummed)
    USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
} as const;

export const ALFAJORES_TOKENS = {
    CELO: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
    USDm: '0x874069fa1eb16d44d622f2e0ca25eea172369bc1',
    EURm: '0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f',
    BRLm: '0xe4d517785d091d3c54818832db6094bcc2744545',
    XOFm: '0xB0FA15e002516d0301884059c0aaC0F0C72b019D',
    KESm: '0x1E0433C1769271ECcF4CFF9FDdD515eefE6CdF92',
    PHPm: '0x5E0E3c9419C42a1B04e2525991FB1A2C467AB8bF',
    COPm: '0xe6A57340f0df6E020c1c0a80bC6E13048601f0d4',
    GHSm: '0x295B66bE7714458Af45E6A6Ea142A5358A6cA375',
    GBPm: '0x47f2Fb88105155a18c390641C8a73f1402B2BB12',
    ZARm: '0x1e5b44015Ff90610b54000DAad31C89b3284df4d',
    CADm: '0x02EC9E0D2Fd73e89168C1709e542a48f58d7B133',
    AUDm: '0x84CBD49F5aE07632B6B88094E81Cce8236125Fe0',
    NGNm: '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
    'G$': '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A', // GoodDollar UBI token (checksummed, same on testnet)
    USDT: '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
} as const;

export const ARBITRUM_TOKENS = {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PAXG: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429',
    USDY: '0x35e050d3c0ec2d29d269a8ecea763a183bdf9a9d',
    SYRUPUSDC: '0x41CA7586cC1311807B4605fBB748a3B8862b42b5',
} as const;

export const ARC_TOKENS = {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
} as const;

export const RH_TESTNET_TOKENS = {
    TSLA: '0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E',
    AMZN: '0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02',
    PLTR: '0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0',
    NFLX: '0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93',
    AMD: '0x71178BAc73cBeb415514eB542a8995b82669778d',
} as const;

export const BROKER_ADDRESSES = {
    MAINNET: '0x777a8255ca72412f0d706dc03c9d1987306b4cad',
    ALFAJORES: '0xD3Dff18E465bCa6241A244144765b4421Ac14D09',
    ARC_TESTNET: '0x0000000000000000000000000000000000000000',
} as const;

// Helper: Get token addresses by chain
export function getTokenAddresses(chainId: number): Record<string, string> {
    if (chainId === NETWORKS.RH_TESTNET.chainId) return RH_TESTNET_TOKENS;
    if (chainId === NETWORKS.ARC_TESTNET.chainId) return ARC_TOKENS;
    if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return ARBITRUM_TOKENS;
    return chainId === NETWORKS.ALFAJORES.chainId ? ALFAJORES_TOKENS : MAINNET_TOKENS;
}

export function getBrokerAddress(chainId: number) {
    if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return '0x0000000000000000000000000000000000000000';
    return chainId === NETWORKS.ALFAJORES.chainId ? '0xD3Dff18E465bCa6241A244144765b4421Ac14D09' : '0x777a8255ca72412f0d706dc03c9d1987306b4cad';
}

export function getNetworkConfig(chainId: number) {
    return Object.values(NETWORKS).find(n => n.chainId === chainId) || NETWORKS.CELO_MAINNET;
}

// =============================================================================
// TESTNET HELPERS — Single Source of Truth
// =============================================================================
// Derived from NETWORKS entries that carry `devOnly: true`.
// Use these instead of inline arrays like [44787, 5042002, 46630].

/** All chain IDs that are dev/testnet-only, derived from NETWORKS config. */
export const TESTNET_CHAIN_IDS: readonly number[] = Object.values(NETWORKS)
    .filter((n): n is typeof n & { devOnly: true } => (n as Record<string, unknown>).devOnly === true)
    .map(n => n.chainId);

/** Returns true when chainId belongs to a testnet / devOnly network. */
export function isTestnetChain(chainId: number | null | undefined): boolean {
    if (chainId == null) return false;
    return TESTNET_CHAIN_IDS.includes(chainId);
}

// Re-export features for convenience
export { AI_FEATURES, AUTONOMOUS_FEATURES, UI_FEATURES, WALLET_FEATURES, hasAIFeatures, hasAutonomousFeatures } from './features';

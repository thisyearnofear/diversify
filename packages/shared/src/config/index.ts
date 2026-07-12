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
    CELO_SEPOLIA: {
        chainId: 11142220,
        name: 'Celo Sepolia',
        rpcUrl: 'https://forno.celo-sepolia.celo-testnet.org',
        explorerUrl: 'https://celo-sepolia.blockscout.com',
        devOnly: true, // Only show in development
    },
    ARC_TESTNET: {
        chainId: 5042002,
        name: 'Arc Testnet',
        rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network',
        explorerUrl: 'https://testnet.arcscan.app',
        devOnly: true, // Only show in development
    },
    ARC_MAINNET: {
        chainId: 5042001,
        name: 'Arc',
        rpcUrl: process.env.NEXT_PUBLIC_ARC_MAINNET_RPC || 'https://rpc.arc.network',
        explorerUrl: 'https://arcscan.app',
        // Mainnet beta expected 2026. Not devOnly — this is the production nanopayment rail.
        // See docs/0g-bridge-plan.md §0 for the four-layer architecture.
    },
    ZERO_G_TESTNET: {
        chainId: 16602,
        name: '0G Galileo Testnet',
        rpcUrl: process.env.NEXT_PUBLIC_ZERO_G_RPC || 'https://evmrpc-testnet.0g.ai',
        explorerUrl: 'https://chainscan-galileo.0g.ai',
        devOnly: true,
    },
    ZERO_G_MAINNET: {
        chainId: 16661,
        name: '0G',
        rpcUrl: process.env.NEXT_PUBLIC_ZERO_G_MAINNET_RPC || process.env.ZERO_G_MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
        explorerUrl: 'https://chainscan.0g.ai',
        // Production evidence-anchor chain. RecommendationLedger lives here (0x3BCf…369C).
        // Not devOnly — this is the mainnet 0G rail. See docs/0g-bridge-plan.md §0.
    },
    ARBITRUM_ONE: {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
    },
    ARBITRUM_SEPOLIA: {
        chainId: 421614,
        name: 'Arbitrum Sepolia',
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
        explorerUrl: 'https://sepolia.arbiscan.io',
        devOnly: true,
    },
    RH_TESTNET: {
        chainId: 46630,
        name: 'Robinhood Chain Testnet',
        rpcUrl: process.env.NEXT_PUBLIC_RH_RPC || 'https://rpc.testnet.chain.robinhood.com',
        explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
        devOnly: true,
    },
    RH_MAINNET: {
        chainId: 4663,
        name: 'Robinhood Chain',
        rpcUrl: process.env.NEXT_PUBLIC_RH_MAINNET_RPC || process.env.ROBINHOOD_MAINNET_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com',
        explorerUrl: 'https://robinhoodchain.blockscout.com',
        // Production RWA / stock-token rail. RecommendationLedger lives here (after deploy).
        // See docs/arbitrum-yield-strategy.md § Robinhood Earn.
    },
    HYPERLIQUID: {
        chainId: 998, // Virtual chain ID for Hyperliquid perp markets (not EVM)
        name: 'Hyperliquid',
        rpcUrl: 'https://api.hyperliquid.xyz',
        explorerUrl: 'https://app.hyperliquid.xyz',
    },
} as const;

// Arc Data Hub Configuration (X402 Economy)
export const ARC_DATA_HUB_CONFIG = {
    RECIPIENT_ADDRESS: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    // Categories for Freemium Logic
    CATEGORIES: {
        BASIC: ['alpha_vantage', 'world_bank', 'defillama', 'coingecko', 'fred', 'yearn'],
        PREMIUM: ['macro_analysis', 'portfolio_optimization', 'risk_assessment', 'agent_execution', 'real_time_inflation']
    },
    PRICING: {
        // Basic Sources (Cost for "Enhanced" insights beyond free tier)
        'alpha_vantage': '0.001',
        'world_bank': '0.001',
        'defillama': '0.001',
        // Premium Sources (Always require micro-credits)
        'macro_analysis': '0.004',
        'portfolio_optimization': '0.005',
        'risk_assessment': '0.006',
        'agent_execution': '0.01',
        'real_time_inflation': '0.004'
    },
    FREE_LIMITS: {
        'alpha_vantage': 10,
        'world_bank': 20,
        'defillama': 50,
        'coingecko': 50,
        'yearn': 20,
        'fred': 50
    },
    USDC_TESTNET: '0x3600000000000000000000000000000000000000',
    CHAIN_ID: 5042002
};

// 0G Data Hub Configuration (X402 Economy on 0G)
export const ZERO_G_DATA_HUB_CONFIG = {
    RECIPIENT_ADDRESS: process.env.ZERO_G_DATA_HUB_RECIPIENT || '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B', // Mirroring Arc recipient as default
    CATEGORIES: ARC_DATA_HUB_CONFIG.CATEGORIES,
    PRICING: ARC_DATA_HUB_CONFIG.PRICING,
    FREE_LIMITS: ARC_DATA_HUB_CONFIG.FREE_LIMITS,
    USDC_TESTNET: process.env.NEXT_PUBLIC_ZERO_G_USDC || '0x8045a9f6d54b690820416e037de2241d9f8df386',
    CHAIN_ID: 16602
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

    // Bitso MXNB — Mexican Peso stablecoin, native ERC-20 on Arbitrum (exposed to local MXN inflation)
    MXNB: { name: 'Bitso Mexican Peso', region: REGIONS.LATAM, decimals: 6 },

    // Yield-Bearing Assets (Arbitrum RWAs)
    USDY: { name: 'Ondo US Dollar Yield', region: REGIONS.USA, decimals: 18, apy: 5.0 },
    SYRUPUSDC: { name: 'Syrup USDC', region: REGIONS.USA, decimals: 18, apy: 4.5 },

    // Inflation Hedges (store of value, no yield)
    PAXG: { name: 'Pax Gold', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: true },

    // Robinhood Chain native RWA tokens (tokenized stocks, ETFs, and stablecoin)
    USDG: { name: 'Robinhood USDG', region: REGIONS.USA, decimals: 18, apy: 0 },
    AAPL: { name: 'Apple Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    AMD: { name: 'AMD Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    AMZN: { name: 'Amazon Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    COIN: { name: 'Coinbase Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    GOOGL: { name: 'Alphabet Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    META: { name: 'Meta Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    MSFT: { name: 'Microsoft Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    NVDA: { name: 'NVIDIA Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    TSLA: { name: 'Tesla Stock Token', region: REGIONS.USA, decimals: 18, apy: 0 },
    QQQ: { name: 'Invesco QQQ Trust', region: REGIONS.USA, decimals: 18, apy: 0 },
    SGOV: { name: 'iShares 0-3 Month Treasury Bond', region: REGIONS.USA, decimals: 18, apy: 0 },
    SLV: { name: 'iShares Silver Trust', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: true },
    SPY: { name: 'SPDR S&P 500 ETF Trust', region: REGIONS.USA, decimals: 18, apy: 0 },

    // Hyperliquid Perpetual Commodity Markets (synthetic 1x long exposure)
    // These represent perp positions on Hyperliquid, collateralized in USDC
    GOLD: { name: 'Gold Perpetual (Hyperliquid)', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: true },
    SILVER: { name: 'Silver Perpetual (Hyperliquid)', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: true },
    OIL: { name: 'Crude Oil Perpetual (Hyperliquid)', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: false },
    COPPER: { name: 'Copper Perpetual (Hyperliquid)', region: REGIONS.COMMODITIES, decimals: 18, apy: 0, isInflationHedge: false },

    // Native ETH (used as quote token on Robinhood Chain)
    ETH: { name: 'Ether', region: REGIONS.GLOBAL, decimals: 18, apy: 0 },

    // Fictional Emerging Market Companies (Celo Sepolia Testnet)
    // Africa
    WAKANDA: { name: 'Wakanda Design Group', region: REGIONS.AFRICA, decimals: 18, apy: 0 },
    DAKAR: { name: 'Dakar Nexus Energy', region: REGIONS.AFRICA, decimals: 18, apy: 0 },
    SHADOW: { name: 'Shadow Market Syndicates', region: REGIONS.AFRICA, decimals: 18, apy: 0 },
    // Latin America / Asia
    KUBERA: { name: "Kubera's Treasury Guilds", region: REGIONS.ASIA, decimals: 18, apy: 0 },
    SANTA: { name: 'Santa Prisca Silver Mining', region: REGIONS.LATAM, decimals: 18, apy: 0 },
    SHADALOO: { name: 'Shadaloo Corporation', region: REGIONS.ASIA, decimals: 18, apy: 0 },
    // Asia Pacific
    MISHIMA: { name: 'Mishima Zaibatsu', region: REGIONS.ASIA, decimals: 18, apy: 0 },
    ARASAKA: { name: 'Arasaka Corporation', region: REGIONS.ASIA, decimals: 18, apy: 0 },
    SURA: { name: 'Sura Corporation', region: REGIONS.ASIA, decimals: 18, apy: 0 },
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
    [NETWORKS.CELO_SEPOLIA.chainId]: ['USDm', 'EURm', 'BRLm', 'XOFm', 'KESm', 'PHPm', 'COPm', 'GHSm', 'GBPm', 'ZARm', 'CADm', 'AUDm', 'G$', 'USDT', 'CELO', 'WAKANDA', 'DAKAR', 'SHADOW', 'KUBERA', 'SANTA', 'SHADALOO', 'MISHIMA', 'ARASAKA', 'SURA'],
    [NETWORKS.ARBITRUM_ONE.chainId]: ['USDC', 'MXNB', 'PAXG', 'USDY', 'SYRUPUSDC'],
    [NETWORKS.ARBITRUM_SEPOLIA.chainId]: ['USDC'],
    [NETWORKS.ARC_TESTNET.chainId]: ['USDC', 'EURC'],
    [NETWORKS.ARC_MAINNET.chainId]: ['USDC', 'EURC'],
    [NETWORKS.RH_TESTNET.chainId]: ['ETH'],
    [NETWORKS.RH_MAINNET.chainId]: [
        'USDG', 'WETH', 'SPY', 'QQQ', 'SGOV', 'SLV',
        'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'COIN',
    ],
    [NETWORKS.HYPERLIQUID.chainId]: ['GOLD', 'SILVER', 'OIL', 'COPPER'],
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
    MXNB: 0.054, // ~1 MXN; fallback only, live MXN/USD fetched when available
    PAXG: 2650,
    GOLD: 3200,
    SILVER: 32,
    OIL: 75,
    COPPER: 4.5,
    USDY: 1,
    SYRUPUSDC: 1,
    ETH: 3500,
    // Robinhood Chain RWA tokens (fallback only; live prices from Chainlink feeds)
    USDG: 1,
    AAPL: 228.45,
    AMD: 160,
    AMZN: 200,
    COIN: 240,
    GOOGL: 168.22,
    META: 500,
    MSFT: 450,
    NVDA: 181.84,
    TSLA: 260.10,
    QQQ: 500,
    SGOV: 100,
    SLV: 31,
    SPY: 600,

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
    WALLET: { 
        API_BASE_URL: 'https://api.circle.com/v1/w3s', 
        USER_ID_PREFIX: 'diversifi_agent_' 
    },
    USDC_TOKEN_ID_ARC: '0x3600000000000000000000000000000000000000', // Actual token ID for Arc testnet USDC
};

export const ARBITRUM_TOKENS = {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PAXG: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429',
    USDY: '0x35e050d3c0ec2d29d269a8ecea763a183bdf9a9d',
    SYRUPUSDC: '0x41CA7586cC1311807B4605fBB748a3B8862b42b5',
    // Bitso MXNB (Mexican Peso) — Arbitrum One proxy contract, 6 decimals
    MXNB: '0xF197FFC28c23E0309B5559e7a166f2c6164C80aA',
} as const;

export const ARBITRUM_SEPOLIA_TOKENS = {
    // Arbitrum Sepolia USDC (Circle testnet faucet)
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
} as const;

// Hyperliquid Configuration
export const HYPERLIQUID_CONFIG = {
    BRIDGE_ADDRESS_ARBITRUM: '0x2Df1c51E09a42AD0809B739f5Ad8854a9554Dbc7', // Standard HL bridge on Arb
    USDC_TOKEN_ID: ARBITRUM_TOKENS.USDC, // Mainnet USDC on Arbitrum (single source of truth)
    API_URL: 'https://api.hyperliquid.xyz',
    TESTNET_API_URL: 'https://api.hyperliquid-testnet.xyz'
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
    // JSON ABI format for wagmi/viem compatibility
    ERC20_JSON: [
        {
            inputs: [{ name: 'owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
        },
        {
            inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
            ],
            name: 'allowance',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
        },
        {
            inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
        },
        {
            inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
            ],
            name: 'transfer',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
        },
    ] as const,
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
        [NETWORKS.CELO_SEPOLIA.chainId]: { 'MentoSwapStrategy': 100, 'LiFiSwapStrategy': 20 },
        [NETWORKS.ARC_TESTNET.chainId]: { 'CurveArcStrategy': 100, 'ArcTestnetStrategy': 90 },
        [NETWORKS.ARBITRUM_ONE.chainId]: { 'OneInchSwapStrategy': 90, 'UniswapV3Strategy': 80, 'LiFiSwapStrategy': 60, 'DirectRWAStrategy': 30 },
        [NETWORKS.ARBITRUM_SEPOLIA.chainId]: { 'UniswapV3Strategy': 80, 'LiFiSwapStrategy': 60 },
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

export const CELO_SEPOLIA_TOKENS = {
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
    'G$': '0x61FA0fB802fd8345C06da558240E0651886fec69', // GoodDollar staging G$ (Celo). GoodDollar does not publish a Celo Sepolia deployment; using staging so the token list is functional for testing. Override to mainnet (0x62B8...9c7A) for production.
    USDT: '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
} as const;

export const ARC_TOKENS = {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
} as const;

export const RH_TESTNET_TOKENS = {
    WETH: '0x95fa0c32181d073FA9b07F0eC3961C845d00bE21',
} as const;

export const RH_MAINNET_TOKENS = {
    WETH: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    USDG: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    // Stock tokens (ERC-20) — curated set most relevant to savings/RWA hedging
    AAPL: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9',
    AMD: '0x86923f96303D656E4aa86D9d42D1e57ad2023fdC',
    AMZN: '0x12f190a9F9d7D37a250758b26824B97CE941bF54',
    COIN: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b',
    GOOGL: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3',
    META: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35',
    MSFT: '0xe93237C50D904957Cf27E7B1133b510C669c2e74',
    NVDA: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
    TSLA: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    // ETFs
    QQQ: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68',
    SGOV: '0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5',
    SLV: '0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f',
    SPY: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C',
} as const;

export const BROKER_ADDRESSES = {
    MAINNET: '0x777a8255ca72412f0d706dc03c9d1987306b4cad',
    CELO_SEPOLIA: '0xD3Dff18E465bCa6241A244144765b4421Ac14D09',
    ARC_TESTNET: '0x0000000000000000000000000000000000000000',
    ZERO_G_TESTNET: '0x0000000000000000000000000000000000000000',
} as const;

// Helper: Get token addresses by chain
export function getTokenAddresses(chainId: number): Record<string, string> {
    if (chainId === NETWORKS.RH_TESTNET.chainId) return RH_TESTNET_TOKENS;
    if (chainId === NETWORKS.RH_MAINNET.chainId) return RH_MAINNET_TOKENS;
    if (chainId === NETWORKS.ARC_TESTNET.chainId || chainId === NETWORKS.ARC_MAINNET.chainId) return ARC_TOKENS;
    if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return ARBITRUM_TOKENS;
    if (chainId === NETWORKS.ARBITRUM_SEPOLIA.chainId) return ARBITRUM_SEPOLIA_TOKENS;
    return chainId === NETWORKS.CELO_SEPOLIA.chainId ? CELO_SEPOLIA_TOKENS : MAINNET_TOKENS;
}

export function getBrokerAddress(chainId: number) {
    if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return '0x0000000000000000000000000000000000000000';
    if (chainId === NETWORKS.ARBITRUM_SEPOLIA.chainId) return '0x0000000000000000000000000000000000000000';
    return chainId === NETWORKS.CELO_SEPOLIA.chainId ? '0xD3Dff18E465bCa6241A244144765b4421Ac14D09' : '0x777a8255ca72412f0d706dc03c9d1987306b4cad';
}

export function getNetworkConfig(chainId: number) {
    return Object.values(NETWORKS).find(n => n.chainId === chainId) || NETWORKS.CELO_MAINNET;
}

// =============================================================================
// TESTNET HELPERS — Single Source of Truth
// =============================================================================
// Derived from NETWORKS entries that carry `devOnly: true`.
// Use these instead of inline arrays like [11142220, 5042002, 46630].

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

// =============================================================================
// LIFI COMPOSER VAULTS (Curated List)
// =============================================================================
// LiFi Earn uses LiFi Composer - not a separate API.
// Vaults are accessed via standard /quote endpoint with vault token address.
// See: https://docs.li.fi/composer/reference/supported-protocols

export interface VaultConfig {
    address: string;
    name: string;
    protocol: string;
    asset: { symbol: string; address: string; decimals: number };
    category: string[];
    risk: 'low' | 'medium' | 'high';
    isActive: boolean;
}

export const LIFI_VAULTS: Record<number, VaultConfig[]> = {
    // Base - LI.FI Composer supports Morpho, Aave, Seamless
    8453: [
        {
            address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A',
            name: 'Morpho USDC',
            protocol: 'morpho',
            asset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
            category: ['lending', 'stablecoin'],
            risk: 'low',
            isActive: true,
        },
        {
            address: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB',
            name: 'Seamless USDC',
            protocol: 'seamless',
            asset: { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
            category: ['lending', 'stablecoin'],
            risk: 'low',
            isActive: true,
        },
    ],
    // Ethereum - LI.FI Composer supports Lido, Aave, Morpho, EtherFi
    1: [
        {
            address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
            name: 'Lido stETH',
            protocol: 'lido',
            asset: { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
            category: ['liquid-staking', 'eth'],
            risk: 'low',
            isActive: true,
        },
        {
            address: '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
            name: 'EtherFi weETH',
            protocol: 'etherfi',
            asset: { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
            category: ['liquid-staking', 'restaking'],
            risk: 'medium',
            isActive: true,
        },
        {
            address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
            name: 'Aave V3 USDC',
            protocol: 'aave-v3',
            asset: { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
            category: ['lending', 'stablecoin'],
            risk: 'low',
            isActive: true,
        },
    ],
    // Arbitrum - LI.FI Composer supports Aave, Pendle
    42161: [
        {
            address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
            name: 'Aave V3 USDC',
            protocol: 'aave-v3',
            asset: { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
            category: ['lending', 'stablecoin'],
            risk: 'low',
            isActive: true,
        },
    ],
    // Celo - Cross-chain deposits via LI.FI to other chains
    // Direct Celo vaults can be added as LI.FI Composer expands support
    42220: [],
};

export function getLiFiVaults(chainId: number, filters?: { protocol?: string; category?: string; risk?: 'low' | 'medium' | 'high' }): VaultConfig[] {
    let vaults = LIFI_VAULTS[chainId]?.filter(v => v.isActive) || [];
    if (filters?.protocol) vaults = vaults.filter(v => v.protocol === filters.protocol);
    if (filters?.category) vaults = vaults.filter(v => v.category.includes(filters.category!));
    if (filters?.risk) vaults = vaults.filter(v => v.risk === filters.risk);
    return vaults;
}

export function getLiFiVaultByAddress(chainId: number, address: string): VaultConfig | undefined {
    return LIFI_VAULTS[chainId]?.find(v => v.address.toLowerCase() === address.toLowerCase());
}

// ─── Celo Token Registry ──────────────────────────────────────────────────
// Single source of truth for Celo token metadata. Replaces the previously
// duplicated TOKEN_ADDRESSES maps in pages/api/agent/guardian-loop.ts,
// pages/api/vault/rebalance.ts, components/agent/AIChat.tsx, and the
// richer TOKENS map in pages/api/vault/_executor.ts.
export {
    CELO_TOKEN_ADDRESSES,
    CELO_TOKEN_ADDRESS_BY_SYMBOL,
    getCeloTokenAddress,
    getCeloTokenMetadata,
    isKnownCeloToken,
    type CeloTokenMetadata,
} from './celo-tokens';

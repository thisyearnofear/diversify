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

// Region Configuration
export const REGIONS = {
    USA: 'USA',
    EUROPE: 'Europe',
    LATAM: 'LatAm',
    AFRICA: 'Africa',
    ASIA: 'Asia',
    GLOBAL: 'Global',
    COMMODITIES: 'Commodities',
} as const;

export const REGION_COLORS = {
    USA: '#3B82F6',
    Europe: '#22C55E',
    LatAm: '#F59E0B',
    Africa: '#EF4444',
    Asia: '#D946EF',
    Global: '#2563EB',
    Commodities: "#D69E2E",
    Commodity: "#D69E2E",
} as const;

// Token Metadata - uses REGIONS values for consistency with UI
export type RegionValue = (typeof REGIONS)[keyof typeof REGIONS];
export const TOKEN_METADATA: Record<string, { name: string; region: RegionValue; decimals?: number }> = {
    CUSD: { name: 'Celo Dollar', region: REGIONS.USA },
    CEUR: { name: 'Celo Euro', region: REGIONS.EUROPE },
    CREAL: { name: 'Celo Brazilian Real', region: REGIONS.LATAM },
    CKES: { name: 'Celo Kenyan Shilling', region: REGIONS.AFRICA },
    CCOP: { name: 'Celo Colombian Peso', region: REGIONS.LATAM },
    PUSO: { name: 'Philippine Peso', region: REGIONS.ASIA },
    CGHS: { name: 'Celo Ghana Cedi', region: REGIONS.AFRICA },
    CXOF: { name: 'CFA Franc', region: REGIONS.AFRICA },
    CPESO: { name: 'Philippine Peso', region: REGIONS.ASIA },
    CGBP: { name: 'British Pound', region: REGIONS.EUROPE },
    CZAR: { name: 'South African Rand', region: REGIONS.AFRICA },
    CCAD: { name: 'Canadian Dollar', region: REGIONS.USA },
    CAUD: { name: 'Australian Dollar', region: REGIONS.ASIA },
    CCHF: { name: 'Swiss Franc', region: REGIONS.EUROPE },
    CJPY: { name: 'Japanese Yen', region: REGIONS.ASIA },
    CNGN: { name: 'Nigerian Naira', region: REGIONS.AFRICA },
    USDT: { name: 'Tether USD', region: REGIONS.USA, decimals: 6 },
    USDC: { name: 'USD Coin', region: REGIONS.GLOBAL, decimals: 6 },
    EURC: { name: 'Euro Coin', region: REGIONS.EUROPE, decimals: 6 },
    PAXG: { name: 'Pax Gold', region: REGIONS.COMMODITIES, decimals: 18 },
    USDY: { name: 'Ondo US Dollar Yield', region: REGIONS.USA, decimals: 18 },
};

// Helper to get token region (normalized)
export function getTokenRegion(symbol: string): RegionValue {
    const normalized = symbol.toUpperCase();
    return TOKEN_METADATA[normalized]?.region ?? REGIONS.GLOBAL;
}

// Single Source of Truth for Network Assets
export const NETWORK_TOKENS: Record<number, string[]> = {
    [NETWORKS.CELO_MAINNET.chainId]: ['CUSD', 'CEUR', 'CREAL', 'CKES', 'CCOP', 'PUSO', 'CGHS', 'CXOF', 'CGBP', 'CZAR', 'CCAD', 'CAUD', 'CCHF', 'CJPY', 'CNGN', 'USDT'],
    [NETWORKS.ALFAJORES.chainId]: ['CUSD', 'CEUR', 'CREAL', 'CXOF', 'CKES', 'CPESO', 'CCOP', 'CGHS', 'CGBP', 'CZAR', 'CCAD', 'CAUD', 'PUSO', 'USDT'],
    [NETWORKS.ARBITRUM_ONE.chainId]: ['USDC', 'PAXG', 'USDY'],
    [NETWORKS.ARC_TESTNET.chainId]: ['USDC', 'EURC'],
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

// Exchange Rates (USD equivalent)
export const EXCHANGE_RATES: Record<string, number> = {
    CUSD: 1,
    CEUR: 1.08,
    CREAL: 0.2,
    CKES: 0.0078,
    CCOP: 0.00025,
    PUSO: 0.0179,
    CGHS: 0.069,
    CXOF: 0.0016,
    CPESO: 0.0179,
    CGBP: 1.27,
    CZAR: 0.055,
    CCAD: 0.74,
    CAUD: 0.66,
    CCHF: 1.10,
    CJPY: 0.0067,
    CNGN: 0.00061,
    USDT: 1,
    USDC: 1,
    EURC: 1.08,
    PAXG: 2650,
    USDY: 1,

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
        [NETWORKS.CELO_MAINNET.chainId]: { 'MentoSwapStrategy': 100, 'OneInchSwapStrategy': 20, 'UniswapV3Strategy': 15, 'LiFiSwapStrategy': 10 },
        [NETWORKS.ALFAJORES.chainId]: { 'MentoSwapStrategy': 100, 'LiFiSwapStrategy': 20 },
        [NETWORKS.ARC_TESTNET.chainId]: { 'CurveArcStrategy': 100, 'ArcTestnetStrategy': 90 },
        [NETWORKS.ARBITRUM_ONE.chainId]: { 'OneInchSwapStrategy': 90, 'UniswapV3Strategy': 80, 'LiFiSwapStrategy': 60, 'DirectRWAStrategy': 30 },
    },
    TOKEN_PREFERENCES: {
        'PAXG': { 'OneInchSwapStrategy': 25 },
        'USDC': { 'OneInchSwapStrategy': 15, 'UniswapV3Strategy': 12 },
        'USDY': { 'UniswapV3Strategy': 100, 'OneInchSwapStrategy': 90 },

    },
    ENABLE_PERFORMANCE_TRACKING: true,
    ENABLE_AUTOMATIC_FALLBACK: true,
    MAX_FALLBACK_ATTEMPTS: 3,
} as const;

// Token Addresses (Legacy exports for backward compatibility)
export const MAINNET_TOKENS = {
    CELO: '0x471ece3750da237f93b8e339c536989b8978a438',
    CUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    CEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    CREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
    CKES: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
    CCOP: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
    PUSO: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
    CGHS: '0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313',
    CGBP: '0xCCF663b1fF11028f0b19058d0f7B674004a40746',
    CZAR: '0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6',
    CCAD: '0xff4Ab19391af240c311c54200a492233052B6325',
    CAUD: '0x7175504C455076F15c04A2F90a8e352281F492F9',
    CXOF: '0x73F93dcc49cB8A239e2032663e9475dd5ef29A08',
    CCHF: '0xb55a79F398E759E43C95b979163f30eC87Ee131D',
    CJPY: '0xc45eCF20f3CD864B32D9794d6f76814aE8892e20',
    CNGN: '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
    USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
} as const;

export const ALFAJORES_TOKENS = {
    CELO: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
    CUSD: '0x874069fa1eb16d44d622f2e0ca25eea172369bc1',
    CEUR: '0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f',
    CREAL: '0xe4d517785d091d3c54818832db6094bcc2744545',
    CXOF: '0xB0FA15e002516d0301884059c0aaC0F0C72b019D',
    CKES: '0x1E0433C1769271ECcF4CFF9FDdD515eefE6CdF92',
    CPESO: '0x5E0E3c9419C42a1B04e2525991FB1A2C467AB8bF',
    CCOP: '0xe6A57340f0df6E020c1c0a80bC6E13048601f0d4',
    CGHS: '0x295B66bE7714458Af45E6A6Ea142A5358A6cA375',
    CGBP: '0x47f2Fb88105155a18c390641C8a73f1402B2BB12',
    CZAR: '0x1e5b44015Ff90610b54000DAad31C89b3284df4d',
    CCAD: '0x02EC9E0D2Fd73e89168C1709e542a48f58d7B133',
    CAUD: '0x84CBD49F5aE07632B6B88094E81Cce8236125Fe0',
    PUSO: '0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b',
    CNGN: '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
    USDT: '0xd077A400968890Eacc75cdc901F0356c943e4fDb',
} as const;

export const ARBITRUM_TOKENS = {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PAXG: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429',
    USDY: '0x96F6eF951840721AdBF41Ac996DdF11aCb0A6382',

} as const;

export const ARC_TOKENS = {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
} as const;

export const BROKER_ADDRESSES = {
    MAINNET: '0x777a8255ca72412f0d706dc03c9d1987306b4cad',
    ALFAJORES: '0xD3Dff18E465bCa6241A244144765b4421Ac14D09',
    ARC_TESTNET: '0x0000000000000000000000000000000000000000',
} as const;

// Helper: Get token addresses by chain
export function getTokenAddresses(chainId: number): Record<string, string> {
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

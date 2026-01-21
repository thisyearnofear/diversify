/**
 * Centralized configuration for DiversiFi
 * Single source of truth for all constants
 */

// Network Configuration
export const NETWORKS = {
    CELO_MAINNET: {
        chainId: 42220,
        name: 'Celo Mainnet',
        rpcUrl: process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org',
        explorerUrl: 'https://celo.blockscout.com',
    },
    ALFAJORES: {
        chainId: 44787,
        name: 'Celo Alfajores',
        rpcUrl: 'https://alfajores-forno.celo-testnet.org',
        explorerUrl: 'https://alfajores.celoscan.io',
    },
    ARC_TESTNET: {
        chainId: 5042002,
        name: 'Arc Testnet',
        rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network',
        explorerUrl: 'https://testnet.arcscan.app',
    },
    ARBITRUM_ONE: {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
    },
} as const;

// Arc Data Hub Configuration (X402 Economy)
// FREE APIs with usage-based micro-payments to prove the model
export const ARC_DATA_HUB_CONFIG = {
    RECIPIENT_ADDRESS: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
    PRICING: {
        // Free APIs with enhanced processing (pay for compute/analysis)
        'alpha_vantage_enhanced': '0.01',    // Enhanced analysis of free forex data
        'world_bank_analytics': '0.015',     // AI analysis of free inflation data  
        'defillama_realtime': '0.01',        // Real-time vs 5min delayed data
        'yearn_optimizer': '0.02',           // Yield optimization algorithms
        'coingecko_analytics': '0.015',      // Market analysis of free price data
        'fred_insights': '0.01',             // Economic insights from free FRED data

        // Usage-based charging (after free limits)
        'alpha_vantage_premium': '0.02',     // After 25 free requests/day
        'coingecko_premium': '0.025',        // After 50 free requests/day

        // Value-added services using free data
        'macro_analysis': '0.03',            // AI macro analysis combining free sources
        'portfolio_optimization': '0.05',    // Advanced portfolio optimization
        'risk_assessment': '0.02',           // Risk analysis using multiple free sources
    },
    FREE_LIMITS: {
        // Daily free request limits before x402 kicks in
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

// Circle Infrastructure Configuration
export const CIRCLE_CONFIG = {
    // Cross-Chain Transfer Protocol (CCTP)
    CCTP: {
        DOMAINS: {
            ETHEREUM: 0,
            AVALANCHE: 1,
            OPTIMISM: 2,
            ARBITRUM: 3,
            BASE: 6,
            POLYGON: 7,
        },
        // Mainnet Token Messenger Addresses
        TOKEN_MESSENGER: {
            ETHEREUM: '0xbd3fa81b58ba92a821df2201e99602b9e6e87292',
            ARBITRUM: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
            BASE: '0x1682Ae6375C4009baf3d690757d822C92fc556aE',
        },
    },
    // Programmable Wallets (Entity Secret / API Key)
    WALLET: {
        API_BASE_URL: 'https://api.circle.com/v1/w3s',
        USER_ID_PREFIX: 'diversifi_agent_',
    }
};

// Token Addresses - Mainnet
export const MAINNET_TOKENS = {
    CELO: '0x471ece3750da237f93b8e339c536989b8978a438',
    CUSD: '0x765de816845861e75a25fca122bb6898b8b1282a',
    CEUR: '0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73',
    CREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
    CKES: '0x456a3d042c0dbd3db53d5489e98dfb038553b0d0',
    CCOP: '0x8a567e2ae79ca692bd748ab832081c45de4041ea',
    PUSO: '0x105d4a9306d2e55a71d2eb95b81553ae1dc20d7b',
} as const;

// Token Addresses - Alfajores
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
} as const;

// Token Addresses - Arc Testnet
export const ARC_TOKENS = {
    USDC: '0x3600000000000000000000000000000000000000', // Native USDC ERC20 interface
} as const;

// Token Addresses - Arbitrum One (RWAs)
export const ARBITRUM_TOKENS = {
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PAXG: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429', // Tokenized Gold
} as const;

// Broker Addresses
export const BROKER_ADDRESSES = {
    MAINNET: '0x777a8255ca72412f0d706dc03c9d1987306b4cad',
    ALFAJORES: '0xD3Dff18E465bCa6241A244144765b4421Ac14D09',
    ARC_TESTNET: '0x0000000000000000000000000000000000000000', // Placeholder
} as const;

// Transaction Configuration
export const TX_CONFIG = {
    DEFAULT_SLIPPAGE: 0.5, // 0.5%
    MINIPAY_SLIPPAGE: 1.0, // 1.0% for MiniPay
    GAS_LIMITS: {
        APPROVAL: 300000,
        SWAP: 800000,
        FALLBACK: 400000,
    },
    CONFIRMATIONS: {
        MAINNET: 1,
        TESTNET: 2,
        ARC: 1,
    },
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
    EXCHANGE_RATE: 60 * 60 * 1000, // 1 hour
    INFLATION_DATA: 24 * 60 * 60 * 1000, // 24 hours
    BALANCE: 5 * 60 * 1000, // 5 minutes
} as const;

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
    PAXG: 2000, // Placeholder Gold Price - Should be fetched dynamically
} as const;

// Region Configuration
export const REGIONS = {
    USA: 'USA',
    EUROPE: 'Europe',
    LATAM: 'LatAm',
    AFRICA: 'Africa',
    ASIA: 'Asia',
    GLOBAL: 'Global',
} as const;

export const REGION_COLORS = {
    USA: '#3B82F6',
    Europe: '#22C55E',
    LatAm: '#F59E0B',
    Africa: '#EF4444',
    Asia: '#D946EF',
    Global: '#2563EB',
} as const;

// Token Metadata
export const TOKEN_METADATA: Record<string, { name: string; region: keyof typeof REGIONS; decimals?: number }> = {
    CUSD: { name: 'Celo Dollar', region: 'USA' },
    CEUR: { name: 'Celo Euro', region: 'EUROPE' },
    CREAL: { name: 'Celo Brazilian Real', region: 'LATAM' },
    CKES: { name: 'Celo Kenyan Shilling', region: 'AFRICA' },
    CCOP: { name: 'Celo Colombian Peso', region: 'LATAM' },
    PUSO: { name: 'Philippine Peso', region: 'ASIA' },
    CGHS: { name: 'Celo Ghana Cedi', region: 'AFRICA' },
    CXOF: { name: 'CFA Franc', region: 'AFRICA' },
    CPESO: { name: 'Philippine Peso', region: 'ASIA' },
    CGBP: { name: 'British Pound', region: 'EUROPE' },
    CZAR: { name: 'South African Rand', region: 'AFRICA' },
    CCAD: { name: 'Canadian Dollar', region: 'USA' },
    CAUD: { name: 'Australian Dollar', region: 'ASIA' },
    USDC: { name: 'USD Coin', region: 'GLOBAL', decimals: 6 },
    PAXG: { name: 'Paxos Gold', region: 'GLOBAL', decimals: 18 },
} as const;

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
        RATE: [
            'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)',
        ],
        SWAP: [
            'function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)',
        ],
    },
    EXCHANGE: [
        'function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])',
    ],
} as const;

// Helper functions
export function getTokenAddresses(chainId: number) {
    if (chainId === NETWORKS.ARC_TESTNET.chainId) return ARC_TOKENS;
    if (chainId === NETWORKS.ARBITRUM_ONE.chainId) return ARBITRUM_TOKENS;
    return chainId === NETWORKS.ALFAJORES.chainId ? ALFAJORES_TOKENS : MAINNET_TOKENS;
}

export function getBrokerAddress(chainId: number) {
    return chainId === NETWORKS.ALFAJORES.chainId
        ? BROKER_ADDRESSES.ALFAJORES
        : chainId === NETWORKS.ARC_TESTNET.chainId
            ? BROKER_ADDRESSES.ARC_TESTNET
            : BROKER_ADDRESSES.MAINNET;
}

export function getNetworkConfig(chainId: number) {
    return chainId === NETWORKS.ALFAJORES.chainId
        ? NETWORKS.ALFAJORES
        : chainId === NETWORKS.ARC_TESTNET.chainId
            ? NETWORKS.ARC_TESTNET
            : chainId === NETWORKS.ARBITRUM_ONE.chainId
                ? NETWORKS.ARBITRUM_ONE
                : NETWORKS.CELO_MAINNET;
}

/**
 * Centralized configuration for DiversiFi
 * Single source of truth for all constants
 */

// Network Configuration
export const NETWORKS = {
    MAINNET: {
        chainId: 42220,
        name: 'Celo Mainnet',
        rpcUrl: 'https://forno.celo.org',
        explorerUrl: 'https://explorer.celo.org/mainnet',
    },
    ALFAJORES: {
        chainId: 44787,
        name: 'Celo Alfajores',
        rpcUrl: 'https://alfajores-forno.celo-testnet.org',
        explorerUrl: 'https://alfajores.celoscan.io',
    },
} as const;

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

// Broker Addresses
export const BROKER_ADDRESSES = {
    MAINNET: '0x777a8255ca72412f0d706dc03c9d1987306b4cad',
    ALFAJORES: '0xD3Dff18E465bCa6241A244144765b4421Ac14D09',
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
} as const;

// Region Configuration
export const REGIONS = {
    USA: 'USA',
    EUROPE: 'Europe',
    LATAM: 'LatAm',
    AFRICA: 'Africa',
    ASIA: 'Asia',
} as const;

export const REGION_COLORS = {
    USA: '#3B82F6',
    Europe: '#22C55E',
    LatAm: '#F59E0B',
    Africa: '#EF4444',
    Asia: '#D946EF',
} as const;

// Token Metadata
export const TOKEN_METADATA: Record<string, { name: string; region: keyof typeof REGIONS }> = {
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
    return chainId === NETWORKS.ALFAJORES.chainId ? ALFAJORES_TOKENS : MAINNET_TOKENS;
}

export function getBrokerAddress(chainId: number) {
    return chainId === NETWORKS.ALFAJORES.chainId
        ? BROKER_ADDRESSES.ALFAJORES
        : BROKER_ADDRESSES.MAINNET;
}

export function getNetworkConfig(chainId: number) {
    return chainId === NETWORKS.ALFAJORES.chainId ? NETWORKS.ALFAJORES : NETWORKS.MAINNET;
}

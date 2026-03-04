/**
 * Centralized configuration for DiversiFi
 * Single source of truth for all constants, network settings, and asset metadata.
 */
export declare const NETWORKS: {
    readonly CELO_MAINNET: {
        readonly chainId: 42220;
        readonly name: "Celo";
        readonly rpcUrl: string;
        readonly explorerUrl: "https://celo.blockscout.com";
    };
    readonly CELO_SEPOLIA: {
        readonly chainId: 11142220;
        readonly name: "Celo Sepolia";
        readonly rpcUrl: "https://forno.celo-sepolia.celo-testnet.org";
        readonly explorerUrl: "https://celo-sepolia.blockscout.com";
        readonly devOnly: true;
    };
    readonly ARC_TESTNET: {
        readonly chainId: 5042002;
        readonly name: "Arc Testnet";
        readonly rpcUrl: string;
        readonly explorerUrl: "https://testnet.arcscan.app";
        readonly devOnly: true;
    };
    readonly ARBITRUM_ONE: {
        readonly chainId: 42161;
        readonly name: "Arbitrum";
        readonly rpcUrl: string;
        readonly explorerUrl: "https://arbiscan.io";
    };
    readonly RH_TESTNET: {
        readonly chainId: 46630;
        readonly name: "Robinhood Chain";
        readonly rpcUrl: string;
        readonly explorerUrl: "https://explorer.testnet.chain.robinhood.com";
        readonly devOnly: true;
    };
};
export declare const ARC_DATA_HUB_CONFIG: {
    RECIPIENT_ADDRESS: string;
    PRICING: {
        alpha_vantage_enhanced: string;
        world_bank_analytics: string;
        macro_analysis: string;
        portfolio_optimization: string;
        alpha_vantage_premium: string;
        coingecko_premium: string;
    };
    FREE_LIMITS: {
        alpha_vantage: number;
        coingecko: number;
        world_bank: number;
        defillama: number;
        yearn: number;
        fred: number;
    };
    USDC_TESTNET: string;
    CHAIN_ID: number;
};
export declare const GEOGRAPHIC_REGIONS: {
    readonly USA: "USA";
    readonly EUROPE: "Europe";
    readonly LATAM: "LatAm";
    readonly AFRICA: "Africa";
    readonly ASIA: "Asia";
};
export declare const ASSET_CATEGORIES: {
    readonly GLOBAL: "Global";
    readonly COMMODITIES: "Commodities";
};
export declare const REGIONS: {
    readonly GLOBAL: "Global";
    readonly COMMODITIES: "Commodities";
    readonly USA: "USA";
    readonly EUROPE: "Europe";
    readonly LATAM: "LatAm";
    readonly AFRICA: "Africa";
    readonly ASIA: "Asia";
};
export type GeographicRegion = typeof GEOGRAPHIC_REGIONS[keyof typeof GEOGRAPHIC_REGIONS];
export type AssetCategory = typeof ASSET_CATEGORIES[keyof typeof ASSET_CATEGORIES];
export type AssetRegion = typeof REGIONS[keyof typeof REGIONS];
export declare const GEOGRAPHIC_REGION_LIST: GeographicRegion[];
export declare const ASSET_CATEGORY_LIST: AssetCategory[];
export declare const ASSET_REGION_LIST: AssetRegion[];
export declare const REGION_COLORS: Record<AssetRegion, string>;
export declare const REGION_GRADIENTS: Record<AssetRegion, string>;
export declare const REGION_GRADIENT_TEXT: Record<AssetRegion, string>;
export type RegionValue = (typeof REGIONS)[keyof typeof REGIONS];
export interface TokenMetadata {
    name: string;
    region: RegionValue;
    decimals?: number;
    apy?: number | null;
    isInflationHedge?: boolean;
}
export declare const TOKEN_METADATA: Record<string, TokenMetadata>;
export declare function getTokenApy(symbol: string): number;
export declare function isTokenInflationHedge(symbol: string): boolean;
export declare function getTokenRegion(symbol: string): RegionValue;
export declare const NETWORK_TOKENS: Record<number, string[]>;
export declare function getChainAssets(chainId: number): {
    symbol: string;
    name: string;
    region: RegionValue;
}[];
export declare const EXCHANGE_RATES: Record<string, number>;
export declare const TX_CONFIG: {
    readonly DEFAULT_SLIPPAGE: 0.5;
    readonly MINIPAY_SLIPPAGE: 1;
    readonly GAS_LIMITS: {
        readonly APPROVAL: 300000;
        readonly SWAP: 800000;
        readonly FALLBACK: 400000;
    };
    readonly CONFIRMATIONS: {
        readonly MAINNET: 1;
        readonly TESTNET: 2;
        readonly ARC: 1;
    };
};
export declare const CIRCLE_CONFIG: {
    CCTP: {
        DOMAINS: {
            ETHEREUM: number;
            AVALANCHE: number;
            OPTIMISM: number;
            ARBITRUM: number;
            BASE: number;
            POLYGON: number;
        };
        TOKEN_MESSENGER: {
            ETHEREUM: string;
            ARBITRUM: string;
            BASE: string;
        };
    };
    WALLET: {
        API_BASE_URL: string;
        USER_ID_PREFIX: string;
    };
};
export declare const ABIS: {
    readonly ERC20: readonly ["function balanceOf(address owner) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function transfer(address to, uint256 amount) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)", "event Approval(address indexed owner, address indexed spender, uint256 value)"];
    readonly BROKER: {
        readonly PROVIDERS: readonly ["function getExchangeProviders() view returns (address[])"];
        readonly RATE: readonly ["function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)"];
        readonly SWAP: readonly ["function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)"];
    };
    readonly EXCHANGE: readonly ["function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])"];
};
export declare const CACHE_CONFIG: {
    readonly EXCHANGE_RATE: number;
    readonly INFLATION_DATA: number;
    readonly BALANCE: number;
    readonly SWAP_ESTIMATE: number;
};
export declare const SWAP_CONFIG: {
    readonly STRATEGY_SCORES: {
        readonly 42220: {
            readonly MentoSwapStrategy: 100;
            readonly OneInchSwapStrategy: 20;
            readonly UniswapV3Strategy: 15;
            readonly LiFiSwapStrategy: 40;
        };
        readonly 11142220: {
            readonly MentoSwapStrategy: 100;
            readonly LiFiSwapStrategy: 20;
        };
        readonly 5042002: {
            readonly CurveArcStrategy: 100;
            readonly ArcTestnetStrategy: 90;
        };
        readonly 42161: {
            readonly OneInchSwapStrategy: 90;
            readonly UniswapV3Strategy: 80;
            readonly LiFiSwapStrategy: 60;
            readonly DirectRWAStrategy: 30;
        };
    };
    readonly TOKEN_PREFERENCES: {
        readonly PAXG: {
            readonly OneInchSwapStrategy: 25;
        };
        readonly USDC: {
            readonly OneInchSwapStrategy: 15;
            readonly UniswapV3Strategy: 12;
        };
        readonly USDY: {
            readonly UniswapV3Strategy: 100;
            readonly OneInchSwapStrategy: 90;
        };
        readonly SYRUPUSDC: {
            readonly UniswapV3Strategy: 100;
            readonly OneInchSwapStrategy: 90;
        };
    };
    readonly ENABLE_PERFORMANCE_TRACKING: true;
    readonly ENABLE_AUTOMATIC_FALLBACK: true;
    readonly MAX_FALLBACK_ATTEMPTS: 3;
};
export declare const MAINNET_TOKENS: {
    readonly CELO: "0x471ece3750da237f93b8e339c536989b8978a438";
    readonly USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a";
    readonly EURm: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73";
    readonly BRLm: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787";
    readonly KESm: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
    readonly COPm: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA";
    readonly PHPm: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B";
    readonly GHSm: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313";
    readonly GBPm: "0xCCF663b1fF11028f0b19058d0f7B674004a40746";
    readonly ZARm: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6";
    readonly CADm: "0xff4Ab19391af240c311c54200a492233052B6325";
    readonly AUDm: "0x7175504C455076F15c04A2F90a8e352281F492F9";
    readonly XOFm: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08";
    readonly CHFm: "0xb55a79F398E759E43C95b979163f30eC87Ee131D";
    readonly JPYm: "0xc45eCF20f3CD864B32D9794d6f76814aE8892e20";
    readonly NGNm: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71";
    readonly G$: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
    readonly USDT: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";
};
export declare const CELO_SEPOLIA_TOKENS: {
    readonly CELO: "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9";
    readonly USDm: "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
    readonly EURm: "0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f";
    readonly BRLm: "0xe4d517785d091d3c54818832db6094bcc2744545";
    readonly XOFm: "0xB0FA15e002516d0301884059c0aaC0F0C72b019D";
    readonly KESm: "0x1E0433C1769271ECcF4CFF9FDdD515eefE6CdF92";
    readonly PHPm: "0x5E0E3c9419C42a1B04e2525991FB1A2C467AB8bF";
    readonly COPm: "0xe6A57340f0df6E020c1c0a80bC6E13048601f0d4";
    readonly GHSm: "0x295B66bE7714458Af45E6A6Ea142A5358A6cA375";
    readonly GBPm: "0x47f2Fb88105155a18c390641C8a73f1402B2BB12";
    readonly ZARm: "0x1e5b44015Ff90610b54000DAad31C89b3284df4d";
    readonly CADm: "0x02EC9E0D2Fd73e89168C1709e542a48f58d7B133";
    readonly AUDm: "0x84CBD49F5aE07632B6B88094E81Cce8236125Fe0";
    readonly NGNm: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71";
    readonly G$: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
    readonly USDT: "0xd077A400968890Eacc75cdc901F0356c943e4fDb";
};
export declare const ARBITRUM_TOKENS: {
    readonly USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    readonly PAXG: "0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429";
    readonly USDY: "0x35e050d3c0ec2d29d269a8ecea763a183bdf9a9d";
    readonly SYRUPUSDC: "0x41CA7586cC1311807B4605fBB748a3B8862b42b5";
};
export declare const ARC_TOKENS: {
    readonly USDC: "0x3600000000000000000000000000000000000000";
    readonly EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
};
export declare const RH_TESTNET_TOKENS: {
    readonly ACME: "0x4390d881751a190C9B3539b052BA1FC7a0f517dc";
    readonly SPACELY: "0xe28F0fBc0777373fd80E932072033949ef73Fa5f";
    readonly WAYNE: "0xD91C15F9017c4Caa56825487ede1A701a94cE2a4";
    readonly OSCORP: "0xeacC2abf8C05bAc6870C16bEa5c4E3db7d8EA41d";
    readonly STARK: "0x1d3264F941Dc8d9b038245987078D249Df748c8D";
    readonly WETH: "0x95fa0c32181d073FA9b07F0eC3961C845d00bE21";
};
export declare const BROKER_ADDRESSES: {
    readonly MAINNET: "0x777a8255ca72412f0d706dc03c9d1987306b4cad";
    readonly CELO_SEPOLIA: "0xD3Dff18E465bCa6241A244144765b4421Ac14D09";
    readonly ARC_TESTNET: "0x0000000000000000000000000000000000000000";
    readonly RH_TESTNET: "0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3";
};
export declare function getTokenAddresses(chainId: number): Record<string, string>;
export declare function getBrokerAddress(chainId: number): "0x777a8255ca72412f0d706dc03c9d1987306b4cad" | "0xD3Dff18E465bCa6241A244144765b4421Ac14D09" | "0x0000000000000000000000000000000000000000";
export declare function getNetworkConfig(chainId: number): {
    readonly chainId: 42220;
    readonly name: "Celo";
    readonly rpcUrl: string;
    readonly explorerUrl: "https://celo.blockscout.com";
} | {
    readonly chainId: 11142220;
    readonly name: "Celo Sepolia";
    readonly rpcUrl: "https://forno.celo-sepolia.celo-testnet.org";
    readonly explorerUrl: "https://celo-sepolia.blockscout.com";
    readonly devOnly: true;
} | {
    readonly chainId: 5042002;
    readonly name: "Arc Testnet";
    readonly rpcUrl: string;
    readonly explorerUrl: "https://testnet.arcscan.app";
    readonly devOnly: true;
} | {
    readonly chainId: 42161;
    readonly name: "Arbitrum";
    readonly rpcUrl: string;
    readonly explorerUrl: "https://arbiscan.io";
} | {
    readonly chainId: 46630;
    readonly name: "Robinhood Chain";
    readonly rpcUrl: string;
    readonly explorerUrl: "https://explorer.testnet.chain.robinhood.com";
    readonly devOnly: true;
};
/** All chain IDs that are dev/testnet-only, derived from NETWORKS config. */
export declare const TESTNET_CHAIN_IDS: readonly number[];
/** Returns true when chainId belongs to a testnet / devOnly network. */
export declare function isTestnetChain(chainId: number | null | undefined): boolean;
export { AI_FEATURES, AUTONOMOUS_FEATURES, UI_FEATURES, WALLET_FEATURES, hasAIFeatures, hasAutonomousFeatures } from './features';
//# sourceMappingURL=index.d.ts.map
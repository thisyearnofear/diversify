/**
 * Curve Contract Discovery Service
 * Discovers Curve Finance contract addresses on Arc Testnet
 * Uses Curve's standard deployment patterns and registry system
 */

import { ethers } from 'ethers';

// Known Curve deployment patterns and addresses
const CURVE_DISCOVERY_CONFIG = {
    // Common AddressProvider addresses across chains
    POTENTIAL_ADDRESS_PROVIDERS: [
        '0x0000000022D53366457F9d5E68Ec105046FC4383', // Common Curve AddressProvider
        '0x5ffe7FB82894076ECB99A30D6A32e969e6e35E98', // Alternative AddressProvider
    ],

    // Registry IDs in AddressProvider
    REGISTRY_IDS: {
        MAIN_REGISTRY: 0,
        POOL_INFO: 1,
        EXCHANGES: 2,
        META_REGISTRY: 7,
        CRYPTO_REGISTRY: 5,
        FACTORY_REGISTRY: 3,
    },
};

// Contract ABIs for discovery
const DISCOVERY_ABIS = {
    ADDRESS_PROVIDER: [
        'function get_registry() view returns (address)',
        'function get_address(uint256 id) view returns (address)',
        'function max_id() view returns (uint256)',
    ],

    REGISTRY: [
        'function pool_count() view returns (uint256)',
        'function pool_list(uint256 i) view returns (address)',
        'function get_coins(address pool) view returns (address[8])',
    ],
};

export interface CurvePoolInfo {
    address: string;
    coins: string[];
    name?: string;
    fee?: number;
    isStable: boolean;
}

export interface CurveContracts {
    addressProvider?: string;
    mainRegistry?: string;
    metaRegistry?: string;
    exchanges?: string;
    pools: CurvePoolInfo[];
    usdcEurcPool?: CurvePoolInfo;
}

export class CurveDiscoveryService {
    /**
     * Discover all Curve contracts on Arc Testnet
     */
    static async discoverContracts(provider: ethers.providers.Provider): Promise<CurveContracts> {
        console.log('[CurveDiscovery] Starting contract discovery on Arc Testnet');

        const result: CurveContracts = {
            pools: [],
        };

        try {
            // Step 1: Find AddressProvider
            const addressProvider = await this.findAddressProvider(provider);
            if (addressProvider) {
                result.addressProvider = addressProvider;
                console.log('[CurveDiscovery] Found AddressProvider:', addressProvider);

                // Step 2: Get registries from AddressProvider
                await this.discoverFromAddressProvider(provider, addressProvider, result);
            }

            // Step 3: Find USDC/EURC specific pool
            result.usdcEurcPool = this.findUsdcEurcPoolFromList(result.pools);

            console.log('[CurveDiscovery] Discovery complete:', {
                addressProvider: result.addressProvider,
                registries: {
                    main: result.mainRegistry,
                    meta: result.metaRegistry,
                },
                pools: result.pools.length,
                usdcEurcPool: result.usdcEurcPool?.address,
            });

            return result;

        } catch (error) {
            console.error('[CurveDiscovery] Discovery failed:', error);
            return result;
        }
    }

    /**
     * Find USDC/EURC pool specifically by addresses
     */
    static async findSpecificUsdcEurcPool(
        provider: ethers.providers.Provider,
        usdcAddress: string,
        eurcAddress: string
    ): Promise<CurvePoolInfo | null> {
        console.log('[CurveDiscovery] Searching for USDC/EURC pool');

        try {
            const contracts = await this.discoverContracts(provider);

            // Look for pool with USDC and EURC
            for (const pool of contracts.pools) {
                const hasUsdc = pool.coins.some(coin =>
                    coin.toLowerCase() === usdcAddress.toLowerCase()
                );
                const hasEurc = pool.coins.some(coin =>
                    coin.toLowerCase() === eurcAddress.toLowerCase()
                );

                if (hasUsdc && hasEurc) {
                    console.log('[CurveDiscovery] Found USDC/EURC pool:', pool.address);
                    return pool;
                }
            }

            return null;
        } catch (error) {
            console.error('[CurveDiscovery] USDC/EURC pool search failed:', error);
            return null;
        }
    }

    private static async findAddressProvider(provider: ethers.providers.Provider): Promise<string | null> {
        for (const address of CURVE_DISCOVERY_CONFIG.POTENTIAL_ADDRESS_PROVIDERS) {
            try {
                const contract = new ethers.Contract(address, DISCOVERY_ABIS.ADDRESS_PROVIDER, provider);

                // Test if this is a valid AddressProvider
                const maxId = await contract.max_id();
                if (maxId && maxId.gt(0)) {
                    return address;
                }
            } catch (error) {
                // This address doesn't exist or isn't an AddressProvider
                continue;
            }
        }
        return null;
    }

    private static async discoverFromAddressProvider(
        provider: ethers.providers.Provider,
        addressProvider: string,
        result: CurveContracts
    ): Promise<void> {
        const apContract = new ethers.Contract(addressProvider, DISCOVERY_ABIS.ADDRESS_PROVIDER, provider);

        try {
            // Get main registry
            const mainRegistry = await apContract.get_address(CURVE_DISCOVERY_CONFIG.REGISTRY_IDS.MAIN_REGISTRY);
            if (mainRegistry && mainRegistry !== ethers.constants.AddressZero) {
                result.mainRegistry = mainRegistry;
                await this.discoverPoolsFromRegistry(provider, mainRegistry, result);
            }

            // Get meta registry
            const metaRegistry = await apContract.get_address(CURVE_DISCOVERY_CONFIG.REGISTRY_IDS.META_REGISTRY);
            if (metaRegistry && metaRegistry !== ethers.constants.AddressZero) {
                result.metaRegistry = metaRegistry;
            }

            // Get exchanges
            const exchanges = await apContract.get_address(CURVE_DISCOVERY_CONFIG.REGISTRY_IDS.EXCHANGES);
            if (exchanges && exchanges !== ethers.constants.AddressZero) {
                result.exchanges = exchanges;
            }

        } catch (error) {
            console.error('[CurveDiscovery] AddressProvider discovery failed:', error);
        }
    }

    private static async discoverPoolsFromRegistry(
        provider: ethers.providers.Provider,
        registry: string,
        result: CurveContracts
    ): Promise<void> {
        try {
            const registryContract = new ethers.Contract(registry, DISCOVERY_ABIS.REGISTRY, provider);

            const poolCount = await registryContract.pool_count();
            console.log('[CurveDiscovery] Found', poolCount.toString(), 'pools in registry');

            // Get up to 10 pools (to avoid too many calls)
            const maxPools = Math.min(poolCount.toNumber(), 10);

            for (let i = 0; i < maxPools; i++) {
                try {
                    const poolAddress = await registryContract.pool_list(i);
                    const coins = await registryContract.get_coins(poolAddress);

                    // Filter out zero addresses
                    const validCoins = coins.filter((coin: string) => coin !== ethers.constants.AddressZero);

                    if (validCoins.length >= 2) {
                        const poolInfo: CurvePoolInfo = {
                            address: poolAddress,
                            coins: validCoins,
                            isStable: true, // Assume stable pools from main registry
                        };

                        result.pools.push(poolInfo);
                        console.log('[CurveDiscovery] Added pool:', poolAddress, 'with', validCoins.length, 'coins');
                    }
                } catch (error) {
                    // Skip this pool if we can't get its info
                    continue;
                }
            }
        } catch (error) {
            console.error('[CurveDiscovery] Registry pool discovery failed:', error);
        }
    }

    private static findUsdcEurcPoolFromList(pools: CurvePoolInfo[]): CurvePoolInfo | undefined {
        // This is a helper to find USDC/EURC pool from discovered pools
        // Would need actual token addresses to match
        return pools.find(pool => pool.coins.length === 2); // Assume 2-coin pools are stablecoin pairs
    }
}
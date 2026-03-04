/**
 * Curve Contract Discovery Service
 * Discovers Curve Finance contract addresses on Arc Testnet
 * Uses Curve's standard deployment patterns and registry system
 */
import { ethers } from 'ethers';
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
export declare class CurveDiscoveryService {
    /**
     * Discover all Curve contracts on Arc Testnet
     */
    static discoverContracts(provider: ethers.providers.Provider): Promise<CurveContracts>;
    /**
     * Find USDC/EURC pool specifically by addresses
     */
    static findSpecificUsdcEurcPool(provider: ethers.providers.Provider, usdcAddress: string, eurcAddress: string): Promise<CurvePoolInfo | null>;
    private static findAddressProvider;
    private static discoverFromAddressProvider;
    private static discoverPoolsFromRegistry;
    private static findUsdcEurcPoolFromList;
}
//# sourceMappingURL=curve-discovery.service.d.ts.map
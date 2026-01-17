/**
 * Bridge Service
 * Handles cross-chain swaps and bridging using LI.FI SDK
 * Focused on Celo -> Arbitrum wealth protection routes
 */

import { createConfig, getRoutes, executeRoute, RoutesRequest, Route, EVM } from '@lifi/sdk';
import { ethers } from 'ethers';

// Initialize LI.FI Config
createConfig({
    integrator: 'diversifi-minipay',
});

export interface BridgeQuoteRequest {
    fromChainId: number;
    fromTokenAddress: string;
    fromAmount: string; // In human readable format (e.g. "10.0")
    toChainId: number;
    toTokenAddress: string;
    userAddress: string;
    slippage?: number;
}

export class BridgeService {
    /**
     * Get the best route for a cross-chain swap
     */
    static async getBestRoute(params: BridgeQuoteRequest): Promise<Route> {
        // Handle decimals (default 18, but USDC is 6)
        const isUSDC = params.fromTokenAddress.toLowerCase() === '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

        const fromAmountWei = ethers.utils.parseUnits(
            params.fromAmount,
            isUSDC ? 6 : 18
        ).toString();

        const routesRequest: RoutesRequest = {
            fromChainId: params.fromChainId,
            fromTokenAddress: params.fromTokenAddress,
            fromAmount: fromAmountWei,
            toChainId: params.toChainId,
            toTokenAddress: params.toTokenAddress,
            fromAddress: params.userAddress,
            options: {
                slippage: params.slippage || 0.03, // 3% slippage for cross-chain
                order: 'CHEAPEST',
            },
        };

        const result = await getRoutes(routesRequest);

        if (!result.routes || result.routes.length === 0) {
            throw new Error('No bridging routes found for this pair');
        }

        return result.routes[0];
    }

    /**
     * Execute a previously retrieved route
     */
    static async executeRoute(signer: any, route: Route) {
        // In @lifi/sdk v3, we need to ensure the provider is configured for the source chain
        // We'll use the signer's provider to handle the transaction
        return executeRoute(route, {
            updateRouteHook: (updatedRoute) => {
                console.log('[BridgeService] Route Update:', updatedRoute.steps[0].execution?.status);
            }
        });
    }

    /**
     * Simplified one-click bridge execution
     */
    static async bridgeToWealth(
        signer: any,
        userAddress: string,
        fromAmount: string,
        fromToken: { address: string; chainId: number },
        toToken: { address: string; chainId: number }
    ) {
        try {
            console.log(`[BridgeService] Initiating bridge: ${fromAmount} from ${fromToken.chainId} to ${toToken.chainId}`);

            const route = await this.getBestRoute({
                fromChainId: fromToken.chainId,
                fromTokenAddress: fromToken.address,
                fromAmount: fromAmount,
                toChainId: toToken.chainId,
                toTokenAddress: toToken.address,
                userAddress: userAddress
            });

            console.log(`[BridgeService] Route found: Bridge via ${route.steps[0].tool} with expected out: ${route.toAmountMin}`);

            const result = await this.executeRoute(signer, route);
            return result;
        } catch (error) {
            console.error('[BridgeService] Bridge execution failed:', error);
            throw error;
        }
    }
}

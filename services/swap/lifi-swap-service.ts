import { getRoutes, executeRoute, RoutesRequest, Route } from '@lifi/sdk';
import { ethers } from 'ethers';

export class LifiSwapService {
    /**
     * Get a quote for a same-chain swap
     */
    static async getQuote(
        chainId: number,
        fromTokenAddress: string,
        toTokenAddress: string,
        fromAmount: string,
        userAddress: string,
        slippage: number = 0.005
    ): Promise<Route> {
        // LI.FI expects amount in decimals
        // For USDC it's 6, for most others it's 18
        // We can let LI.FI handle the decimals if we pass the string amount? 
        // No, LI.FI SDK getRoutes takes fromAmount as string in wei-equivalent
        
        // This is a bit tricky because we need to know decimals.
        // Let's assume we pass the wei-equivalent string
        
        const routesRequest: RoutesRequest = {
            fromChainId: chainId,
            fromTokenAddress: fromTokenAddress,
            fromAmount: fromAmount,
            toChainId: chainId,
            toTokenAddress: toTokenAddress,
            fromAddress: userAddress,
            options: {
                slippage: slippage,
                order: 'CHEAPEST',
            },
        };

        const result = await getRoutes(routesRequest);
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No swap routes found for this pair');
        }

        return result.routes[0];
    }

    /**
     * Execute a swap using LI.FI
     */
    static async executeSwap(route: Route): Promise<string> {
        const result = await executeRoute(route);
        // The result is an extended route object with execution details
        const txHash = result.steps?.[0]?.execution?.process?.find(p => p.type === 'SWAP' || p.type === 'CROSS_CHAIN')?.txHash 
                    || result.steps?.[0]?.execution?.process?.[0]?.txHash;
        
        if (!txHash) {
            throw new Error('Swap execution failed to return a transaction hash');
        }
        
        return txHash;
    }
}

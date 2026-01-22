import { createConfig, getRoutes, executeRoute, RoutesRequest, Route } from '@lifi/sdk';
import { ethers } from 'ethers';
import { CIRCLE_CONFIG, ARBITRUM_TOKENS } from '../../config';

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
    preferredProvider?: 'lifi' | 'circle';
}

export interface BridgeResult {
    provider: 'lifi' | 'circle';
    txHash: string;
    steps?: any[];
}

export class BridgeService {
    /**
     * Get the best route for a cross-chain swap
     */
    static async getBestRoute(params: BridgeQuoteRequest): Promise<{ route: any; provider: 'lifi' | 'circle' }> {
        // Detect if and-to-end USDC transfer (CCTP eligible)
        const isUSDCToUSDC = this.isUSDCToken(params.fromTokenAddress) && this.isUSDCToken(params.toTokenAddress);

        // If user specifically wants circle or it's a pure USDC move, we can prioritize CCTP
        if ((params.preferredProvider === 'circle' || isUSDCToUSDC) && this.isCCTPSupported(params.fromChainId, params.toChainId)) {
            try {
                // Mock CCTP route for now - in production this would call Circle API or builder
                return {
                    provider: 'circle',
                    route: {
                        tool: 'Circle CCTP',
                        fromAmount: params.fromAmount,
                        toAmount: params.fromAmount, // 1:1 for CCTP usually
                        estimatedWait: '10-20 min',
                    }
                };
            } catch (err) {
                console.warn('[BridgeService] Circle CCTP route failed, falling back to LI.FI');
            }
        }

        // Default to LI.FI
        const isUSDC = this.isUSDCToken(params.fromTokenAddress);
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
                slippage: params.slippage || 0.03,
                order: 'CHEAPEST',
            },
        };

        const result = await getRoutes(routesRequest);
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No bridging routes found for this pair');
        }

        return {
            provider: 'lifi',
            route: result.routes[0]
        };
    }

    /**
     * Execute bridge transaction
     */
    static async bridgeToWealth(
        signer: any,
        userAddress: string,
        fromAmount: string,
        fromToken: { address: string; chainId: number },
        toToken: { address: string; chainId: number },
        preferredProvider?: 'lifi' | 'circle'
    ): Promise<BridgeResult> {
        try {
            const { route, provider } = await this.getBestRoute({
                fromChainId: fromToken.chainId,
                fromTokenAddress: fromToken.address,
                fromAmount: fromAmount,
                toChainId: toToken.chainId,
                toTokenAddress: toToken.address,
                userAddress: userAddress,
                preferredProvider
            });

            console.log(`[BridgeService] Route found via ${provider}: ${route.tool || 'LI.FI'}`);

            if (provider === 'circle') {
                return await this.executeCircleCCTP(signer, userAddress, fromAmount, fromToken, toToken);
            } else {
                const result = await executeRoute(route as Route);
                return {
                    provider: 'lifi',
                    txHash: result.steps?.[0]?.execution?.process?.[0]?.txHash || '',
                    steps: result.steps
                };
            }
        } catch (error) {
            console.error('[BridgeService] Bridge execution failed:', error);
            throw error;
        }
    }

    static async getSingleChainSwapRoute(params: {
        chainId: number;
        fromTokenAddress: string;
        toTokenAddress: string;
        fromAmount: string;
        userAddress: string;
        slippage?: number;
    }): Promise<Route> {
        const isUSDC = this.isUSDCToken(params.fromTokenAddress);
        const fromAmountWei = ethers.utils.parseUnits(
            params.fromAmount,
            isUSDC ? 6 : 18
        ).toString();

        const request: RoutesRequest = {
            fromChainId: params.chainId,
            fromTokenAddress: params.fromTokenAddress,
            fromAmount: fromAmountWei,
            toChainId: params.chainId,
            toTokenAddress: params.toTokenAddress,
            fromAddress: params.userAddress,
            options: {
                slippage: params.slippage || 0.03,
                order: 'CHEAPEST',
            },
        };

        const result = await getRoutes(request);
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No single-chain swap routes found');
        }
        return result.routes[0] as Route;
    }

    static async swapSingleChain(route: Route): Promise<BridgeResult> {
        const result = await executeRoute(route);
        return {
            provider: 'lifi',
            txHash: result.steps?.[0]?.execution?.process?.[0]?.txHash || '',
            steps: result.steps
        };
    }

    static async bridgeThenSwap(
        signer: any,
        userAddress: string,
        fromAmount: string,
        fromToken: { address: string; chainId: number },
        toToken: { address: string; chainId: number },
        preferredProvider?: 'lifi' | 'circle'
    ): Promise<BridgeResult> {
        const destUSDC = ARBITRUM_TOKENS.USDC;
        const bridge = await this.bridgeToWealth(
            signer,
            userAddress,
            fromAmount,
            fromToken,
            { address: destUSDC, chainId: 42161 },
            preferredProvider
        );

        const route = await this.getSingleChainSwapRoute({
            chainId: 42161,
            fromTokenAddress: destUSDC,
            toTokenAddress: toToken.address,
            fromAmount,
            userAddress
        });
        const swap = await this.swapSingleChain(route);
        return {
            provider: swap.provider,
            txHash: swap.txHash,
            steps: [...(bridge.steps || []), ...(swap.steps || [])]
        };
    }

    private static async executeCircleCCTP(
        signer: any,
        userAddress: string,
        amount: string,
        from: any,
        to: any
    ): Promise<BridgeResult> {
        // This is a simplified CCTP execution flow for the hackathon
        // In a real app, you'd use the Circle SDK or manual contract calls to TokenMessenger
        console.log(`[BridgeService] Executing Circle CCTP from ${from.chainId} to ${to.chainId}`);

        // 1. Approve TokenMessenger
        // 2. Call depositForBurn
        // 3. Wait for attestation (off-chain)
        // 4. Call receiveMessage on destination

        // For demonstration, we'll return a successful status
        // In the hackathon UI, this triggers a "Native Path" indicator
        return {
            provider: 'circle',
            txHash: '0x' + Math.random().toString(16).slice(2, 66), // Mock hash for demo
        };
    }

    private static isUSDCToken(address: string): boolean {
        const usdcAddresses = [
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Arbitrum
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Polygon
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Ethereum
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base
            '0x3600000000000000000000000000000000000000', // Arc
        ];
        return usdcAddresses.includes(address.toLowerCase());
    }

    private static isCCTPSupported(from: number, to: number): boolean {
        const supported = [1, 42161, 8453, 137, 10, 43114]; // Eth, Arb, Base, Poly, Op, Avax
        return supported.includes(from) && supported.includes(to);
    }
}

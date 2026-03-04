"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeService = void 0;
const sdk_1 = require("@lifi/sdk");
const ethers_1 = require("ethers");
const config_1 = require("../../config");
const lifi_config_1 = require("./lifi-config");
// Initialize LI.FI Config with proper EVM provider
(0, lifi_config_1.initializeLiFiConfig)();
class BridgeService {
    /**
     * Get the best route for a cross-chain swap
     * Note: Circle CCTP support is planned but not yet implemented
     */
    static async getBestRoute(params) {
        // TODO: Implement Circle CCTP when ready
        // For now, always use LiFi for cross-chain swaps
        // Default to LI.FI
        const isUSDC = this.isUSDCToken(params.fromTokenAddress);
        const fromAmountWei = ethers_1.ethers.utils.parseUnits(params.fromAmount, isUSDC ? 6 : 18).toString();
        const routesRequest = {
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
        const result = await (0, sdk_1.getRoutes)(routesRequest);
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
    static async bridgeToWealth(signer, userAddress, fromAmount, fromToken, toToken, preferredProvider) {
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
            }
            else {
                const result = await (0, sdk_1.executeRoute)(route);
                return {
                    provider: 'lifi',
                    txHash: result.steps?.[0]?.execution?.process?.[0]?.txHash || '',
                    steps: result.steps
                };
            }
        }
        catch (error) {
            console.error('[BridgeService] Bridge execution failed:', error);
            throw error;
        }
    }
    static async getSingleChainSwapRoute(params) {
        const isUSDC = this.isUSDCToken(params.fromTokenAddress);
        const fromAmountWei = ethers_1.ethers.utils.parseUnits(params.fromAmount, isUSDC ? 6 : 18).toString();
        const request = {
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
        const result = await (0, sdk_1.getRoutes)(request);
        if (!result.routes || result.routes.length === 0) {
            throw new Error('No single-chain swap routes found');
        }
        return result.routes[0];
    }
    static async swapSingleChain(route, signer) {
        // Ensure wallet connection before execution
        await (0, lifi_config_1.ensureWalletConnection)();
        // Execute route - LiFi SDK v3 will automatically use window.ethereum
        const result = await (0, sdk_1.executeRoute)(route);
        return {
            provider: 'lifi',
            txHash: result.steps?.[0]?.execution?.process?.[0]?.txHash || '',
            steps: result.steps
        };
    }
    static async bridgeThenSwap(signer, userAddress, fromAmount, fromToken, toToken, preferredProvider) {
        const destUSDC = config_1.ARBITRUM_TOKENS.USDC;
        const bridge = await this.bridgeToWealth(signer, userAddress, fromAmount, fromToken, { address: destUSDC, chainId: 42161 }, preferredProvider);
        const route = await this.getSingleChainSwapRoute({
            chainId: 42161,
            fromTokenAddress: destUSDC,
            toTokenAddress: toToken.address,
            fromAmount,
            userAddress
        });
        const swap = await this.swapSingleChain(route, signer);
        return {
            provider: swap.provider,
            txHash: swap.txHash,
            steps: [...(bridge.steps || []), ...(swap.steps || [])]
        };
    }
    static async executeCircleCCTP(signer, userAddress, amount, from, to) {
        // TODO: Implement Circle CCTP integration
        // Steps required:
        // 1. Approve TokenMessenger contract
        // 2. Call depositForBurn on source chain
        // 3. Wait for Circle attestation (off-chain)
        // 4. Call receiveMessage on destination chain
        throw new Error('Circle CCTP integration not yet implemented. Please use LiFi for cross-chain swaps.');
    }
    static isUSDCToken(address) {
        const usdcAddresses = [
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Arbitrum
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Polygon
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Ethereum
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base
            '0x3600000000000000000000000000000000000000', // Arc
        ];
        return usdcAddresses.includes(address.toLowerCase());
    }
    static isCCTPSupported(from, to) {
        const supported = [1, 42161, 8453, 137, 10, 43114]; // Eth, Arb, Base, Poly, Op, Avax
        return supported.includes(from) && supported.includes(to);
    }
}
exports.BridgeService = BridgeService;
//# sourceMappingURL=bridge-service.js.map
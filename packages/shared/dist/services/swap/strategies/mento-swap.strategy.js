"use strict";
/**
 * Mento Swap Strategy
 * Handles same-chain swaps on Celo using Mento Protocol
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentoSwapStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const approval_1 = require("../approval");
const exchange_discovery_1 = require("../exchange-discovery");
const execution_1 = require("../execution");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
// USDm is the hub token - all Mento pairs route through it
const ROUTING_TOKEN_SYMBOL = 'USDm';
class MentoSwapStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    getName() {
        return 'MentoSwapStrategy';
    }
    supports(params) {
        // Only supports same-chain swaps on Celo networks for Mento tokens
        // G$ and other non-Mento tokens should fall through to LiFi
        if (!chain_detection_service_1.ChainDetectionService.isCelo(params.fromChainId) ||
            params.fromChainId !== params.toChainId) {
            return false;
        }
        // Check if both tokens are Mento tokens (not G$ or other non-Mento tokens)
        const nonMentoTokens = ['G$', 'USDT']; // Tokens that exist on Celo but aren't Mento
        const isFromNonMento = nonMentoTokens.includes(params.fromToken);
        const isToNonMento = nonMentoTokens.includes(params.toToken);
        // If either token is non-Mento, let LiFi handle it
        return !isFromNonMento && !isToNonMento;
    }
    async validate(params) {
        // Check if tokens exist on this chain
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }
        // Check if broker exists
        const brokerAddress = (0, config_1.getBrokerAddress)(params.fromChainId);
        if (!brokerAddress || brokerAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error('Mento broker not available on this network');
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting swap estimate', { from: params.fromToken, to: params.toToken });
        const provider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const brokerAddress = (0, config_1.getBrokerAddress)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        // Get token decimals
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 18 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
        // Find exchange
        let expectedOutput;
        const exchangeInfo = await exchange_discovery_1.ExchangeDiscoveryService.findDirectExchange(brokerAddress, fromTokenAddress, toTokenAddress, provider);
        if (exchangeInfo) {
            // Get direct quote
            expectedOutput = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, exchangeInfo, fromTokenAddress, toTokenAddress, amountIn, provider);
        }
        else {
            // No direct exchange - try route through USDm
            this.log('No direct exchange for estimate, trying USDm route');
            const routingTokenAddress = tokens[ROUTING_TOKEN_SYMBOL];
            if (!routingTokenAddress || params.fromToken === ROUTING_TOKEN_SYMBOL || params.toToken === ROUTING_TOKEN_SYMBOL) {
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
            }
            const twoStepExchange = await exchange_discovery_1.ExchangeDiscoveryService.findTwoStepExchange(brokerAddress, fromTokenAddress, toTokenAddress, routingTokenAddress, provider);
            if (!twoStepExchange) {
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken} (even via USDm)`);
            }
            // Step 1: Quote fromToken -> USDm
            const routingTokenAmountOut = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, twoStepExchange.first, fromTokenAddress, routingTokenAddress, amountIn, provider);
            // Step 2: Quote USDm -> toToken
            expectedOutput = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, twoStepExchange.second, routingTokenAddress, toTokenAddress, routingTokenAmountOut, provider);
        }
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Estimate gas (rough estimate)
        const gasCostEstimate = ethers_1.ethers.BigNumber.from(config_1.TX_CONFIG.GAS_LIMITS.SWAP)
            .mul(await provider.getGasPrice());
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: 0.1, // TODO: Calculate actual price impact
            gasCostEstimate,
        };
    }
    async execute(params, callbacks) {
        this.log('Executing Mento swap', params);
        try {
            // Validate
            await this.validate(params);
            // Get signer for transactions
            const signer = await provider_factory_service_1.ProviderFactoryService.getSignerForChain(params.fromChainId);
            // Use JsonRpcProvider for read-only calls (works with Farcaster)
            const readProvider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
            // Get configuration
            const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
            const brokerAddress = (0, config_1.getBrokerAddress)(params.fromChainId);
            const isTestnet = chain_detection_service_1.ChainDetectionService.isTestnet(params.fromChainId);
            const fromTokenAddress = tokens[params.fromToken];
            const toTokenAddress = tokens[params.toToken];
            // Get token metadata
            const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 18 };
            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            // Transaction options
            const gasPrice = await readProvider.getGasPrice();
            const txOptions = {
                useLegacyTx: true, // Celo uses legacy transactions
                gasPrice
            };
            // Step 1: Check and handle approval
            this.log('Checking token approval');
            const approvalStatus = await approval_1.ApprovalService.checkApproval(fromTokenAddress, params.userAddress, brokerAddress, amountIn, params.fromChainId, fromTokenMeta.decimals || 18);
            let approvalTxHash;
            if (!approvalStatus.isApproved) {
                this.log('Approving token');
                const approveTx = await approval_1.ApprovalService.approve(fromTokenAddress, brokerAddress, amountIn, signer, txOptions);
                approvalTxHash = approveTx.hash;
                callbacks?.onApprovalSubmitted?.(approveTx.hash);
                const confirmations = isTestnet
                    ? config_1.TX_CONFIG.CONFIRMATIONS.TESTNET
                    : config_1.TX_CONFIG.CONFIRMATIONS.MAINNET;
                await approval_1.ApprovalService.waitForApproval(approveTx, confirmations);
                callbacks?.onApprovalConfirmed?.();
                this.log('Approval confirmed');
            }
            // Step 2: Find exchange (direct or via USDm)
            this.log('Finding exchange');
            const directExchange = await exchange_discovery_1.ExchangeDiscoveryService.findDirectExchange(brokerAddress, fromTokenAddress, toTokenAddress, readProvider);
            const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
            const confirmations = isTestnet
                ? config_1.TX_CONFIG.CONFIRMATIONS.TESTNET
                : config_1.TX_CONFIG.CONFIRMATIONS.MAINNET;
            let finalTxHash;
            if (directExchange) {
                // Direct swap available
                this.log('Direct exchange found, executing single swap');
                const expectedAmountOut = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, directExchange, fromTokenAddress, toTokenAddress, amountIn, readProvider);
                const minAmountOut = this.calculateMinOutput(expectedAmountOut, slippage);
                const swapTx = await execution_1.SwapExecutionService.executeSwap(brokerAddress, directExchange, fromTokenAddress, toTokenAddress, amountIn, minAmountOut, signer, txOptions);
                callbacks?.onSwapSubmitted?.(swapTx.hash);
                this.log('Swap transaction submitted', { hash: swapTx.hash });
                await execution_1.SwapExecutionService.waitForSwap(swapTx, confirmations);
                finalTxHash = swapTx.hash;
            }
            else {
                // No direct exchange - route through USDm
                this.log('No direct exchange, routing through USDm');
                const routingTokenAddress = tokens[ROUTING_TOKEN_SYMBOL];
                if (!routingTokenAddress) {
                    throw new Error('USDm not available on this network for routing');
                }
                // Skip if one of the tokens is already USDm
                if (params.fromToken === ROUTING_TOKEN_SYMBOL || params.toToken === ROUTING_TOKEN_SYMBOL) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
                }
                const twoStepExchange = await exchange_discovery_1.ExchangeDiscoveryService.findTwoStepExchange(brokerAddress, fromTokenAddress, toTokenAddress, routingTokenAddress, readProvider);
                if (!twoStepExchange) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken} (even via USDm)`);
                }
                // Step 1: Swap fromToken -> USDm
                this.log('Step 1: Swapping to USDm');
                const routingTokenAmountOut = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, twoStepExchange.first, fromTokenAddress, routingTokenAddress, amountIn, readProvider);
                const minRoutingTokenOut = this.calculateMinOutput(routingTokenAmountOut, slippage);
                const firstSwapTx = await execution_1.SwapExecutionService.executeSwap(brokerAddress, twoStepExchange.first, fromTokenAddress, routingTokenAddress, amountIn, minRoutingTokenOut, signer, txOptions);
                this.log('First swap submitted', { hash: firstSwapTx.hash });
                await execution_1.SwapExecutionService.waitForSwap(firstSwapTx, confirmations);
                this.log('First swap confirmed');
                // Approve USDm for second swap if needed
                const routingTokenApprovalStatus = await approval_1.ApprovalService.checkApproval(routingTokenAddress, params.userAddress, brokerAddress, routingTokenAmountOut, params.fromChainId, 18);
                if (!routingTokenApprovalStatus.isApproved) {
                    this.log('Approving USDm for second swap');
                    const routingTokenApproveTx = await approval_1.ApprovalService.approve(routingTokenAddress, brokerAddress, routingTokenAmountOut, signer, txOptions);
                    await approval_1.ApprovalService.waitForApproval(routingTokenApproveTx, confirmations);
                }
                // Step 2: Swap USDm -> toToken
                this.log('Step 2: Swapping USDm to target token');
                const finalAmountOut = await exchange_discovery_1.ExchangeDiscoveryService.getQuote(brokerAddress, twoStepExchange.second, routingTokenAddress, toTokenAddress, routingTokenAmountOut, readProvider);
                const minFinalOut = this.calculateMinOutput(finalAmountOut, slippage);
                const secondSwapTx = await execution_1.SwapExecutionService.executeSwap(brokerAddress, twoStepExchange.second, routingTokenAddress, toTokenAddress, routingTokenAmountOut, minFinalOut, signer, txOptions);
                callbacks?.onSwapSubmitted?.(secondSwapTx.hash);
                this.log('Second swap submitted', { hash: secondSwapTx.hash });
                await execution_1.SwapExecutionService.waitForSwap(secondSwapTx, confirmations);
                finalTxHash = secondSwapTx.hash;
            }
            this.log('Swap confirmed');
            return {
                success: true,
                txHash: finalTxHash,
                approvalTxHash,
            };
        }
        catch (error) {
            this.logError('Swap failed', error);
            return {
                success: false,
                error: error.message || 'Swap execution failed',
            };
        }
    }
}
exports.MentoSwapStrategy = MentoSwapStrategy;
//# sourceMappingURL=mento-swap.strategy.js.map
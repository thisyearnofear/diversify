/**
 * Mento Swap Strategy
 * Handles same-chain swaps on Celo using Mento Protocol
 */

import { ethers } from 'ethers';
import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { ApprovalService } from '../approval';
import { ExchangeDiscoveryService } from '../exchange-discovery';
import { SwapExecutionService } from '../execution';
import { ProviderFactoryService } from '../provider-factory.service';
import { ChainDetectionService } from '../chain-detection.service';
import { getTokenAddresses, getBrokerAddress, TOKEN_METADATA, TX_CONFIG } from '../../../config';
import type { ExchangeInfo } from '../../../types/swap';

// USDm is the hub token - all Mento pairs route through it
const ROUTING_TOKEN_SYMBOL = 'USDm';

// Assets the Celo mainnet broker can actually exchange — verified on-chain
// via getExchangeProviders()/getExchanges(): every published exchange is a
// USDm<->regional pair, so the routable set is USDm plus the regional
// stables below. Other tokens in the Celo map (CELO, EURm, GBPm, JPYm,
// CHFm, USDT, G$) have no broker exchange and must route through DEX
// aggregators. Update this set if Mento governance registers new exchanges.
export const MENTO_BROKER_TOKENS = new Set([
    'USDm', 'BRLm', 'KESm', 'COPm', 'PHPm', 'GHSm',
    'XOFm', 'ZARm', 'CADm', 'AUDm', 'NGNm',
]);

export class MentoSwapStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'MentoSwapStrategy';
    }

    supports(params: SwapParams): boolean {
        // Same-chain Celo swaps where both tokens are broker assets.
        // Claiming anything broader wastes an approval transaction in
        // execute() before exchange discovery finds nothing.
        if (!ChainDetectionService.isCelo(params.fromChainId) ||
            params.fromChainId !== params.toChainId) {
            return false;
        }

        return MENTO_BROKER_TOKENS.has(params.fromToken) &&
            MENTO_BROKER_TOKENS.has(params.toToken);
    }

    async validate(params: SwapParams): Promise<boolean> {
        // Check if tokens exist on this chain
        const tokens = getTokenAddresses(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(
                `Token pair ${params.fromToken}/${params.toToken} not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`
            );
        }

        // Check if broker exists
        const brokerAddress = getBrokerAddress(params.fromChainId);
        if (!brokerAddress || brokerAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error('Mento broker not available on this network');
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting swap estimate', { from: params.fromToken, to: params.toToken });

        const provider = ProviderFactoryService.getProvider(params.fromChainId);
        const tokens = getTokenAddresses(params.fromChainId);
        const brokerAddress = getBrokerAddress(params.fromChainId);

        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        // Get token decimals
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        // Find exchange
        let expectedOutput: ethers.BigNumber;
        const exchangeInfo = await ExchangeDiscoveryService.findDirectExchange(
            brokerAddress,
            fromTokenAddress,
            toTokenAddress,
            provider
        );

        if (exchangeInfo) {
            // Get direct quote
            expectedOutput = await ExchangeDiscoveryService.getQuote(
                brokerAddress,
                exchangeInfo,
                fromTokenAddress,
                toTokenAddress,
                amountIn,
                provider
            );
        } else {
            // No direct exchange - try route through USDm
            this.log('No direct exchange for estimate, trying USDm route');
            const routingTokenAddress = tokens[ROUTING_TOKEN_SYMBOL as keyof typeof tokens];

            if (!routingTokenAddress || params.fromToken === ROUTING_TOKEN_SYMBOL || params.toToken === ROUTING_TOKEN_SYMBOL) {
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
            }

            const twoStepExchange = await ExchangeDiscoveryService.findTwoStepExchange(
                brokerAddress,
                fromTokenAddress,
                toTokenAddress,
                routingTokenAddress,
                provider
            );

            if (!twoStepExchange) {
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken} (even via USDm)`);
            }

            // Step 1: Quote fromToken -> USDm
            const routingTokenAmountOut = await ExchangeDiscoveryService.getQuote(
                brokerAddress,
                twoStepExchange.first,
                fromTokenAddress,
                routingTokenAddress,
                amountIn,
                provider
            );

            // Step 2: Quote USDm -> toToken
            expectedOutput = await ExchangeDiscoveryService.getQuote(
                brokerAddress,
                twoStepExchange.second,
                routingTokenAddress,
                toTokenAddress,
                routingTokenAmountOut,
                provider
            );
        }

        const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

        // Estimate gas (rough estimate)
        const gasCostEstimate = ethers.BigNumber.from(TX_CONFIG.GAS_LIMITS.SWAP)
            .mul(await provider.getGasPrice());

        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
            priceImpact: 0.1, // TODO: Calculate actual price impact
            gasCostEstimate,
        };
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing Mento swap', params);

        try {
            // Validate
            await this.validate(params);

            // Get signer for transactions
            const signer = params.signer || await ProviderFactoryService.getSignerForChain(params.fromChainId);

            // Use JsonRpcProvider for read-only calls (works with Farcaster)
            const readProvider = ProviderFactoryService.getProvider(params.fromChainId);

            // Get configuration
            const tokens = getTokenAddresses(params.fromChainId);
            const brokerAddress = getBrokerAddress(params.fromChainId);
            const isTestnet = ChainDetectionService.isTestnet(params.fromChainId);

            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
            const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

            // Transaction options
            const gasPrice = await readProvider.getGasPrice();
            const txOptions = {
                useLegacyTx: true, // Celo uses legacy transactions
                gasPrice
            };

            // Step 1: Find exchange BEFORE approving — an approval tx burns
            // gas, so it must never be submitted for a pair the broker
            // can't exchange.
            this.log('Finding exchange');
            const directExchange = await ExchangeDiscoveryService.findDirectExchange(
                brokerAddress,
                fromTokenAddress,
                toTokenAddress,
                readProvider
            );

            const routingTokenAddress = tokens[ROUTING_TOKEN_SYMBOL as keyof typeof tokens];

            let twoStepExchange: { first: ExchangeInfo; second: ExchangeInfo } | null = null;

            if (!directExchange) {
                if (!routingTokenAddress ||
                    params.fromToken === ROUTING_TOKEN_SYMBOL ||
                    params.toToken === ROUTING_TOKEN_SYMBOL) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
                }

                twoStepExchange = await ExchangeDiscoveryService.findTwoStepExchange(
                    brokerAddress,
                    fromTokenAddress,
                    toTokenAddress,
                    routingTokenAddress,
                    readProvider
                );

                if (!twoStepExchange) {
                    throw new Error(`No exchange found for ${params.fromToken}/${params.toToken} (even via USDm)`);
                }
            }

            // Step 2: Check and handle approval
            this.log('Checking token approval');
            const approvalStatus = await ApprovalService.checkApproval(
                fromTokenAddress,
                params.userAddress,
                brokerAddress,
                amountIn,
                params.fromChainId,
                fromTokenMeta.decimals || 18
            );

            let approvalTxHash: string | undefined;

            if (!approvalStatus.isApproved) {
                this.log('Approving token');
                const approveTx = await ApprovalService.approve(
                    fromTokenAddress,
                    brokerAddress,
                    amountIn,
                    signer,
                    txOptions
                );

                approvalTxHash = approveTx.hash;
                callbacks?.onApprovalSubmitted?.(approveTx.hash);

                const approvalConfirmations = isTestnet
                    ? TX_CONFIG.CONFIRMATIONS.TESTNET
                    : TX_CONFIG.CONFIRMATIONS.MAINNET;

                await ApprovalService.waitForApproval(approveTx, approvalConfirmations);
                callbacks?.onApprovalConfirmed?.();
                this.log('Approval confirmed');
            }

            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const confirmations = isTestnet
                ? TX_CONFIG.CONFIRMATIONS.TESTNET
                : TX_CONFIG.CONFIRMATIONS.MAINNET;

            let finalTxHash: string;

            if (directExchange) {
                // Direct swap available
                this.log('Direct exchange found, executing single swap');

                const expectedAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    directExchange,
                    fromTokenAddress,
                    toTokenAddress,
                    amountIn,
                    readProvider
                );

                const minAmountOut = this.calculateMinOutput(expectedAmountOut, slippage);

                const swapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    directExchange,
                    fromTokenAddress,
                    toTokenAddress,
                    amountIn,
                    minAmountOut,
                    signer,
                    txOptions
                );

                callbacks?.onSwapSubmitted?.(swapTx.hash);
                this.log('Swap transaction submitted', { hash: swapTx.hash });

                await SwapExecutionService.waitForSwap(swapTx, confirmations);
                finalTxHash = swapTx.hash;
            } else if (twoStepExchange) {
                // No direct exchange - route through USDm (twoStepExchange
                // was resolved before the approval step above)
                this.log('No direct exchange, routing through USDm');

                // Step 1: Swap fromToken -> USDm
                this.log('Step 1: Swapping to USDm');
                const routingTokenAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    twoStepExchange.first,
                    fromTokenAddress,
                    routingTokenAddress,
                    amountIn,
                    readProvider
                );

                const minRoutingTokenOut = this.calculateMinOutput(routingTokenAmountOut, slippage);

                const firstSwapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    twoStepExchange.first,
                    fromTokenAddress,
                    routingTokenAddress,
                    amountIn,
                    minRoutingTokenOut,
                    signer,
                    txOptions
                );

                this.log('First swap submitted', { hash: firstSwapTx.hash });
                await SwapExecutionService.waitForSwap(firstSwapTx, confirmations);
                this.log('First swap confirmed');

                // Approve USDm for second swap if needed
                const routingTokenApprovalStatus = await ApprovalService.checkApproval(
                    routingTokenAddress,
                    params.userAddress,
                    brokerAddress,
                    routingTokenAmountOut,
                    params.fromChainId,
                    18
                );

                if (!routingTokenApprovalStatus.isApproved) {
                    this.log('Approving USDm for second swap');
                    const routingTokenApproveTx = await ApprovalService.approve(
                        routingTokenAddress,
                        brokerAddress,
                        routingTokenAmountOut,
                        signer,
                        txOptions
                    );
                    await ApprovalService.waitForApproval(routingTokenApproveTx, confirmations);
                }

                // Step 2: Swap USDm -> toToken
                this.log('Step 2: Swapping USDm to target token');
                const finalAmountOut = await ExchangeDiscoveryService.getQuote(
                    brokerAddress,
                    twoStepExchange.second,
                    routingTokenAddress,
                    toTokenAddress,
                    routingTokenAmountOut,
                    readProvider
                );

                const minFinalOut = this.calculateMinOutput(finalAmountOut, slippage);

                const secondSwapTx = await SwapExecutionService.executeSwap(
                    brokerAddress,
                    twoStepExchange.second,
                    routingTokenAddress,
                    toTokenAddress,
                    routingTokenAmountOut,
                    minFinalOut,
                    signer,
                    txOptions
                );

                callbacks?.onSwapSubmitted?.(secondSwapTx.hash);
                this.log('Second swap submitted', { hash: secondSwapTx.hash });

                await SwapExecutionService.waitForSwap(secondSwapTx, confirmations);
                finalTxHash = secondSwapTx.hash;
            } else {
                // Unreachable — discovery above throws when neither a direct
                // nor a USDm-routed exchange exists — but keeps the compiler
                // certain that finalTxHash is assigned.
                throw new Error(`No exchange found for ${params.fromToken}/${params.toToken}`);
            }

            this.log('Swap confirmed');

            return {
                success: true,
                txHash: finalTxHash,
                approvalTxHash,
            };
        } catch (error: any) {
            this.logError('Swap failed', error);
            return {
                success: false,
                error: error.message || 'Swap execution failed',
            };
        }
    }
}

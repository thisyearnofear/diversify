/**
 * Uniswap V3 Direct Swap Strategy
 * Simple, reliable direct swaps using Uniswap V3
 * Good fallback when aggregators fail
 */

import { ethers } from 'ethers';
import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { ProviderFactoryService } from '../provider-factory.service';
import { ChainDetectionService } from '../chain-detection.service';
import { getTokenAddresses, TOKEN_METADATA, TX_CONFIG } from '../../../config';
import { ArbitrumTransactionService } from '../arbitrum-transaction.service';

// Uniswap V3 Router addresses
const UNISWAP_V3_ROUTER_ADDRESSES: Record<number, string> = {
    1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',     // Ethereum
    42161: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Arbitrum
    137: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',   // Polygon
    10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',    // Optimism
    8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
};

// Uniswap V3 Router ABI (minimal)
const UNISWAP_V3_ROUTER_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)',
];

export class UniswapV3Strategy extends BaseSwapStrategy {
    getName(): string {
        return 'UniswapV3Strategy';
    }

    supports(params: SwapParams): boolean {
        // Supports same-chain swaps on networks with Uniswap V3
        return (
            params.fromChainId === params.toChainId &&
            UNISWAP_V3_ROUTER_ADDRESSES[params.fromChainId] !== undefined
        );
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

        // Check if Uniswap V3 router exists on this chain
        const routerAddress = UNISWAP_V3_ROUTER_ADDRESSES[params.fromChainId];
        if (!routerAddress) {
            throw new Error(`Uniswap V3 not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }

        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting Uniswap V3 quote', { from: params.fromToken, to: params.toToken });

        const provider = ProviderFactoryService.getProvider(params.fromChainId);
        const tokens = getTokenAddresses(params.fromChainId);
        const routerAddress = UNISWAP_V3_ROUTER_ADDRESSES[params.fromChainId];

        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        // Get token decimals
        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        try {
            // Try multiple fee tiers for better liquidity discovery
            const feeTiers = [3000, 10000, 500]; // 0.3%, 1%, 0.05%
            let bestQuote = null;
            let bestFee = 3000;

            // Use JsonRpcProvider for read-only calls (works with Farcaster)
            const readProvider = ProviderFactoryService.getProvider(params.fromChainId);
            const router = new ethers.Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, readProvider);

            for (const fee of feeTiers) {
                try {
                    const quote = await router.callStatic.quoteExactInputSingle({
                        tokenIn: fromTokenAddress,
                        tokenOut: toTokenAddress,
                        fee,
                        amountIn: amountIn.toString(),
                        sqrtPriceLimitX96: 0,
                    });

                    if (!bestQuote || quote.gt(bestQuote)) {
                        bestQuote = quote;
                        bestFee = fee;
                    }
                } catch (error) {
                    // This fee tier doesn't have a pool, try next
                    continue;
                }
            }

            if (!bestQuote) {
                throw new Error(`No Uniswap V3 pool found for ${params.fromToken}/${params.toToken}`);
            }

            const expectedOutput = bestQuote;
            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);

            // Estimate gas (rough estimate for Uniswap V3 swap)
            const gasEstimate = ethers.BigNumber.from('200000');
            const gasPrice = await provider.getGasPrice();
            const gasCostEstimate = gasEstimate.mul(gasPrice);

            return {
                expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 18),
                minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
                priceImpact: 0.1, // Rough estimate
                gasCostEstimate,
            };
        } catch (error: any) {
            this.logError('Uniswap V3 quote failed', error);
            throw new Error(`Failed to get Uniswap V3 quote: ${error.message}`);
        }
    }

    async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
        this.log('Executing Uniswap V3 swap', params);

        try {
            // Validate
            await this.validate(params);

            // Get signer for transactions
            const signer = await ProviderFactoryService.getSignerForChain(params.fromChainId);

            // Get configuration
            const tokens = getTokenAddresses(params.fromChainId);
            const routerAddress = UNISWAP_V3_ROUTER_ADDRESSES[params.fromChainId];

            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };

            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;

            // Get quote for minimum output calculation using JsonRpcProvider (works with Farcaster)
            const readProvider = ProviderFactoryService.getProvider(params.fromChainId);
            const routerRead = new ethers.Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, readProvider);

            // Try multiple fee tiers to find the best route
            const feeTiers = [3000, 10000, 500];
            let bestQuote = null;
            let bestFee = 3000;

            for (const fee of feeTiers) {
                try {
                    const quote = await routerRead.callStatic.quoteExactInputSingle({
                        tokenIn: fromTokenAddress,
                        tokenOut: toTokenAddress,
                        fee,
                        amountIn: amountIn.toString(),
                        sqrtPriceLimitX96: 0,
                    });

                    if (!bestQuote || quote.gt(bestQuote)) {
                        bestQuote = quote;
                        bestFee = fee;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!bestQuote) {
                throw new Error(`No Uniswap V3 pool found for ${params.fromToken}/${params.toToken}`);
            }

            const expectedOutput = bestQuote;
            const minAmountOut = this.calculateMinOutput(expectedOutput, slippage);
            const fee = bestFee;

            // Check and handle approval if needed
            if (fromTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
                await this.checkAndHandleApproval(
                    fromTokenAddress,
                    routerAddress,
                    amountIn,
                    signer,
                    callbacks
                );
            }

            // Execute the swap
            this.log('Executing Uniswap V3 swap transaction');
            const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

            const swapParams = {
                tokenIn: fromTokenAddress,
                tokenOut: toTokenAddress,
                fee,
                recipient: params.userAddress,
                deadline,
                amountIn: amountIn.toString(),
                amountOutMinimum: minAmountOut.toString(),
                sqrtPriceLimitX96: 0,
            };

            let tx: ethers.ContractTransaction;
            const chainId = await signer.getChainId();

            if (ChainDetectionService.isArbitrum(chainId)) {
                // Use ArbitrumTransactionService for Arbitrum chains
                const routerWrite = new ethers.Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, signer);
                const swapCalldata = routerWrite.interface.encodeFunctionData('exactInputSingle', [swapParams]);

                tx = await ArbitrumTransactionService.executeTransaction(signer, {
                    to: routerAddress,
                    data: swapCalldata,
                    value: '0',
                    gasLimit: '300000', // Conservative gas limit for Uniswap V3 swap
                });
            } else {
                // Use regular ethers for non-Arbitrum chains (like Celo)
                const routerWrite = new ethers.Contract(routerAddress, UNISWAP_V3_ROUTER_ABI, signer);
                tx = await routerWrite.exactInputSingle(swapParams);
            }

            callbacks?.onSwapSubmitted?.(tx.hash);
            this.log('Swap transaction submitted', { hash: tx.hash });

            // Wait for confirmation
            const receipt = await tx.wait();
            this.log('Swap confirmed', { hash: tx.hash, gasUsed: receipt.gasUsed.toString() });

            return {
                success: true,
                txHash: tx.hash,
            };
        } catch (error: any) {
            this.logError('Uniswap V3 swap failed', error);
            return {
                success: false,
                error: error.message || 'Uniswap V3 swap execution failed',
            };
        }
    }

    private async checkAndHandleApproval(
        tokenAddress: string,
        spenderAddress: string,
        amount: ethers.BigNumber,
        signer: ethers.Signer,
        callbacks?: SwapCallbacks
    ): Promise<void> {
        const chainId = await signer.getChainId();
        const userAddress = await signer.getAddress();

        // Use ArbitrumTransactionService for Arbitrum chains, regular ethers for others
        if (ChainDetectionService.isArbitrum(chainId)) {
            const currentAllowance = await ArbitrumTransactionService.checkAllowance(
                tokenAddress,
                userAddress,
                spenderAddress,
                signer
            );

            if (currentAllowance.gte(amount)) {
                return; // Sufficient allowance
            }

            // Need approval using Arbitrum service
            this.log('Approving token spend for Uniswap V3 (Arbitrum)');
            const approveTx = await ArbitrumTransactionService.executeApproval(
                tokenAddress,
                spenderAddress,
                amount,
                signer
            );
            callbacks?.onApprovalSubmitted?.(approveTx.hash);

            await approveTx.wait();
            callbacks?.onApprovalConfirmed?.();
            this.log('Approval confirmed');
        } else {
            // Use regular ethers for non-Arbitrum chains (like Celo)
            // Use JsonRpcProvider for read-only allowance check (works with Farcaster)
            const readProvider = ProviderFactoryService.getProvider(chainId);
            const tokenContractRead = new ethers.Contract(
                tokenAddress,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                readProvider
            );

            const currentAllowance = await tokenContractRead.allowance(userAddress, spenderAddress);

            if (currentAllowance.gte(amount)) {
                return; // Sufficient allowance
            }

            // Need approval - use signer for transaction
            this.log('Approving token spend for Uniswap V3');
            const tokenContractWrite = new ethers.Contract(
                tokenAddress,
                ['function approve(address spender, uint256 amount) returns (bool)'],
                signer
            );
            const approveTx = await tokenContractWrite.approve(spenderAddress, amount);
            callbacks?.onApprovalSubmitted?.(approveTx.hash);

            await approveTx.wait();
            callbacks?.onApprovalConfirmed?.();
            this.log('Approval confirmed');
        }
    }
}
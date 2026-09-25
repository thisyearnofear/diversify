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

type RouterKind = 'swapRouter02' | 'swapRouter';

interface UniswapChainConfig {
    router: string;
    quoter: string;
    routerKind: RouterKind;
}

// Uniswap V3 deployments the app can actually route. Celo has only
// SwapRouter02 (no deadline field); Arbitrum routes through the original
// SwapRouter. Verified on-chain 2026 — other chains are intentionally
// absent: supports() refuses them rather than routing to dead addresses.
const UNISWAP_V3_CHAINS: Record<number, UniswapChainConfig> = {
    42220: {
        router: '0x5615CDAb10dc425a742d643d949a7F474C01abc4', // SwapRouter02
        quoter: '0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8', // QuoterV2
        routerKind: 'swapRouter02',
    },
    42161: {
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // SwapRouter
        quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // QuoterV2
        routerKind: 'swapRouter',
    },
};

const EXACT_INPUT_SINGLE_ABI: Record<RouterKind, string[]> = {
    swapRouter02: [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    ],
    swapRouter: [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    ],
};

// QuoterV2 — lives on its own contract, never on the router.
const QUOTER_V2_ABI = [
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const FEE_TIERS = [100, 500, 3000, 10000];

// Reject quotes whose per-unit price collapses at size — a thin pool
// technically routes but burns the user (e.g. large CELO→KESm direct).
export const MAX_PRICE_IMPACT_BPS = 300;

interface BestQuote {
    amountOut: ethers.BigNumber;
    fee: number;
    impactBps: number;
}

export class UniswapV3Strategy extends BaseSwapStrategy {
    getName(): string {
        return 'UniswapV3Strategy';
    }

    supports(params: SwapParams): boolean {
        // Supports same-chain swaps on networks with Uniswap V3 that the
        // app actually configures (token map + RPC + verified deployment).
        return (
            params.fromChainId === params.toChainId &&
            ChainDetectionService.isSupported(params.fromChainId) &&
            UNISWAP_V3_CHAINS[params.fromChainId] !== undefined
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

        if (!UNISWAP_V3_CHAINS[params.fromChainId]) {
            throw new Error(`Uniswap V3 not available on ${ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }

        return true;
    }

    /**
     * Quote every fee tier on QuoterV2 and return the best, with a
     * price-impact guard: re-quote 1/1000th of the input and compare the
     * per-unit output. A pool that routes but moves the price more than
     * MAX_PRICE_IMPACT_BPS is treated as unroutable.
     */
    private async findBestQuote(
        fromToken: string,
        toToken: string,
        tokenIn: string,
        tokenOut: string,
        amountIn: ethers.BigNumber,
        chainId: number
    ): Promise<BestQuote> {
        const { quoter: quoterAddress } = UNISWAP_V3_CHAINS[chainId];
        const readProvider = ProviderFactoryService.getProvider(chainId);
        const quoter = new ethers.Contract(quoterAddress, QUOTER_V2_ABI, readProvider);

        let best: BestQuote | null = null;

        for (const fee of FEE_TIERS) {
            try {
                const quote = await quoter.callStatic.quoteExactInputSingle({
                    tokenIn,
                    tokenOut,
                    amountIn: amountIn.toString(),
                    fee,
                    sqrtPriceLimitX96: 0,
                });
                const amountOut: ethers.BigNumber = quote.amountOut ?? quote[0];

                if (!best || amountOut.gt(best.amountOut)) {
                    best = { amountOut, fee, impactBps: 0 };
                }
            } catch {
                // No pool at this fee tier — try the next.
                continue;
            }
        }

        if (!best) {
            throw new Error(`No Uniswap V3 pool found for ${fromToken}/${toToken}`);
        }

        // Price-impact guard: reference quote at 1/1000th the size. Skip the
        // guard entirely when the reference is dust or its quote reverts.
        const refIn = amountIn.div(1000);
        if (!refIn.isZero()) {
            try {
                const refQuote = await quoter.callStatic.quoteExactInputSingle({
                    tokenIn,
                    tokenOut,
                    amountIn: refIn.toString(),
                    fee: best.fee,
                    sqrtPriceLimitX96: 0,
                });
                const refOut: ethers.BigNumber = refQuote.amountOut ?? refQuote[0];

                if (!refOut.isZero()) {
                    // impactBps = 10000 - (amountOut * refIn * 10000) / (refOut * amountIn)
                    const ratioBps = best.amountOut.mul(refIn).mul(10000).div(refOut.mul(amountIn));
                    const impact = ethers.BigNumber.from(10000).sub(ratioBps);
                    best.impactBps = impact.isNegative() ? 0 : impact.toNumber();
                }
            } catch {
                // Reference quote failed — can't measure, let the quote stand.
            }
        }

        if (best.impactBps > MAX_PRICE_IMPACT_BPS) {
            throw new Error(
                `Not enough liquidity for ${fromToken}/${toToken} on Uniswap V3 at this size (price impact ${best.impactBps / 100}%)`
            );
        }

        return best;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        this.log('Getting Uniswap V3 quote', { from: params.fromToken, to: params.toToken });

        const provider = ProviderFactoryService.getProvider(params.fromChainId);
        const tokens = getTokenAddresses(params.fromChainId);

        const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
        const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

        const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };
        const toTokenMeta = TOKEN_METADATA[params.toToken] || { decimals: 18 };

        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);

        try {
            const best = await this.findBestQuote(
                params.fromToken,
                params.toToken,
                fromTokenAddress,
                toTokenAddress,
                amountIn,
                params.fromChainId
            );

            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;
            const minimumOutput = this.calculateMinOutput(best.amountOut, slippage);

            // Estimate gas (rough estimate for Uniswap V3 swap)
            const gasEstimate = ethers.BigNumber.from('200000');
            const gasPrice = await provider.getGasPrice();
            const gasCostEstimate = gasEstimate.mul(gasPrice);

            return {
                expectedOutput: this.formatAmount(best.amountOut, toTokenMeta.decimals || 18),
                minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 18),
                priceImpact: best.impactBps / 100,
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

            const { router: routerAddress, routerKind } = UNISWAP_V3_CHAINS[params.fromChainId];

            // Get signer for transactions
            const signer = params.signer || await ProviderFactoryService.getSignerForChain(params.fromChainId);

            // Get configuration
            const tokens = getTokenAddresses(params.fromChainId);

            const fromTokenAddress = tokens[params.fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[params.toToken as keyof typeof tokens];

            // Get token metadata
            const fromTokenMeta = TOKEN_METADATA[params.fromToken] || { decimals: 18 };

            const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 18);
            const slippage = params.slippageTolerance || TX_CONFIG.DEFAULT_SLIPPAGE;

            const best = await this.findBestQuote(
                params.fromToken,
                params.toToken,
                fromTokenAddress,
                toTokenAddress,
                amountIn,
                params.fromChainId
            );
            const minAmountOut = this.calculateMinOutput(best.amountOut, slippage);

            // Check and handle approval if needed (CELO is an ERC-20 on Celo)
            if (fromTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
                await this.checkAndHandleApproval(
                    fromTokenAddress,
                    routerAddress,
                    amountIn,
                    signer,
                    callbacks
                );
            }

            // Execute the swap — SwapRouter02 (Celo) drops the deadline field.
            this.log('Executing Uniswap V3 swap transaction');
            const swapParams =
                routerKind === 'swapRouter02'
                    ? {
                          tokenIn: fromTokenAddress,
                          tokenOut: toTokenAddress,
                          fee: best.fee,
                          recipient: params.userAddress,
                          amountIn: amountIn.toString(),
                          amountOutMinimum: minAmountOut.toString(),
                          sqrtPriceLimitX96: 0,
                      }
                    : {
                          tokenIn: fromTokenAddress,
                          tokenOut: toTokenAddress,
                          fee: best.fee,
                          recipient: params.userAddress,
                          deadline: Math.floor(Date.now() / 1000) + 1200, // 20 minutes
                          amountIn: amountIn.toString(),
                          amountOutMinimum: minAmountOut.toString(),
                          sqrtPriceLimitX96: 0,
                      };

            const routerAbi = EXACT_INPUT_SINGLE_ABI[routerKind];

            let tx: ethers.ContractTransaction;
            const chainId = await signer.getChainId();

            if (ChainDetectionService.isArbitrum(chainId)) {
                // Use ArbitrumTransactionService for Arbitrum chains
                const routerWrite = new ethers.Contract(routerAddress, routerAbi, signer);
                const swapCalldata = routerWrite.interface.encodeFunctionData('exactInputSingle', [swapParams]);

                tx = await ArbitrumTransactionService.executeTransaction(signer, {
                    to: routerAddress,
                    data: swapCalldata,
                    value: '0',
                    gasLimit: '300000', // Conservative gas limit for Uniswap V3 swap
                });
            } else {
                // Use regular ethers for non-Arbitrum chains (like Celo)
                const routerWrite = new ethers.Contract(routerAddress, routerAbi, signer);
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

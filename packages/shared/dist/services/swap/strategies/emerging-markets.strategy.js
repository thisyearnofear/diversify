"use strict";
/**
 * Emerging Markets Swap Strategy
 * Handles CELO↔fictional company token swaps on Celo Sepolia
 * Mirrors the Robinhood AMM strategy but for emerging markets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergingMarketsStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const emerging_markets_1 = require("../../../config/emerging-markets");
const AMM_ABI = [
    'function quoteSwapETH(uint256 ethAmountIn, address tokenOut) view returns (uint256)',
    'function quoteSwapTokenForETH(uint256 amountIn, address tokenIn) view returns (uint256)',
    'function swapExactETHForTokens(uint256 amountOutMin, address tokenOut, address to, uint256 deadline) payable returns (uint256)',
    'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address tokenIn, address to, uint256 deadline) returns (uint256)',
    'function getReserves(address tokenA, address tokenB) view returns (uint256, uint256)',
];
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];
class EmergingMarketsStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    AMM_ADDRESS = emerging_markets_1.EMERGING_MARKETS_CONFIG.ammAddress;
    WETH_ADDRESS = emerging_markets_1.EMERGING_MARKETS_CONFIG.wethAddress;
    getName() {
        return 'EmergingMarketsStrategy';
    }
    /**
     * Check if this strategy supports the swap
     */
    supports(params) {
        // Must be on Celo Sepolia
        if (params.fromChainId !== emerging_markets_1.EMERGING_MARKETS_CONFIG.chainId) {
            return false;
        }
        // Must be same-chain
        if (params.fromChainId !== params.toChainId) {
            return false;
        }
        // One token must be CELO (wrapped)
        const isFromCELO = params.fromToken === 'CELO' || params.fromToken === 'WETH';
        const isToCELO = params.toToken === 'CELO' || params.toToken === 'WETH';
        // Other token must be a tradeable fictional company
        const isFromCompany = (0, emerging_markets_1.isTradeableCompany)(params.fromToken);
        const isToCompany = (0, emerging_markets_1.isTradeableCompany)(params.toToken);
        return (isFromCELO && isToCompany) || (isFromCompany && isToCELO);
    }
    /**
     * Validate swap parameters
     */
    async validate(params) {
        const companySymbol = params.fromToken === 'CELO' || params.fromToken === 'WETH'
            ? params.toToken
            : params.fromToken;
        const tokenAddress = (0, emerging_markets_1.getTradingTokenAddress)(companySymbol);
        if (!tokenAddress) {
            throw new Error(`Company ${companySymbol} is not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }
        // Validate company has pool liquidity
        try {
            const provider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
            const amm = new ethers_1.ethers.Contract(this.AMM_ADDRESS, AMM_ABI, provider);
            const [reserveCELO, reserveToken] = await amm.getReserves(this.WETH_ADDRESS, tokenAddress);
            if (reserveCELO.isZero() || reserveToken.isZero()) {
                throw new Error(`No liquidity available for ${companySymbol}. The pool may need to be seeded.`);
            }
        }
        catch (error) {
            if (error.message.includes('No liquidity'))
                throw error;
            // If getReserves fails, the pool might not exist yet
            console.warn(`[EmergingMarketsStrategy] Could not verify liquidity for ${companySymbol}`);
        }
        return true;
    }
    /**
     * Get swap estimate
     */
    async getEstimate(params) {
        this.log('Getting emerging markets swap estimate', {
            from: params.fromToken,
            to: params.toToken,
            amount: params.amount
        });
        const provider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
        const amm = new ethers_1.ethers.Contract(this.AMM_ADDRESS, AMM_ABI, provider);
        const isFromCELO = params.fromToken === 'CELO' || params.fromToken === 'WETH';
        const companySymbol = isFromCELO ? params.toToken : params.fromToken;
        const company = (0, emerging_markets_1.getFictionalCompany)(companySymbol);
        if (!company) {
            throw new Error(`Company ${companySymbol} not found`);
        }
        // Get decimals - use 18 as default for company tokens
        const fromDecimals = isFromCELO ? 18 : 18;
        const toDecimals = 18;
        const amountIn = this.parseAmount(params.amount, fromDecimals);
        let expectedOutput;
        try {
            if (isFromCELO) {
                // Buying company tokens with CELO
                expectedOutput = await amm.quoteSwapETH(amountIn, company.tokenAddress);
            }
            else {
                // Selling company tokens for CELO
                expectedOutput = await amm.quoteSwapTokenForETH(amountIn, company.tokenAddress);
            }
        }
        catch (error) {
            throw new Error(`Failed to get quote: ${error.message}`);
        }
        // Calculate price impact from reserves
        let priceImpact = 0;
        try {
            const [reserveCELO, reserveToken] = await amm.getReserves(this.WETH_ADDRESS, company.tokenAddress);
            const relevantReserve = isFromCELO ? reserveCELO : reserveToken;
            if (!relevantReserve.isZero()) {
                // Price impact = (amountIn / reserve) * 100
                priceImpact = parseFloat(amountIn.mul(10000).div(relevantReserve).toString()) / 100;
            }
        }
        catch {
            // If we can't get reserves, use a default estimate
            priceImpact = 0.5;
        }
        const slippage = params.slippageTolerance || 1;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Estimate gas - slightly higher than Robinhood for safety
        const gasCostEstimate = ethers_1.ethers.BigNumber.from('350000');
        return {
            expectedOutput: this.formatAmount(expectedOutput, toDecimals),
            minimumOutput: this.formatAmount(minimumOutput, toDecimals),
            priceImpact: Math.min(priceImpact, 50), // Cap at 50%
            gasCostEstimate,
        };
    }
    /**
     * Execute the swap
     */
    async execute(params, callbacks) {
        this.log('Executing emerging markets swap', params);
        try {
            await this.validate(params);
            const signer = await provider_factory_service_1.ProviderFactoryService.getSigner();
            const userAddress = await signer.getAddress();
            const amm = new ethers_1.ethers.Contract(this.AMM_ADDRESS, AMM_ABI, signer);
            const isFromCELO = params.fromToken === 'CELO' || params.fromToken === 'WETH';
            const companySymbol = isFromCELO ? params.toToken : params.fromToken;
            const company = (0, emerging_markets_1.getFictionalCompany)(companySymbol);
            if (!company) {
                throw new Error(`Company ${companySymbol} not found`);
            }
            const amountIn = this.parseAmount(params.amount, 18);
            const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
            const slippage = params.slippageTolerance || 1;
            let approvalTxHash;
            if (isFromCELO) {
                // Buy company tokens with CELO
                this.log(`Buying ${companySymbol} with CELO`, { amount: params.amount });
                // Get quote for minimum output
                const quote = await amm.quoteSwapETH(amountIn, company.tokenAddress);
                const minOut = this.calculateMinOutput(quote, slippage);
                const tx = await amm.swapExactETHForTokens(minOut, company.tokenAddress, userAddress, deadline, { value: amountIn });
                callbacks?.onSwapSubmitted?.(tx.hash);
                const receipt = await tx.wait();
                return {
                    success: true,
                    txHash: tx.hash,
                    approvalTxHash,
                };
            }
            else {
                // Sell company tokens for CELO
                this.log(`Selling ${companySymbol} for CELO`, { amount: params.amount });
                const tokenContract = new ethers_1.ethers.Contract(company.tokenAddress, ERC20_ABI, signer);
                // Check and handle approval
                const allowance = await tokenContract.allowance(userAddress, this.AMM_ADDRESS);
                if (allowance.lt(amountIn)) {
                    this.log('Approving token spend', { company: companySymbol });
                    const approveTx = await tokenContract.approve(this.AMM_ADDRESS, ethers_1.ethers.constants.MaxUint256);
                    approvalTxHash = approveTx.hash;
                    callbacks?.onApprovalSubmitted?.(approveTx.hash);
                    await approveTx.wait();
                    callbacks?.onApprovalConfirmed?.();
                }
                // Get quote for minimum output
                const quote = await amm.quoteSwapTokenForETH(amountIn, company.tokenAddress);
                const minOut = this.calculateMinOutput(quote, slippage);
                const tx = await amm.swapExactTokensForETH(amountIn, minOut, company.tokenAddress, userAddress, deadline);
                callbacks?.onSwapSubmitted?.(tx.hash);
                await tx.wait();
                return {
                    success: true,
                    txHash: tx.hash,
                    approvalTxHash,
                };
            }
        }
        catch (error) {
            this.log('Swap failed', { error: error.message });
            return {
                success: false,
                error: this.getUserFriendlyError(error.message),
            };
        }
    }
    /**
     * Convert error to user-friendly message
     */
    getUserFriendlyError(errorMessage) {
        if (errorMessage.includes('insufficient funds')) {
            return 'Insufficient CELO balance for this transaction. Get testnet CELO from the faucet.';
        }
        if (errorMessage.includes('No liquidity')) {
            return 'This trading pair has no liquidity yet. Please try again later.';
        }
        if (errorMessage.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            return 'Price moved too much. Try again with higher slippage tolerance.';
        }
        if (errorMessage.includes('user rejected')) {
            return 'Transaction was cancelled.';
        }
        return errorMessage || 'Swap failed. Please try again.';
    }
}
exports.EmergingMarketsStrategy = EmergingMarketsStrategy;
//# sourceMappingURL=emerging-markets.strategy.js.map
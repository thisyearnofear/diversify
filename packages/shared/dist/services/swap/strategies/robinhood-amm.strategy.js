"use strict";
/**
 * Robinhood AMM Swap Strategy
 * Handles ETH↔stock token swaps on Robinhood Chain testnet via TestnetMarketMaker AMM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobinhoodAMMStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
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
];
const AMM_ADDRESS = '0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3';
const WETH_ADDRESS = '0x95fa0c32181d073FA9b07F0eC3961C845d00bE21';
const RH_STOCKS = ['ACME', 'SPACELY', 'WAYNE', 'OSCORP', 'STARK'];
class RobinhoodAMMStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    getName() {
        return 'RobinhoodAMMStrategy';
    }
    supports(params) {
        // Only in development mode
        const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
        if (!isDev)
            return false;
        // Must be same-chain on RH testnet
        if (params.fromChainId !== config_1.NETWORKS.RH_TESTNET.chainId || params.fromChainId !== params.toChainId) {
            return false;
        }
        // One token must be ETH and the other must be a stock
        const isFromETH = params.fromToken === 'ETH';
        const isToETH = params.toToken === 'ETH';
        const isFromStock = RH_STOCKS.includes(params.fromToken);
        const isToStock = RH_STOCKS.includes(params.toToken);
        return (isFromETH && isToStock) || (isFromStock && isToETH);
    }
    async validate(params) {
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const stockSymbol = params.fromToken === 'ETH' ? params.toToken : params.fromToken;
        const stockAddress = tokens[stockSymbol];
        if (!stockAddress) {
            throw new Error(`Token ${stockSymbol} not available on ${chain_detection_service_1.ChainDetectionService.getNetworkName(params.fromChainId)}`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting RH AMM swap estimate', { from: params.fromToken, to: params.toToken });
        const provider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
        const amm = new ethers_1.ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const isFromETH = params.fromToken === 'ETH';
        const stockSymbol = isFromETH ? params.toToken : params.fromToken;
        const stockAddress = tokens[stockSymbol];
        const fromDecimals = (config_1.TOKEN_METADATA[params.fromToken]?.decimals) || 18;
        const toDecimals = (config_1.TOKEN_METADATA[params.toToken]?.decimals) || 18;
        const amountIn = this.parseAmount(params.amount, fromDecimals);
        let expectedOutput;
        if (isFromETH) {
            expectedOutput = await amm.quoteSwapETH(amountIn, stockAddress);
        }
        else {
            expectedOutput = await amm.quoteSwapTokenForETH(amountIn, stockAddress);
        }
        // Calculate price impact from reserves
        let priceImpact = 0;
        try {
            const [reserveA, reserveB] = await amm.getReserves(WETH_ADDRESS, stockAddress);
            const relevantReserve = isFromETH ? reserveA : reserveB;
            if (!relevantReserve.isZero()) {
                priceImpact = parseFloat(amountIn.mul(10000).div(relevantReserve).toString()) / 100;
            }
        }
        catch {
            priceImpact = 0.1;
        }
        const slippage = params.slippageTolerance || 1;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        const gasCostEstimate = ethers_1.ethers.BigNumber.from('300000');
        return {
            expectedOutput: this.formatAmount(expectedOutput, toDecimals),
            minimumOutput: this.formatAmount(minimumOutput, toDecimals),
            priceImpact,
            gasCostEstimate,
        };
    }
    async execute(params, callbacks) {
        this.log('Executing RH AMM swap', params);
        try {
            await this.validate(params);
            const signer = await provider_factory_service_1.ProviderFactoryService.getSigner();
            const userAddress = await signer.getAddress();
            const amm = new ethers_1.ethers.Contract(AMM_ADDRESS, AMM_ABI, signer);
            const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
            const isFromETH = params.fromToken === 'ETH';
            const stockSymbol = isFromETH ? params.toToken : params.fromToken;
            const stockAddress = tokens[stockSymbol];
            const fromDecimals = (config_1.TOKEN_METADATA[params.fromToken]?.decimals) || 18;
            const amountIn = this.parseAmount(params.amount, fromDecimals);
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const slippage = params.slippageTolerance || 1;
            let approvalTxHash;
            if (isFromETH) {
                // Buy stock with ETH
                const quote = await amm.quoteSwapETH(amountIn, stockAddress);
                const minOut = this.calculateMinOutput(quote, slippage);
                const tx = await amm.swapExactETHForTokens(minOut, stockAddress, userAddress, deadline, { value: amountIn });
                callbacks?.onSwapSubmitted?.(tx.hash);
                this.log('Swap transaction submitted', { hash: tx.hash });
                await tx.wait();
                this.log('Swap confirmed');
                return { success: true, txHash: tx.hash };
            }
            else {
                // Sell stock for ETH
                const erc20 = new ethers_1.ethers.Contract(stockAddress, ERC20_ABI, signer);
                const allowance = await erc20.allowance(userAddress, AMM_ADDRESS);
                if (allowance.lt(amountIn)) {
                    this.log('Approving token spend');
                    const approvalTx = await erc20.approve(AMM_ADDRESS, ethers_1.ethers.constants.MaxUint256);
                    approvalTxHash = approvalTx.hash;
                    callbacks?.onApprovalSubmitted?.(approvalTx.hash);
                    await approvalTx.wait();
                    callbacks?.onApprovalConfirmed?.();
                    this.log('Approval confirmed');
                }
                const quote = await amm.quoteSwapTokenForETH(amountIn, stockAddress);
                const minOut = this.calculateMinOutput(quote, slippage);
                const tx = await amm.swapExactTokensForETH(amountIn, minOut, stockAddress, userAddress, deadline);
                callbacks?.onSwapSubmitted?.(tx.hash);
                this.log('Swap transaction submitted', { hash: tx.hash });
                await tx.wait();
                this.log('Swap confirmed');
                return { success: true, txHash: tx.hash, approvalTxHash };
            }
        }
        catch (error) {
            this.logError('Swap failed', error);
            return {
                success: false,
                error: error.message || 'RH AMM swap execution failed',
            };
        }
    }
}
exports.RobinhoodAMMStrategy = RobinhoodAMMStrategy;
//# sourceMappingURL=robinhood-amm.strategy.js.map
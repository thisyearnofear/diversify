"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeAgent = void 0;
const ethers_1 = require("ethers");
const market_pulse_service_1 = require("../utils/market-pulse-service");
const config_1 = require("../config");
const RH_CHAIN_ID = config_1.NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = config_1.BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = config_1.RH_TESTNET_TOKENS.WETH;
const AMM_ABI = [
    "function quoteSwapETH(uint256 ethAmountIn, address tokenOut) view returns (uint256)",
    "function quoteSwapTokenForETH(uint256 tokenAmountIn, address tokenIn) view returns (uint256)",
    "function swapExactETHForTokens(uint256 amountOutMin, address tokenOut, address to, uint256 deadline) payable returns (uint256)",
    "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address tokenIn, address to, uint256 deadline) returns (uint256)",
    "function getReserves(address tokenA, address tokenB) view returns (uint256, uint256)",
];
const ERC20_ABI = [
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
];
class TradeAgent {
    provider;
    wallet;
    amm;
    tradeSizeETH;
    maxDailyTrades;
    positions = new Map();
    tradesToday = 0;
    lastReset = Date.now();
    constructor(config) {
        this.provider = new ethers_1.providers.JsonRpcProvider(config.rpcUrl || config_1.NETWORKS.RH_TESTNET.rpcUrl);
        if (config.privateKey) {
            this.wallet = new ethers_1.ethers.Wallet(config.privateKey, this.provider);
        }
        else {
            throw new Error("Private key required for TradeAgent");
        }
        this.amm = new ethers_1.Contract(AMM_ADDRESS, AMM_ABI, this.wallet);
        this.tradeSizeETH = config.tradeSizeETH || 0.01;
        this.maxDailyTrades = config.maxDailyTrades || 10;
    }
    resetDailyLimits() {
        const now = Date.now();
        if (now - this.lastReset > 24 * 60 * 60 * 1000) {
            this.tradesToday = 0;
            this.lastReset = now;
        }
    }
    getTokenAddress(stock) {
        const addr = config_1.RH_TESTNET_TOKENS[stock];
        if (!addr) {
            throw new Error(`Unknown stock: ${stock}`);
        }
        return addr;
    }
    async getReserves(stock) {
        const tokenAddr = this.getTokenAddress(stock);
        const [rETH, rStock] = await this.amm.getReserves(WETH_ADDRESS, tokenAddr);
        return {
            eth: parseFloat(ethers_1.ethers.utils.formatEther(rETH)),
            stock: parseFloat(ethers_1.ethers.utils.formatEther(rStock)),
        };
    }
    async calculatePriceImpact(stock, ethAmount) {
        const reserves = await this.getReserves(stock);
        if (reserves.eth === 0)
            return 0;
        return (ethAmount / reserves.eth) * 100;
    }
    async executeTrade(trigger) {
        this.resetDailyLimits();
        if (this.tradesToday >= this.maxDailyTrades) {
            return {
                success: false,
                stock: trigger.stock,
                action: trigger.signal,
                amountETH: this.tradeSizeETH,
                error: "Daily trade limit reached",
            };
        }
        if (trigger.signal === "HOLD") {
            return {
                success: true,
                stock: trigger.stock,
                action: "BUY",
                amountETH: 0,
            };
        }
        try {
            const tokenAddr = this.getTokenAddress(trigger.stock);
            const amountIn = ethers_1.ethers.utils.parseEther(this.tradeSizeETH.toString());
            const deadline = Math.floor(Date.now() / 1000) + 300;
            const slippage = 0.5;
            let tx;
            if (trigger.signal === "BUY") {
                const quote = await this.amm.quoteSwapETH(amountIn, tokenAddr);
                const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
                tx = await this.amm.swapExactETHForTokens(minOut, tokenAddr, this.wallet.address, deadline, { value: amountIn });
            }
            else {
                const token = new ethers_1.Contract(tokenAddr, ERC20_ABI, this.wallet);
                const balance = await token.balanceOf(this.wallet.address);
                if (balance.lt(amountIn)) {
                    const amountToSwap = balance.mul(8).div(10);
                    const quote = await this.amm.quoteSwapTokenForETH(amountToSwap, tokenAddr);
                    const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
                    const allowance = await token.allowance(this.wallet.address, AMM_ADDRESS);
                    if (allowance.lt(amountToSwap)) {
                        await token.approve(AMM_ADDRESS, ethers_1.ethers.constants.MaxUint256);
                    }
                    tx = await this.amm.swapExactTokensForETH(amountToSwap, minOut, tokenAddr, this.wallet.address, deadline);
                }
                else {
                    const quote = await this.amm.quoteSwapTokenForETH(amountIn, tokenAddr);
                    const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
                    tx = await this.amm.swapExactTokensForETH(amountIn, minOut, tokenAddr, this.wallet.address, deadline);
                }
            }
            const receipt = await tx.wait();
            this.tradesToday++;
            const position = this.positions.get(trigger.stock) || {
                stock: trigger.stock,
                totalBought: 0,
                totalSold: 0,
                netPosition: 0,
                lastTrade: Date.now(),
            };
            if (trigger.signal === "BUY") {
                position.totalBought += this.tradeSizeETH;
                position.netPosition += this.tradeSizeETH;
            }
            else {
                position.totalSold += this.tradeSizeETH;
                position.netPosition -= this.tradeSizeETH;
            }
            position.lastTrade = Date.now();
            this.positions.set(trigger.stock, position);
            return {
                success: true,
                stock: trigger.stock,
                action: trigger.signal,
                amountETH: this.tradeSizeETH,
                txHash: receipt.transactionHash,
                priceImpact: await this.calculatePriceImpact(trigger.stock, this.tradeSizeETH),
            };
        }
        catch (error) {
            return {
                success: false,
                stock: trigger.stock,
                action: trigger.signal,
                amountETH: this.tradeSizeETH,
                error: error.message || "Trade failed",
            };
        }
    }
    async processMarketSignals() {
        const pulse = await market_pulse_service_1.marketPulseService.getMarketPulse();
        const triggers = market_pulse_service_1.marketPulseService.generateTriggers(pulse);
        const strongSignals = triggers.filter(t => t.strength >= 0.3);
        const results = [];
        for (const trigger of strongSignals) {
            const result = await this.executeTrade(trigger);
            results.push(result);
            if (result.success) {
                console.log(`[TradeAgent] Executed ${trigger.signal} ${trigger.stock}: ${result.txHash}`);
            }
            else {
                console.warn(`[TradeAgent] Failed ${trigger.signal} ${trigger.stock}: ${result.error}`);
            }
        }
        return results;
    }
    getPosition(stock) {
        return this.positions.get(stock);
    }
    getAllPositions() {
        return Array.from(this.positions.values());
    }
    getTradesRemaining() {
        this.resetDailyLimits();
        return this.maxDailyTrades - this.tradesToday;
    }
    getWalletAddress() {
        return this.wallet.address;
    }
}
exports.TradeAgent = TradeAgent;
//# sourceMappingURL=trade-agent.js.map
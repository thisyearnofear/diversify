import { ethers, providers, Contract } from "ethers";
import { marketPulseService, type StockTrigger } from "../utils/market-pulse-service";
import { NETWORKS, RH_TESTNET_TOKENS, BROKER_ADDRESSES } from "../config";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

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

export interface TradeAgentConfig {
  privateKey?: string;
  rpcUrl?: string;
  tradeSizeETH?: number;
  maxDailyTrades?: number;
}

export interface TradeResult {
  success: boolean;
  stock: string;
  action: "BUY" | "SELL" | "HOLD";
  amountETH: number;
  txHash?: string;
  priceImpact?: number;
  error?: string;
}

export interface AgentPosition {
  stock: string;
  totalBought: number;
  totalSold: number;
  netPosition: number;
  lastTrade: number;
}

export class TradeAgent {
  private provider: providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private amm: Contract;
  private tradeSizeETH: number;
  private maxDailyTrades: number;
  private positions: Map<string, AgentPosition> = new Map();
  private tradesToday: number = 0;
  private lastReset: number = Date.now();

  constructor(config: TradeAgentConfig) {
    this.provider = new providers.JsonRpcProvider(config.rpcUrl || NETWORKS.RH_TESTNET.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    } else {
      throw new Error("Private key required for TradeAgent");
    }

    this.amm = new Contract(AMM_ADDRESS, AMM_ABI, this.wallet);
    this.tradeSizeETH = config.tradeSizeETH || 0.01;
    this.maxDailyTrades = config.maxDailyTrades || 10;
  }

  private resetDailyLimits(): void {
    const now = Date.now();
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.tradesToday = 0;
      this.lastReset = now;
    }
  }

  private getTokenAddress(stock: string): string {
    const addr = RH_TESTNET_TOKENS[stock as keyof typeof RH_TESTNET_TOKENS];
    if (!addr) {
      throw new Error(`Unknown stock: ${stock}`);
    }
    return addr;
  }

  async getReserves(stock: string): Promise<{ eth: number; stock: number }> {
    const tokenAddr = this.getTokenAddress(stock);
    const [rETH, rStock] = await this.amm.getReserves(WETH_ADDRESS, tokenAddr);
    return {
      eth: parseFloat(ethers.utils.formatEther(rETH)),
      stock: parseFloat(ethers.utils.formatEther(rStock)),
    };
  }

  async calculatePriceImpact(stock: string, ethAmount: number): Promise<number> {
    const reserves = await this.getReserves(stock);
    if (reserves.eth === 0) return 0;
    return (ethAmount / reserves.eth) * 100;
  }

  async executeTrade(trigger: StockTrigger): Promise<TradeResult> {
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
      const amountIn = ethers.utils.parseEther(this.tradeSizeETH.toString());
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const slippage = 0.5;

      let tx;
      if (trigger.signal === "BUY") {
        const quote = await this.amm.quoteSwapETH(amountIn, tokenAddr);
        const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
        
        tx = await this.amm.swapExactETHForTokens(
          minOut,
          tokenAddr,
          this.wallet.address,
          deadline,
          { value: amountIn }
        );
      } else {
        const token = new Contract(tokenAddr, ERC20_ABI, this.wallet);
        const balance = await token.balanceOf(this.wallet.address);
        
        if (balance.lt(amountIn)) {
          const amountToSwap = balance.mul(8).div(10);
          const quote = await this.amm.quoteSwapTokenForETH(amountToSwap, tokenAddr);
          const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
          
          const allowance = await token.allowance(this.wallet.address, AMM_ADDRESS);
          if (allowance.lt(amountToSwap)) {
            await token.approve(AMM_ADDRESS, ethers.constants.MaxUint256);
          }
          
          tx = await this.amm.swapExactTokensForETH(
            amountToSwap,
            minOut,
            tokenAddr,
            this.wallet.address,
            deadline
          );
        } else {
          const quote = await this.amm.quoteSwapTokenForETH(amountIn, tokenAddr);
          const minOut = quote.mul(1000 - Math.floor(slippage * 10)).div(1000);
          
          tx = await this.amm.swapExactTokensForETH(
            amountIn,
            minOut,
            tokenAddr,
            this.wallet.address,
            deadline
          );
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
      } else {
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
    } catch (error: any) {
      return {
        success: false,
        stock: trigger.stock,
        action: trigger.signal,
        amountETH: this.tradeSizeETH,
        error: error.message || "Trade failed",
      };
    }
  }

  async processMarketSignals(): Promise<TradeResult[]> {
    const pulse = await marketPulseService.getMarketPulse();
    const triggers = marketPulseService.generateTriggers(pulse);

    const strongSignals = triggers.filter(t => t.strength >= 0.3);
    const results: TradeResult[] = [];

    for (const trigger of strongSignals) {
      const result = await this.executeTrade(trigger);
      results.push(result);
      
      if (result.success) {
        console.log(`[TradeAgent] Executed ${trigger.signal} ${trigger.stock}: ${result.txHash}`);
      } else {
        console.warn(`[TradeAgent] Failed ${trigger.signal} ${trigger.stock}: ${result.error}`);
      }
    }

    return results;
  }

  getPosition(stock: string): AgentPosition | undefined {
    return this.positions.get(stock);
  }

  getAllPositions(): AgentPosition[] {
    return Array.from(this.positions.values());
  }

  getTradesRemaining(): number {
    this.resetDailyLimits();
    return this.maxDailyTrades - this.tradesToday;
  }

  getWalletAddress(): string {
    return this.wallet.address;
  }
}

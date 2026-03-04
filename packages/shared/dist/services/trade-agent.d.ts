import { type StockTrigger } from "../utils/market-pulse-service";
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
export declare class TradeAgent {
    private provider;
    private wallet;
    private amm;
    private tradeSizeETH;
    private maxDailyTrades;
    private positions;
    private tradesToday;
    private lastReset;
    constructor(config: TradeAgentConfig);
    private resetDailyLimits;
    private getTokenAddress;
    getReserves(stock: string): Promise<{
        eth: number;
        stock: number;
    }>;
    calculatePriceImpact(stock: string, ethAmount: number): Promise<number>;
    executeTrade(trigger: StockTrigger): Promise<TradeResult>;
    processMarketSignals(): Promise<TradeResult[]>;
    getPosition(stock: string): AgentPosition | undefined;
    getAllPositions(): AgentPosition[];
    getTradesRemaining(): number;
    getWalletAddress(): string;
}
//# sourceMappingURL=trade-agent.d.ts.map
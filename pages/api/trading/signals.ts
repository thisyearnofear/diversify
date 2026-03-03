import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService, type StockTrigger } from '../../../utils/market-pulse-service';

export interface TradeSignalResponse {
  success: boolean;
  signals: {
    stock: string;
    signal: string;
    strength: number;
    reason: string;
    source: string;
  }[];
  executed?: {
    stock: string;
    action: string;
    success: boolean;
    txHash?: string;
    error?: string;
  }[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeSignalResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, signals: [], error: 'Method not allowed' });
  }

  try {
    const { dryRun } = req.query;
    const execute = dryRun !== 'true';

    const pulse = await marketPulseService.getMarketPulse();
    const triggers = marketPulseService.generateTriggers(pulse);
    
    const strongSignals = triggers.filter(t => t.strength >= 0.3);

    const response: TradeSignalResponse = {
      success: true,
      signals: strongSignals.map(t => ({
        stock: t.stock,
        signal: t.signal,
        strength: t.strength,
        reason: t.reason,
        source: t.source,
      })),
    };

    if (!execute) {
      return res.status(200).json(response);
    }

    const privateKey = process.env.TRADE_AGENT_PRIVATE_KEY;
    
    if (!privateKey) {
      return res.status(200).json({
        ...response,
        executed: [],
        error: 'TRADE_AGENT_PRIVATE_KEY not configured - running in dry-run mode',
      });
    }

    const { TradeAgent } = await import('../../../services/trade-agent');
    const agent = new TradeAgent({
      privateKey,
      rpcUrl: process.env.RH_RPC_URL || 'https://rpc.testnet.chain.robinhood.com',
      tradeSizeETH: parseFloat(process.env.TRADE_SIZE_ETH || '0.01'),
      maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '10'),
    });

    const executed = [];
    
    for (const trigger of strongSignals) {
      try {
        const result = await agent.executeTrade(trigger);
        executed.push({
          stock: result.stock,
          action: result.action,
          success: result.success,
          txHash: result.txHash,
          error: result.error,
        });
      } catch (err: any) {
        executed.push({
          stock: trigger.stock,
          action: trigger.signal,
          success: false,
          error: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      signals: response.signals,
      executed,
    });
  } catch (error: any) {
    console.error('[Trade Signals API] Error:', error);
    res.status(500).json({
      success: false,
      signals: [],
      error: error.message || 'Failed to generate trade signals',
    });
  }
}

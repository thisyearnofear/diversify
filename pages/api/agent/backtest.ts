/**
 * Backtest API - Runs Robinhood testnet simulations via ArcAgent
 * 
 * POST /api/agent/backtest - Run backtest scenarios
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ArcAgent } from '@diversifi/shared';

interface BacktestScenario {
  fromToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
  toToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
  amount: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scenarios } = req.body as { scenarios: BacktestScenario[] };

    if (!scenarios || !Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({ error: 'Invalid scenarios' });
    }

    // Create a server-side agent for backtesting (proxy mode, no wallet needed)
    const agent = new ArcAgent({
      privateKey: process.env.BACKTEST_AGENT_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001',
      isTestnet: true,
      spendingLimit: 0, // No real spending for backtests
    });
    agent.isProxy = true; // Mark as proxy to skip on-chain operations

    // Run the backtest sequence
    const result = await agent.runBacktestSequence(scenarios);

    return res.status(200).json({
      success: true,
      totalSimulations: result.totalSimulations,
      successful: result.successful,
      results: result.results.map(r => ({
        scenario: r.scenario,
        success: r.result.success,
        estimate: r.result.estimate,
        simulationId: r.result.simulationId,
        error: r.result.error,
      })),
    });

  } catch (error) {
    console.error('[Backtest API] Error:', error);
    return res.status(500).json({ 
      error: 'Backtest failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

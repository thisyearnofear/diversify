/**
 * useBacktest - Robinhood testnet backtest simulation hook
 * 
 * Core Principles:
 * - DRY: Centralized backtest logic
 * - MODULAR: Works with ArcAgent's simulateRobinhoodSwap
 * - RESILIENT: Handles errors gracefully
 */

import { useCallback } from 'react';
import { useStreakRewards } from './use-streak-rewards';
import { useBacktestContext } from '@/context/app/BacktestContext';

export interface BacktestScenario {
  fromToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
  toToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
  amount: string;
}

export interface BacktestResult {
  scenario: BacktestScenario;
  success: boolean;
  expectedOutput?: string;
  priceImpact?: number;
  simulationId?: string;
  error?: string;
}

export interface BacktestHookState {
  isRunning: boolean;
  results: BacktestResult[];
  totalSimulations: number;
  successfulSimulations: number;
  totalAlpha: number;
  error: string | null;
}

export interface BacktestActions {
  runBacktest: (scenarios: BacktestScenario[]) => Promise<void>;
  clearResults: () => void;
}

// Default scenarios for quick testing
export const DEFAULT_SCENARIOS: BacktestScenario[] = [
  { fromToken: 'ETH', toToken: 'ACME', amount: '1.0' },
  { fromToken: 'ACME', toToken: 'ETH', amount: '100' },
  { fromToken: 'ETH', toToken: 'SPACELY', amount: '0.5' },
];

export function useBacktest(): BacktestHookState & BacktestActions {
  const { recordActivity } = useStreakRewards();
  const ctx = useBacktestContext();
  
  // Local error state (context doesn't track errors)
  let error: string | null = null;

  const runBacktest = useCallback(async (scenarios: BacktestScenario[]) => {
    ctx.setBacktestState({ isRunning: true });
    error = null;

    try {
      // Call the backtest API endpoint
      const response = await fetch('/api/agent/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios }),
      });

      if (!response.ok) {
        throw new Error('Backtest API request failed');
      }

      const data = await response.json();
      
      // Calculate total alpha from successful simulations
      let totalAlpha = 0;
      const results: BacktestResult[] = data.results.map((r: any) => {
        // Estimate alpha as percentage gain/loss
        if (r.success && r.estimate) {
          const inputAmount = parseFloat(r.scenario.amount);
          const outputAmount = parseFloat(r.estimate.expectedOutput);
          // Simple alpha calculation (would be more sophisticated in production)
          const alpha = ((outputAmount - inputAmount) / inputAmount) * 100;
          totalAlpha += alpha;
        }
        
        return {
          scenario: r.scenario,
          success: r.success,
          expectedOutput: r.result?.estimate?.expectedOutput,
          priceImpact: r.result?.estimate?.priceImpact,
          simulationId: r.result?.simulationId,
          error: r.error,
        };
      });

      const successfulSimulations = results.filter(r => r.success).length;

      // Update context with results
      ctx.setBacktestState({
        isRunning: false,
        results,
        totalSimulations: scenarios.length,
        successfulSimulations,
        totalAlpha,
        lastRunAt: Date.now(),
      });

      // Record simulation activity for streak rewards
      if (successfulSimulations > 0) {
        await recordActivity({
          action: 'simulation',
          chainId: 20240324, // Robinhood testnet chain ID
          networkType: 'testnet',
          usdValue: Math.abs(totalAlpha),
        });
      }

    } catch (err) {
      console.error('[Backtest] Error:', err);
      error = err instanceof Error ? err.message : 'Backtest failed';
      ctx.setBacktestState({ isRunning: false });
    }
  }, [ctx, recordActivity]);

  const clearResults = useCallback(() => {
    error = null;
    ctx.clearResults();
  }, [ctx]);

  return {
    isRunning: ctx.isRunning,
    results: ctx.results as BacktestResult[],
    totalSimulations: ctx.totalSimulations,
    successfulSimulations: ctx.successfulSimulations,
    totalAlpha: ctx.totalAlpha,
    error,
    runBacktest,
    clearResults,
  };
}

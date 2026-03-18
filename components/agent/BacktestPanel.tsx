/**
 * BacktestPanel - UI for running Robinhood testnet simulations
 * 
 * Core Principles:
 * - MINIMAL: Only essential UI, no bloat
 * - MODULAR: Uses useBacktest hook
 * - INTEGRATED: Records to streak rewards
 */

import React, { useState } from 'react';
import { useBacktest, DEFAULT_SCENARIOS, type BacktestScenario } from '../../hooks/use-backtest';

const TOKEN_OPTIONS = ['ETH', 'ACME', 'SPACELY', 'WAYNE', 'OSCORP', 'STARK'] as const;

export function BacktestPanel() {
  const { isRunning, results, totalSimulations, successfulSimulations, totalAlpha, error, runBacktest, clearResults } = useBacktest();
  const [customScenarios, setCustomScenarios] = useState<BacktestScenario[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  const handleRunDefault = () => {
    runBacktest(DEFAULT_SCENARIOS);
  };

  const handleRunCustom = () => {
    if (customScenarios.length > 0) {
      runBacktest(customScenarios);
    }
  };

  const addCustomScenario = () => {
    setCustomScenarios(prev => [...prev, { fromToken: 'ETH', toToken: 'ACME', amount: '1.0' }]);
  };

  const updateScenario = (index: number, field: keyof BacktestScenario, value: string) => {
    setCustomScenarios(prev => prev.map((s, i) => 
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const removeScenario = (index: number) => {
    setCustomScenarios(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔬</span>
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">
            Backtest Lab
          </h3>
        </div>
        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
          Robinhood Testnet
        </span>
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Simulations</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {successfulSimulations}/{totalSimulations} passed
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Total Alpha</span>
            <span className={`font-bold ${totalAlpha >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalAlpha >= 0 ? '+' : ''}{totalAlpha.toFixed(2)}%
            </span>
          </div>
          <button
            onClick={clearResults}
            className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1"
          >
            Clear Results
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Custom Scenarios */}
      {showCustom && (
        <div className="space-y-2">
          {customScenarios.map((scenario, index) => (
            <div key={index} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
              <select
                value={scenario.fromToken}
                onChange={(e) => updateScenario(index, 'fromToken', e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
              >
                {TOKEN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-gray-400">→</span>
              <select
                value={scenario.toToken}
                onChange={(e) => updateScenario(index, 'toToken', e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
              >
                {TOKEN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                value={scenario.amount}
                onChange={(e) => updateScenario(index, 'amount', e.target.value)}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 w-16"
                placeholder="Amount"
              />
              <button
                onClick={() => removeScenario(index)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addCustomScenario}
            className="w-full text-xs text-blue-500 hover:text-blue-600 py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
          >
            + Add Scenario
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRunDefault}
          disabled={isRunning}
          className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-1">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </span>
          ) : (
            '🚀 Run Quick Test'
          )}
        </button>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="py-2 px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {showCustom ? 'Hide' : 'Custom'}
        </button>
      </div>

      {showCustom && customScenarios.length > 0 && (
        <button
          onClick={handleRunCustom}
          disabled={isRunning}
          className="w-full py-2 px-3 bg-emerald-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 hover:bg-emerald-600 transition-colors"
        >
          Run Custom Scenarios
        </button>
      )}

      {/* Achievement Hint */}
      <p className="text-xs text-gray-400 text-center">
        Run 5 simulations to unlock <span className="text-purple-500 font-medium">Simulation Master</span> achievement!
      </p>
    </div>
  );
}

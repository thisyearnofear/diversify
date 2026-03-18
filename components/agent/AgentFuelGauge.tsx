import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutonomousStatus } from '../../hooks/agent-types';
import { useToast } from '../ui/Toast';

interface AgentFuelGaugeProps {
  status: AutonomousStatus | null | undefined;
}

/**
 * AgentFuelGauge - Visualizes the user's dedicated Agent Wallet (MPC)
 * 
 * Part of the 2026 "Agent Fuel" architecture.
 * - Shows real-time USDC balance in the agent-specific vault.
 * - Provides "Top Up" capability.
 * - Transparently displays the agent's on-chain address.
 */
const AgentFuelGauge: React.FC<AgentFuelGaugeProps> = ({ status }) => {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  if (!status || status.walletType !== 'agent-fuel') {
    return null;
  }

  const balance = parseFloat(status.balance || '0');
  const spent = status.spent || 0;
  const remaining = status.remaining || 0;
  const totalLimit = status.spendingLimit || 0;
  
  // Fuel level logic (how much USDC is left for nanopayments)
  // We assume a "full tank" is the daily limit or a fixed threshold like $10
  const fuelCapacity = Math.max(totalLimit, 10);
  const fuelPercentage = Math.min((balance / fuelCapacity) * 100, 100);
  
  const fuelColor = 
    fuelPercentage > 50 ? 'bg-emerald-500' :
    fuelPercentage > 20 ? 'bg-amber-500' :
    'bg-red-500';

  const handleCopyAddress = () => {
    if (status.address) {
      navigator.clipboard.writeText(status.address);
      setIsCopying(true);
      showToast('Agent address copied to clipboard', 'info');
      setTimeout(() => setIsCopying(false), 2000);
    }
  };

  const handleTopUp = () => {
    showToast('Initiating Agent Fuel top-up. Send USDC to your Agent address.', 'ai');
    // In a real flow, this would trigger a swap or onramp directly to the agent address
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-inner">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <span className="text-lg">⛽</span>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest leading-none">
              Agent Fuel
            </h4>
            <div className="text-lg font-black text-gray-900 dark:text-white mt-1">
              ${balance.toFixed(2)} <span className="text-[10px] text-gray-400 font-bold uppercase">USDC</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleTopUp}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
        >
          Top Up
        </button>
      </div>

      {/* Fuel Tank Visualizer */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[10px] font-bold text-gray-500">
          <span>TANK LEVEL</span>
          <span>{fuelPercentage.toFixed(0)}%</span>
        </div>
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-600/50 p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${fuelPercentage}%` }}
            className={`h-full rounded-full ${fuelColor} shadow-inner`}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium text-gray-400 italic">
          <span>Empty</span>
          <span>Full (${fuelCapacity})</span>
        </div>
      </div>

      {/* Daily Quota Progress */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50 dark:border-gray-700">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Spent Today</div>
          <div className="text-xs font-black text-gray-700 dark:text-gray-200">
            ${spent.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Quota Left</div>
          <div className="text-xs font-black text-blue-600 dark:text-blue-400">
            ${remaining.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Agent Identity */}
      <div className="mt-4 p-2.5 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Your Agent ID (MPC)</span>
            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[140px]">
              {status.address || 'Pending...'}
            </span>
          </div>
          <button 
            onClick={handleCopyAddress}
            className={`p-1.5 rounded-lg transition-colors ${isCopying ? 'bg-green-100 text-green-600' : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-blue-600 border border-gray-200 dark:border-gray-700'}`}
          >
            {isCopying ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold text-blue-600/70 uppercase tracking-widest">
            Arc L1 Native USDC Gas Active
        </span>
      </div>
    </div>
  );
};

export default AgentFuelGauge;

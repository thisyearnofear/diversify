import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AutonomousStatus } from '../../hooks/agent-types';
import { useToast } from '../ui/Toast';
import { useHyperliquid } from '../../hooks/use-hyperliquid';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { NETWORKS } from '../../config';

/**
 * Minimal QR Code Generator (SVG-based, no external dependency)
 * Generates a simple QR-like pattern for display purposes
 */
function generateQRPattern(address: string, size: number = 120): string {
  // Simple visual hash - creates a deterministic pattern from address
  const hash = address.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, 0);
  
  const moduleSize = 5;
  const modules = Math.floor(size / moduleSize);
  const positions: string[] = [];
  
  // Create deterministic pattern based on address hash
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      const idx = row * modules + col;
      const isActive = ((hash * (idx + 1)) % 7) < 3;
      
      // Corner markers (like real QR codes)
      const isCorner = (row < 2 && col < 2) || (row < 2 && col >= modules - 2) || (row >= modules - 2 && col < 2);
      
      if (isActive || isCorner) {
        positions.push(
          `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="currentColor"/>`
        );
      }
    }
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" class="text-gray-800 dark:text-white">${positions.join('')}</svg>`;
}

interface AgentFuelGaugeProps {
  status: AutonomousStatus | null | undefined;
}

/**
 * AgentFuelGauge - Visualizes the user's dedicated Guardian Wallet (MPC)
 * 
 * Part of the Guardian execution wallet architecture.
 * - Shows real-time USDC balance in the agent-specific vault.
 * - Provides "Top Up" capability with guided deposit flow.
 * - Transparently displays the agent's on-chain address.
 * - NEW: Displays 'Invisible Insurance' status (Hyperliquid Hedges).
 */
const AgentFuelGauge: React.FC<AgentFuelGaugeProps> = ({ status }) => {
  const { showToast } = useToast();
  const { recordActivity } = useStreakRewards();
  const [isCopying, setIsCopying] = useState(false);
  const [showDepositGuide, setShowDepositGuide] = useState(false);
  
  // Connect to the Hyperliquid Spoke status
  const { accountStatus } = useHyperliquid({ 
    address: status?.address,
    autoRefresh: true 
  });

  // Generate QR code for address
  const qrSvg = useMemo(() => {
    return status?.address ? generateQRPattern(status.address, 100) : '';
  }, [status?.address]);

  if (!status || status.walletType !== 'agent-fuel') {
    return null;
  }

  const balance = parseFloat(status.balance || '0');
  const spent = status.spent || 0;
  const remaining = status.remaining || 0;
  const totalLimit = status.spendingLimit || 0;
  
  const isHedgeActive = accountStatus?.hasPositions ?? false;
  const hedgeValue = accountStatus?.totalPositionValue ?? 0;
  
  // Wallet level logic (how much USDC is left for Guardian execution)
  // We assume a full wallet is the daily limit or a fixed threshold like $10.
  const fuelCapacity = Math.max(totalLimit, 10);
  const fuelPercentage = Math.min((balance / fuelCapacity) * 100, 100);
  
  const fuelColor = 
    fuelPercentage > 50 ? 'bg-emerald-500' :
    fuelPercentage > 20 ? 'bg-amber-500' :
    'bg-red-500';

  const handleCopyAddress = async () => {
    if (status.address) {
      navigator.clipboard.writeText(status.address);
      setIsCopying(true);
      showToast('Guardian wallet address copied', 'info');
      
      // Record activity for gamification
      await recordActivity({
        action: 'swap',
        chainId: NETWORKS.CELO_MAINNET.chainId,
        networkType: 'testnet',
        usdValue: 0,
      });
      
      setTimeout(() => setIsCopying(false), 2000);
    }
  };

  const handleTopUp = () => {
    const newState = !showDepositGuide;
    setShowDepositGuide(newState);
    
    // Record deposit guide open for engagement tracking
    if (newState) {
      recordActivity({
        action: 'swap',
        chainId: 42220,
        networkType: 'testnet',
        usdValue: 0,
      });
    }
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
              Guardian Wallet
            </h4>
            <div className="text-lg font-black text-gray-900 dark:text-white mt-1">
              ${balance.toFixed(2)} <span className="text-[10px] text-gray-400 font-bold uppercase">USDC</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleTopUp}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${showDepositGuide ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
        >
          {showDepositGuide ? 'Close' : 'Add Funds'}
        </button>
      </div>

      {/* Deposit Guide Panel */}
      <AnimatePresence>
        {showDepositGuide && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <h5 className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest mb-3">
                💳 Add Funds Guide
              </h5>
              
              {/* Prominent Address Display with QR */}
              <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-3">
                  {/* QR Code */}
                  {qrSvg && (
                    <div 
                      className="flex-shrink-0 w-[60px] h-[60px] rounded-lg bg-gray-100 dark:bg-gray-700 p-1"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                      Send USDC to this wallet:
                    </div>
                    <code className="text-[11px] font-mono text-gray-800 dark:text-gray-200 break-all">
                      {status.address || 'Pending...'}
                    </code>
                    <button
                      onClick={handleCopyAddress}
                      className={`mt-2 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${isCopying ? 'bg-green-100 text-green-600 dark:bg-green-900/40' : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40'}`}
                    >
                      {isCopying ? '✓ Copied' : 'Copy Address'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Steps */}
              <div className="space-y-2 text-[10px] text-blue-600 dark:text-blue-400">
                <div className="flex items-start gap-2">
                  <span className="font-black text-blue-500">1.</span>
                  <span>Copy the address above</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-blue-500">2.</span>
                  <span>Send USDC (Celo or Arc L1) to this address</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-black text-blue-500">3.</span>
                  <span>Your Guardian Wallet updates automatically</span>
                </div>
              </div>

              {/* Minimum Deposit Note */}
              <div className="mt-3 pt-2 border-t border-blue-200/50 dark:border-blue-700/50">
                <div className="flex items-center gap-1 text-[9px] text-blue-500/70 dark:text-blue-400/70">
                  <span>💡</span>
                  <span>Minimum recommended: $5 USDC • execution gas is auto-sponsored</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guardian wallet level */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[10px] font-bold text-gray-500">
          <span>BALANCE LEVEL</span>
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

      {/* Protection Hedge Status */}
      <AnimatePresence>
        {isHedgeActive && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping absolute" />
                  <div className="w-2 h-2 rounded-full bg-purple-600 relative" />
                </div>
                <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">
                  Protection Hedge Active
                </span>
              </div>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-purple-900/40 px-2 py-0.5 rounded-full shadow-sm">
                ${hedgeValue.toFixed(2)} Protected
              </span>
            </div>
            <p className="text-[9px] text-purple-600/70 dark:text-purple-400/70 mt-1 italic font-medium">
              A protective hedge is helping stabilize your portfolio value in the background.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Protection Wallet Address */}
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">Your Protection Wallet</span>
            <span className="text-[11px] font-mono text-gray-600 dark:text-gray-300 truncate max-w-[130px]">
              {status.address || 'Pending...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={handleCopyAddress}
              className={`p-2 rounded-lg transition-all ${isCopying ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700'}`}
              title="Copy address"
            >
              {isCopying ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold text-blue-600/70 uppercase tracking-widest">
            Automatic protection funding is active
        </span>
      </div>
    </div>
  );
};

export default AgentFuelGauge;

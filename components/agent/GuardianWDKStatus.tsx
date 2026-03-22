/**
 * GuardianWDKStatus - Inline Tether WDK agent status for the Guardian tier card.
 * Part of the "Hackathon Galactica: WDK Edition 1" augmentation.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuardianWDKStatusProps {
  agentStatus: 'online' | 'offline' | 'uninitialized' | 'loading';
  agentIdentity: {
    agent_id: string;
    name: string;
    version: string;
    chains: string[];
  } | null;
  recentReceipts: Array<{
    id: string;
    timestamp: number;
    action: string;
    asset: string;
    amount: string;
    status: 'success' | 'error' | 'pending';
    txHash?: string;
  }>;
  isExecuting: boolean;
  onTriggerHeartbeat: () => void;
}

const statusIndicator: Record<GuardianWDKStatusProps['agentStatus'], { color: string; label: string }> = {
  online: { color: 'bg-green-500', label: 'Online' },
  offline: { color: 'bg-red-500', label: 'Offline' },
  uninitialized: { color: 'bg-gray-400', label: 'Uninitialized' },
  loading: { color: 'bg-amber-500', label: 'Connecting' },
};

const receiptIcon: Record<string, string> = {
  success: '✅',
  error: '❌',
  pending: '🔄',
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

const GuardianWDKStatus: React.FC<GuardianWDKStatusProps> = ({
  agentStatus,
  agentIdentity,
  recentReceipts,
  isExecuting,
  onTriggerHeartbeat,
}) => {
  const { color, label } = statusIndicator[agentStatus];
  const displayName = agentIdentity?.name ?? 'Tether WDK Agent';
  const visibleReceipts = recentReceipts.slice(0, 3);

  return (
    <div className="bg-green-50/60 dark:bg-green-900/20 rounded-xl p-3 space-y-2 border border-green-100 dark:border-green-800/50">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0">🌌</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </span>
            {agentIdentity && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {agentIdentity.chains.join(', ')}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <span className="relative flex h-2 w-2">
              {agentStatus === 'online' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </span>
        </div>
      </div>

      {/* Recent WDK Actions */}
      {visibleReceipts.length > 0 && (
        <>
          <div className="border-t border-green-200 dark:border-green-800" />
          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              WDK Receipts
            </span>
            <AnimatePresence initial={false}>
              {visibleReceipts.map((receipt) => (
                <motion.div
                  key={receipt.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  <span className="flex-shrink-0">{receiptIcon[receipt.status] ?? '•'}</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {receipt.action} {receipt.amount} {receipt.asset}
                  </span>
                  {receipt.txHash && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">·</span>
                      <span className="text-blue-500 font-mono flex-shrink-0">
                        {truncateHash(receipt.txHash)}
                      </span>
                    </>
                  )}
                  <span className="text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
                    {formatTimeAgo(receipt.timestamp)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Trigger Heartbeat / WDK Ping */}
      <div className="border-t border-green-200 dark:border-green-800 pt-2">
        <button
          onClick={onTriggerHeartbeat}
          disabled={isExecuting || agentStatus === 'offline'}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >
          {isExecuting ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="inline-block"
            >
              ⟳
            </motion.span>
          ) : (
            <span>🛸</span>
          )}
          <span>{isExecuting ? 'WDK Executing…' : 'Ping WDK Agent'}</span>
        </button>
      </div>
    </div>
  );
};

export default GuardianWDKStatus;

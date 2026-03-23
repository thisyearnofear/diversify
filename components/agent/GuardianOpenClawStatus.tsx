/**
 * GuardianOpenClawStatus - Inline OpenClaw agent status for the Guardian tier card.
 * Replaces the old "Open OpenClaw Agent" button + modal panel with a compact status display.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuardianOpenClawStatusProps {
  agentStatus: 'online' | 'offline' | 'unavailable' | 'loading';
  agentIdentity: {
    agent_id: string;
    name: string;
    agent_version?: string;
    operator_mode?: string;
  } | null;
  recentReceipts: Array<{
    event_id: string;
    run_id: string;
    timestamp: string;
    action_type: string;
    tool: string;
    status: 'success' | 'error' | 'retry' | 'skipped';
    duration_ms: number;
    onchain?: {
      chain: string;
      tx_hash: string;
      explorer_url: string;
      tx_status: string;
    };
  }>;
  lastHeartbeat: Date | null;
  isExecuting: boolean;
  onTriggerHeartbeat: () => void;
}

const statusIndicator: Record<GuardianOpenClawStatusProps['agentStatus'], { color: string; label: string }> = {
  online: { color: 'bg-green-500', label: 'Online' },
  offline: { color: 'bg-red-500', label: 'Offline' },
  unavailable: { color: 'bg-gray-400', label: 'Unavailable' },
  loading: { color: 'bg-amber-500', label: 'Loading' },
};

const receiptIcon: Record<string, string> = {
  success: '✅',
  error: '❌',
  retry: '🔄',
  skipped: '⏭️',
};

function formatTimeAgo(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;
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

const GuardianOpenClawStatus: React.FC<GuardianOpenClawStatusProps> = ({
  agentStatus,
  agentIdentity,
  recentReceipts,
  lastHeartbeat,
  isExecuting,
  onTriggerHeartbeat,
}) => {
  const { color, label } = statusIndicator[agentStatus];
  const displayName = agentIdentity?.name ?? 'OpenClaw Agent';
  const visibleReceipts = recentReceipts.slice(0, 3);

  return (
    <div className="bg-purple-50/60 dark:bg-purple-900/20 rounded-xl p-3 space-y-2">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0">🦞</span>
          <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
            {displayName}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              {agentStatus === 'online' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </span>
        </div>
        {lastHeartbeat && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
            ⟳ {formatTimeAgo(lastHeartbeat)}
          </span>
        )}
      </div>

      {/* Agent Activity Status Info */}
      <div className="text-sm text-gray-500 dark:text-gray-400 py-1">
        Autonomous monitoring is {agentStatus === 'online' ? 'active in the background' : 'temporarily paused'}.
      </div>

      {/* Trigger Heartbeat */}
      <div className="border-t border-purple-200 dark:border-purple-800 pt-2">
        <button
          onClick={onTriggerHeartbeat}
          disabled={isExecuting || agentStatus === 'unavailable'}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
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
            <span>💓</span>
          )}
          <span>{isExecuting ? 'Sending…' : 'Trigger Heartbeat'}</span>
        </button>
      </div>
    </div>
  );
};

export default GuardianOpenClawStatus;

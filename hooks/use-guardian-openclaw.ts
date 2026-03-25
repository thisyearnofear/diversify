/**
 * useGuardianOpenClaw Hook
 *
 * Provides inline OpenClaw agent status and execution capabilities
 * for the Guardian tier. Replaces the separate OpenClawPanel chat
 * with lightweight status polling and direct execution.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
// ============================================================================
// TYPES
// ============================================================================

export interface OpenClawReceipt {
  event_id: string;
  run_id: string;
  timestamp: string;
  agent_id: string;
  action_type: string;
  tool: string;
  status: 'success' | 'error' | 'retry' | 'skipped';
  duration_ms: number;
  onchain?: {
    chain: string;
    chain_id: number;
    tx_hash: string;
    explorer_url: string;
    tx_status: string;
  };
}

export interface OpenClawIdentity {
  schema_version: string;
  agent_id: string;
  name: string;
  agent_version: string;
  operator_mode: string;
  capabilities: string[];
  wallets: Array<{
    chain: string;
    address: string;
    purpose: string;
  }>;
}

type AgentStatus = 'online' | 'offline' | 'unavailable' | 'loading';

const HEARTBEAT_INTERVAL_MS = 60_000;

export function useGuardianOpenClaw() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('loading');
  const [agentIdentity, setAgentIdentity] = useState<OpenClawIdentity | null>(null);
  const [recentReceipts, setRecentReceipts] = useState<OpenClawReceipt[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Heartbeat – fetch identity to determine agent availability
  // ---------------------------------------------------------------------------

  const triggerHeartbeat = useCallback(async () => {
    try {
      const [idResponse, receiptResponse] = await Promise.all([
        fetch('/api/agent/openclaw/receipts?type=identity'),
        fetch('/api/agent/openclaw/receipts?type=latest')
      ]);
      
      const idData = await idResponse.json();
      const receiptData = await receiptResponse.json();

      if (idResponse.ok && idData.identity) {
        setAgentIdentity(idData.identity);
        setAgentStatus('online');
      } else {
        const isDisabled = idData.error === 'OpenClaw integration is not enabled';
        setAgentStatus(isDisabled ? 'unavailable' : 'offline');
        setAgentIdentity(null);
      }

      if (receiptResponse.ok && receiptData.receipts) {
        setRecentReceipts(receiptData.receipts);
      }

      setLastHeartbeat(new Date());
    } catch {
      setAgentStatus('offline');
      setAgentIdentity(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Polling on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    triggerHeartbeat();

    intervalRef.current = setInterval(triggerHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [triggerHeartbeat]);

  // ---------------------------------------------------------------------------
  // Execute a transaction via OpenClaw
  // ---------------------------------------------------------------------------

  const executeViaOpenClaw = useCallback(
    async (action: {
      track: string;
      rpcUrl: string;
      rawTx: string;
      explorerBase: string;
    }): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      setIsExecuting(true);

      try {
        const response = await fetch('/api/agent/openclaw/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId: `guardian-${Date.now()}`,
            track: action.track,
            rpcUrl: action.rpcUrl,
            rawTx: action.rawTx,
            explorerBase: action.explorerBase,
            // Include WDK augmentation metadata for OpenClaw to recognize
            metadata: {
              augmentation: 'TETHER_WDK',
              hackathon: 'Galactica-WDK-2026-01'
            }
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || 'Execution failed' };
        }

        return {
          success: data.success,
          txHash: data.txHash,
          error: data.error,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to execute via OpenClaw',
        };
      } finally {
        setIsExecuting(false);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Fetch recent execution receipts
  // ---------------------------------------------------------------------------

  const getRecentReceipts = useCallback(async (runId?: string) => {
    try {
      const url = runId
        ? `/api/agent/openclaw/receipts?runId=${encodeURIComponent(runId)}`
        : '/api/agent/openclaw/receipts?type=latest';
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.receipts || [];
    } catch {
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    agentStatus,
    agentIdentity,
    recentReceipts,
    executeViaOpenClaw,
    getRecentReceipts,
    triggerHeartbeat,
    lastHeartbeat,
    isExecuting,
  };
}

export default useGuardianOpenClaw;

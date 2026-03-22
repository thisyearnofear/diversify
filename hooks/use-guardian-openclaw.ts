/**
 * useGuardianOpenClaw Hook
 *
 * Provides inline OpenClaw agent status and execution capabilities
 * for the Guardian tier. Replaces the separate OpenClawPanel chat
 * with lightweight status polling and direct execution.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { OpenClawIdentity, OpenClawReceipt } from './use-openclaw';

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
      const response = await fetch('/api/agent/openclaw/receipts?type=identity');
      const data = await response.json();

      if (!response.ok) {
        const isDisabled = data.error === 'OpenClaw integration is not enabled';
        setAgentStatus(isDisabled ? 'unavailable' : 'offline');
        setAgentIdentity(null);
        return;
      }

      if (data.identity) {
        setAgentIdentity(data.identity);
        setAgentStatus('online');
      } else {
        setAgentStatus('offline');
        setAgentIdentity(null);
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
      const params = new URLSearchParams();
      if (runId) params.set('runId', runId);

      const response = await fetch(`/api/agent/openclaw/receipts?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.receipts) {
        setRecentReceipts(data.receipts);
        return data.receipts as OpenClawReceipt[];
      }

      return [];
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

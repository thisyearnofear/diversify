/**
 * useOpenClaw Hook
 * 
 * React hook for integrating with the external OpenClaw instance.
 * Provides chat, execution, and receipt management capabilities.
 */

import { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface OpenClawMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenClawChatResponse {
  success: boolean;
  response: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
  fallback?: string;
}

export interface OpenClawExecuteRequest {
  runId: string;
  track: string;
  rpcUrl: string;
  rawTx: string;
  explorerBase: string;
}

export interface OpenClawExecuteResponse {
  success: boolean;
  runId: string;
  track: string;
  txHash?: string;
  explorerUrl?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
  fallback?: string;
}

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

export interface OpenClawReceiptsResponse {
  success: boolean;
  runId: string;
  receipts: OpenClawReceipt[];
  count: number;
  error?: string;
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

export interface OpenClawState {
  isLoading: boolean;
  error: string | null;
  isEnabled: boolean;
  isUnavailable: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useOpenClaw() {
  const [state, setState] = useState<OpenClawState>({
    isLoading: false,
    error: null,
    isEnabled: true, // Will be determined by API response
    isUnavailable: false,
  });

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  const chat = useCallback(async (messages: OpenClawMessage[]): Promise<OpenClawChatResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/agent/openclaw/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: data.error,
          isEnabled: data.error !== 'OpenClaw integration is not enabled',
          isUnavailable: data.error?.includes('temporarily unavailable')
        }));
        return data;
      }

      setState(prev => ({ ...prev, isLoading: false, isEnabled: true, isUnavailable: false }));
      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to communicate with OpenClaw';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, response: '', error: errorMessage };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Execute
  // ---------------------------------------------------------------------------

  const execute = useCallback(async (request: OpenClawExecuteRequest): Promise<OpenClawExecuteResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/agent/openclaw/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: data.error,
          isEnabled: data.error !== 'OpenClaw integration is not enabled',
          isUnavailable: data.error?.includes('temporarily unavailable')
        }));
        return data;
      }

      setState(prev => ({ ...prev, isLoading: false, isEnabled: true, isUnavailable: false }));
      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to execute via OpenClaw';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { 
        success: false, 
        runId: request.runId, 
        track: request.track, 
        status: 'failed',
        error: errorMessage 
      };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------

  const getReceipts = useCallback(async (runId: string): Promise<OpenClawReceiptsResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/agent/openclaw/receipts?runId=${encodeURIComponent(runId)}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ ...prev, isLoading: false, error: data.error }));
        return data;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch receipts';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, runId, receipts: [], count: 0, error: errorMessage };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  const getIdentity = useCallback(async (): Promise<OpenClawIdentity | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/agent/openclaw/receipts?type=identity', {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        setState(prev => ({ ...prev, isLoading: false, error: data.error }));
        return null;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return data.identity;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch identity';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Quick Actions
  // ---------------------------------------------------------------------------

  const analyzePortfolio = useCallback(async (portfolioContext: string): Promise<string> => {
    const messages: OpenClawMessage[] = [
      {
        role: 'system',
        content: 'You are DiversiFi-AI, an autonomous wealth diversification agent. Analyze the portfolio and provide actionable recommendations for diversification across chains, DeFi protocols, and asset classes.'
      },
      {
        role: 'user',
        content: portfolioContext
      }
    ];

    const result = await chat(messages);
    return result.response;
  }, [chat]);

  const getStrategyAdvice = useCallback(async (strategy: string): Promise<string> => {
    const messages: OpenClawMessage[] = [
      {
        role: 'system',
        content: 'You are DiversiFi-AI, an autonomous wealth diversification agent. Provide specific strategy advice based on the user\'s request.'
      },
      {
        role: 'user',
        content: strategy
      }
    ];

    const result = await chat(messages);
    return result.response;
  }, [chat]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    ...state,
    
    // Core actions
    chat,
    execute,
    getReceipts,
    getIdentity,
    
    // Quick actions
    analyzePortfolio,
    getStrategyAdvice,
  };
}

export default useOpenClaw;

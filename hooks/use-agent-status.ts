import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { AI_FEATURES, AUTONOMOUS_FEATURES } from "../config/features";
import type { AICapabilities, AutonomousStatus } from "./agent-types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type StatusState = {
  capabilities: AICapabilities;
  autonomousStatus: AutonomousStatus | null;
  initialized: boolean;
  isLoading: boolean;
};

const defaultCapabilities: AICapabilities = {
  analysis: AI_FEATURES.ANALYSIS,
  voiceInput: AI_FEATURES.VOICE_INPUT,
  voiceOutput: AI_FEATURES.VOICE_OUTPUT,
  chat: AI_FEATURES.CHAT,
  webSearch: AI_FEATURES.WEB_SEARCH,
};

const defaultState: StatusState = {
  capabilities: defaultCapabilities,
  autonomousStatus: null,
  initialized: false,
  isLoading: true,
};

export function useAgentStatus() {
  const { user, ready } = usePrivy();
  const [state, setState] = useState<StatusState>(defaultState);

  const fetchStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const userId = user?.id ? encodeURIComponent(user.id) : '';
      const response = await fetch(`${API_BASE}/api/agent/status${userId ? `?userId=${userId}` : ''}`);
      
      if (response.ok) {
        const status = await response.json();

        const capabilities: AICapabilities = {
          analysis: status.capabilities?.analysis ?? AI_FEATURES.ANALYSIS,
          voiceInput: status.capabilities?.transcription ?? AI_FEATURES.VOICE_INPUT,
          voiceOutput: status.capabilities?.speech ?? AI_FEATURES.VOICE_OUTPUT,
          chat: status.capabilities?.analysis ?? AI_FEATURES.CHAT,
          webSearch: status.capabilities?.webSearch ?? AI_FEATURES.WEB_SEARCH,
        };

        let autonomousStatus: AutonomousStatus | null = null;
        
        if (AUTONOMOUS_FEATURES.AUTONOMOUS_MODE && status.enabled) {
          // If we have specific user agent data, use that
          if (status.userAgent) {
            autonomousStatus = {
              enabled: true,
              isTestnet: status.isTestnet ?? true,
              walletType: "agent-fuel",
              spendingLimit: status.spendingLimit ?? 5.0,
              spent: status.userAgent.spent ?? 0,
              remaining: status.userAgent.remaining ?? 5.0,
              balance: status.userAgent.balance,
              address: status.userAgent.address
            };
          } else {
            // Fallback to server/global status
            autonomousStatus = {
              enabled: true,
              isTestnet: status.isTestnet ?? true,
              walletType: status.walletType ?? "none",
              spendingLimit: status.spendingLimit ?? 5.0,
              spent: status.spent ?? 0,
              remaining: status.remaining ?? 5.0,
            };
          }
        }

        setState({
          capabilities,
          autonomousStatus,
          initialized: true,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error("[useAgentStatus] Failed to initialize:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    if (ready) {
      void fetchStatus();
    }
  }, [fetchStatus, ready]);

  return {
    capabilities: state.capabilities,
    autonomousStatus: state.autonomousStatus,
    isLoading: state.isLoading,
    initializeAI: fetchStatus,
  };
}

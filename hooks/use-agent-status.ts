import { useCallback, useEffect, useState } from "react";
import { AI_FEATURES, AUTONOMOUS_FEATURES } from "../config/features";
import type { AICapabilities, AutonomousStatus } from "./agent-types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type StatusState = {
  capabilities: AICapabilities;
  autonomousStatus: AutonomousStatus | null;
  initialized: boolean;
};

const defaultCapabilities: AICapabilities = {
  analysis: AI_FEATURES.ANALYSIS,
  voiceInput: AI_FEATURES.VOICE_INPUT,
  voiceOutput: AI_FEATURES.VOICE_OUTPUT,
  chat: AI_FEATURES.CHAT,
  webSearch: AI_FEATURES.WEB_SEARCH,
};

let cachedState: StatusState = {
  capabilities: defaultCapabilities,
  autonomousStatus: null,
  initialized: false,
};

const listeners = new Set<(state: StatusState) => void>();
let inflight: Promise<void> | null = null;

const notifyListeners = () => {
  listeners.forEach((listener) => listener(cachedState));
};

const fetchStatus = async () => {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agent/status`);
      if (response.ok) {
        const status = await response.json();

        const capabilities: AICapabilities = {
          analysis: status.capabilities?.analysis ?? AI_FEATURES.ANALYSIS,
          voiceInput: status.capabilities?.transcription ?? AI_FEATURES.VOICE_INPUT,
          voiceOutput: status.capabilities?.speech ?? AI_FEATURES.VOICE_OUTPUT,
          chat: status.capabilities?.analysis ?? AI_FEATURES.CHAT,
          webSearch: status.capabilities?.webSearch ?? AI_FEATURES.WEB_SEARCH,
        };

        const autonomousStatus =
          AUTONOMOUS_FEATURES.AUTONOMOUS_MODE && status.enabled
            ? {
                enabled: true,
                isTestnet: status.isTestnet ?? true,
                walletType: status.walletType ?? "none",
                spendingLimit: status.spendingLimit ?? 5.0,
                spent: status.spent ?? 0,
                remaining: status.remaining ?? 5.0,
              }
            : null;

        cachedState = {
          capabilities,
          autonomousStatus,
          initialized: true,
        };
        notifyListeners();
      }
    } catch (error) {
      console.error("[useAgentStatus] Failed to initialize:", error);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

export function useAgentStatus() {
  const [state, setState] = useState<StatusState>(cachedState);

  useEffect(() => {
    const listener = (next: StatusState) => setState(next);
    listeners.add(listener);

    if (!cachedState.initialized) {
      void fetchStatus();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const initializeAI = useCallback(async () => {
    await fetchStatus();
  }, []);

  return {
    capabilities: state.capabilities,
    autonomousStatus: state.autonomousStatus,
    initializeAI,
  };
}

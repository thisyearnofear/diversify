import { useCallback, useEffect, useState } from "react";
import type { AIConfig } from "./agent-types";

const CONFIG_STORAGE_KEY = "diversifi-agent-config";

const DEFAULT_CONFIG: AIConfig = {
  riskTolerance: "Balanced",
  goal: "Inflation Hedge",
  timeHorizon: "3 months",
  spendingLimit: 5.0,
  voiceResponsesEnabled: false,
  walletProvider: "CIRCLE_MPC", // Default to Circle MPC (Guardian Wallet model)
};

let cachedConfig: AIConfig = DEFAULT_CONFIG;
const listeners = new Set<(config: AIConfig) => void>();

const notify = () => {
  listeners.forEach((listener) => listener(cachedConfig));
};

const updateCachedConfig = (
  updater: AIConfig | ((prev: AIConfig) => AIConfig),
) => {
  cachedConfig = typeof updater === "function" ? updater(cachedConfig) : updater;
  notify();
};

export function useAgentConfig() {
  const [config, setConfig] = useState<AIConfig>(cachedConfig);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<AIConfig>;
      updateCachedConfig((prev) => ({ ...prev, ...parsed }));
    } catch (error) {
      console.warn("[useAgentConfig] Failed to load config from storage:", error);
    }
  }, []);

  useEffect(() => {
    const listener = (next: AIConfig) => setConfig(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const updateConfig = useCallback(
    (next: AIConfig | ((prev: AIConfig) => AIConfig)) => {
      updateCachedConfig((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(resolved));
          } catch (error) {
            console.warn("[useAgentConfig] Failed to save config to storage:", error);
          }
        }

        return resolved;
      });
    },
    [],
  );

  return { config, updateConfig };
}

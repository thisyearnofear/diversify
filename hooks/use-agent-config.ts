import { useCallback, useEffect, useState } from "react";
import type { AIConfig } from "./agent-types";

const DEFAULT_CONFIG: AIConfig = {
  riskTolerance: "Balanced",
  goal: "Inflation Hedge",
  timeHorizon: "3 months",
  spendingLimit: 5.0,
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
    const listener = (next: AIConfig) => setConfig(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const updateConfig = useCallback(
    (next: AIConfig | ((prev: AIConfig) => AIConfig)) => {
      updateCachedConfig(next);
    },
    [],
  );

  return { config, updateConfig };
}

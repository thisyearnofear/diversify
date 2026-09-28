/**
 * AdaptiveContext — Provides the current session's adaptive config to the
 * entire app tree.
 *
 * This is the wiring point between signal detection (Phase 1: geo + wallet)
 * and app surfaces (content routing: shield morph, banners).
 *
 * Usage:
 *   const { config } = useAdaptiveContext();
 *   if (config.content.shieldMorph === "cycle") { /* business surfaces *\/ }
 *   const banner = config.content.contextualBanner;
 *
 * The config is stable (useMemo in the provider) so consumers don't
 * trigger unnecessary re-renders when signals are unchanged.
 */

import React, { createContext, useContext, type ReactNode, useMemo } from "react";
import { useSignalDetector, type AdaptiveConfig } from "../../hooks/use-signal-detector";

interface AdaptiveContextValue {
  /** Current session's adaptive configuration */
  config: AdaptiveConfig;
  /** Raw signals for debugging / advanced use */
  isMobile: boolean;
  detectionMethod: string;
}

const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

export function AdaptiveProvider({ children }: { children: ReactNode }) {
  const { config, isMobile, detectionMethod } = useSignalDetector();

  const value = useMemo(
    () => ({ config, isMobile, detectionMethod }),
    // Signals are already stable (useMemo in hook) but we need to
    // ensure this context value only changes when the persona changes.
    [config.persona], // persona change is the only meaningful change
  );

  return <AdaptiveContext.Provider value={value}>{children}</AdaptiveContext.Provider>;
}

export function useAdaptiveContext(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) {
    // Fallback for tests and contexts outside AdaptiveProvider
    const fallback: AdaptiveContextValue = {
      config: {
        persona: "generic_user",
        content: {
          shieldMorph: "plan",
          contextualBanner: null,
        },
      },
      isMobile: false,
      detectionMethod: "none",
    };
    return fallback;
  }
  return ctx;
}

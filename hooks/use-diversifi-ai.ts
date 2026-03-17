/**
 * useDiversifiAI - Unified AI Hook
 *
 * Consolidates all AI capabilities following Core Principles:
 * - DRY: Single hook for all AI interactions
 * - CLEAN: Clear separation between AI and blockchain features
 * - MODULAR: AI works independently of autonomous mode
 *
 * This replaces useWealthProtectionAgent with clearer nomenclature.
 */

import { useMemo } from "react";
import { AUTONOMOUS_FEATURES } from "../config/features";
import { useAgentStatus } from "./use-agent-status";
import { useAgentChat } from "./use-agent-chat";
import { useAgentAnalysis } from "./use-agent-analysis";
import { useAgentActivities } from "./use-agent-activities";
import { useAgentConfig } from "./use-agent-config";
import { useAgentVoice } from "./use-agent-voice";

// Points to the AI backend. In production, set NEXT_PUBLIC_API_BASE_URL to
// the Hetzner API server (e.g. https://api.diversifi.famile.xyz).
// Defaults to empty string so relative paths work on Netlify / local dev.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDiversifiAI(useGlobalConversation: boolean = true) {
  const { activities, addActivity } = useAgentActivities();

  const { capabilities, autonomousStatus, initializeAI } = useAgentStatus();

  const { config, updateConfig } = useAgentConfig();

  const { generateSpeech, transcribeAudio } = useAgentVoice({ apiBase: API_BASE, capabilities });
  const {
    messages,
    isChatting,
    thinkingStep: chatThinkingStep,
    sendChatMessage,
    addMessage,
    clearMessages,
  } = useAgentChat({
    apiBase: API_BASE,
    capabilities,
    useGlobalConversation,
    generateSpeech,
  });
  const {
    advice,
    isAnalyzing: isAnalysisRunning,
    thinkingStep: analysisThinkingStep,
    analysisProgress,
    analysisSteps,
    portfolioAnalysis,
    analyze,
    analyzePortfolio,
    runAutonomousAnalysis,
    clearAdvice,
  } = useAgentAnalysis({
    apiBase: API_BASE,
    capabilities,
    config,
    addMessage,
    addActivity,
    autonomousStatus,
    autonomousEnabled: AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
  });

  const isAnalyzing = isAnalysisRunning || isChatting;
  const thinkingStep = isAnalysisRunning ? analysisThinkingStep : chatThinkingStep;

  return useMemo(
    () => ({
      // Core AI
      advice,
      isAnalyzing,
      thinkingStep,
      analysisProgress,
      analysisSteps,
      messages,
      portfolioAnalysis,
      capabilities,

      // Actions (with legacy aliases for compatibility)
      analyze,
      analyzePortfolio,
      sendMessage: sendChatMessage,
      sendChatMessage,
      transcribeAudio,
      generateSpeech,
      initializeAI,

      // Config
      config,
      updateConfig,

      // Autonomous mode (optional)
      autonomousStatus,
      runAutonomousAnalysis,

      // Activity tracking
      activities,
      addActivity,

      // Utilities
      clearMessages,
      clearConversation: clearMessages,
      clearAdvice,
    }),
    [
      addActivity,
      advice,
      analysisProgress,
      analysisSteps,
      analyze,
      analyzePortfolio,
      activities,
      autonomousStatus,
      capabilities,
      config,
      updateConfig,
      clearAdvice,
      clearMessages,
      initializeAI,
      isAnalyzing,
      messages,
      portfolioAnalysis,
      runAutonomousAnalysis,
      sendChatMessage,
      thinkingStep,
      generateSpeech,
      transcribeAudio,
    ],
  );
}

// Legacy export for gradual migration
export { useDiversifiAI as useWealthProtectionAgent };
export default useDiversifiAI;

export type { AgentActivity, AIAdvice } from "./agent-types";

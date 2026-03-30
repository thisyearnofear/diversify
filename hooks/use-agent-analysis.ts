import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  analyzePortfolio,
  type PortfolioAnalysis,
  StrategyService,
} from "@diversifi/shared";
import { useToast } from "../components/ui/Toast";
import { getPersistedStrategy, getStrategyPrompt } from "./useFinancialStrategies";
import { agentEventBus } from "./agent-event-bus";
import type {
  AgentAnalysisActions,
  AgentAnalysisDependencies,
  AgentAnalysisState,
  AIAdvice,
} from "./agent-types";
import type { RegionalInflationData } from "./use-inflation-data";
import type { MultichainPortfolio } from "./use-multichain-balances";

type AnalysisStoreState = {
  advice: AIAdvice | null;
  isAnalyzing: boolean;
  thinkingStep: string;
  analysisProgress: number;
  analysisSteps: string[];
  portfolioAnalysis: PortfolioAnalysis | null;
};

const defaultState: AnalysisStoreState = {
  advice: null,
  isAnalyzing: false,
  thinkingStep: "",
  analysisProgress: 0,
  analysisSteps: [],
  portfolioAnalysis: null,
};

let cachedState: AnalysisStoreState = defaultState;
const listeners = new Set<(state: AnalysisStoreState) => void>();

const notify = () => {
  listeners.forEach((listener) => listener(cachedState));
};

const updateState = (
  updater: Partial<AnalysisStoreState> | ((prev: AnalysisStoreState) => Partial<AnalysisStoreState>),
) => {
  const partial = typeof updater === "function" ? updater(cachedState) : updater;
  cachedState = { ...cachedState, ...partial };
  notify();
};

export function useAgentAnalysis({
  apiBase,
  capabilities,
  config,
  addMessage,
  addActivity,
  autonomousStatus,
  autonomousEnabled = false,
}: AgentAnalysisDependencies): AgentAnalysisState & AgentAnalysisActions {
  const { user } = usePrivy();
  const { showToast } = useToast();
  const [state, setState] = useState<AnalysisStoreState>(cachedState);

  useEffect(() => {
    const listener = (next: AnalysisStoreState) => setState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const analyzePortfolioAI = useCallback(
    async (
      inflationData: Record<string, RegionalInflationData>,
      portfolio: MultichainPortfolio,
      userGoal?: string,
      userRegion?: string,
      analysisGoal?: string,
      macroData?: Record<string, any>,
      networkActivity?: any,
      strategyPrompt?: string,
    ) => {
      if (!capabilities.analysis) {
        console.warn("[useAgentAnalysis] Analysis not available");
        return null;
      }

      updateState({
        isAnalyzing: true,
        analysisProgress: 0,
        thinkingStep: "Initializing protection protocols...",
      });

      let progressInterval: any = null;

      try {
        updateState({ analysisProgress: 10, thinkingStep: "Securing market data..." });

        await new Promise((resolve) => setTimeout(resolve, 600));

        updateState({ analysisProgress: 25, thinkingStep: "Calibrating inflation models..." });
        const localAnalysis = analyzePortfolio(
          portfolio,
          inflationData,
          userGoal || config.goal,
          macroData,
        );
        updateState({ portfolioAnalysis: localAnalysis });

        const strategy = getPersistedStrategy();
        if (
          strategy &&
          localAnalysis.regionalExposure.length > 0 &&
          localAnalysis.totalValue > 0
        ) {
          const allocations = localAnalysis.regionalExposure.reduce((acc, r) => {
            acc[r.region as any] = (r.value / localAnalysis.totalValue) * 100;
            return acc;
          }, {} as Record<string, number>);
          const { score, feedback } = StrategyService.calculateScore(
            strategy,
            allocations as any,
          );
          if (score < 60 && feedback.length > 0) {
            showToast(`⚠️ Strategy drift detected: ${feedback[0]}`, "warning");
          }
        }

        updateState({ analysisProgress: 35 });

        const THEMATIC_MESSAGES = [
          "Querying World Bank Macro indicators...",
          "Analyzing IMF Inflation forecasts...",
          "Fetching DefiLlama yield aggregates...",
          "Cross-referencing market momentum...",
          "Scanning on-chain stability protocols...",
          "Calculating geographic risk premiums...",
          "Verifying institutional liquidity...",
          "Optimizing wealth preservation path...",
          "Finalizing analyst insights...",
        ];

        let messageIndex = 0;
        updateState({ thinkingStep: THEMATIC_MESSAGES[0] });

        progressInterval = setInterval(() => {
          updateState((prev) => {
            let nextProgress = prev.analysisProgress;
            if (nextProgress >= 90) return { analysisProgress: 90 };
            if (nextProgress > 80) nextProgress = Math.round(nextProgress + 0.6);
            else if (nextProgress > 70) nextProgress = Math.round(nextProgress + 0.9);
            else if (nextProgress > 50) nextProgress = Math.round(nextProgress + 1.2);
            else nextProgress = Math.round(nextProgress + 1.6);

            return { analysisProgress: nextProgress };
          });

          if (Math.random() > 0.75) {
            messageIndex = (messageIndex + 1) % THEMATIC_MESSAGES.length;
            updateState({ thinkingStep: THEMATIC_MESSAGES[messageIndex] });
          }
        }, 800);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${apiBase}/api/agent/advisor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            mode: "analysis",
            portfolio,
            inflationData,
            macroData,
            networkActivity,
            config: {
              userGoal: analysisGoal || userGoal || config.goal,
              riskTolerance: config.riskTolerance,
              timeHorizon: config.timeHorizon || '3 months',
            },
            userRegion: userRegion,
            strategyPrompt: strategyPrompt || getStrategyPrompt(),
          }),
        });
        clearTimeout(timeoutId);

        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        updateState({ analysisProgress: 92, thinkingStep: "Finalizing strategy..." });

        await new Promise((resolve) => setTimeout(resolve, 800));

        if (response.ok) {
          const result = await response.json();
          updateState({
            analysisProgress: 100,
            thinkingStep: "Analysis complete!",
            advice: result.advice,
          });
          agentEventBus.emit("advisor:analysis", {
            advice: result.advice,
            timestamp: Date.now(),
          });
          setTimeout(() => {
            updateState({
              isAnalyzing: false,
              thinkingStep: "",
              analysisProgress: 0,
            });
          }, 1500);

          addActivity({
            type: "analysis",
            tier: "ADVISOR",
            description: `Analyzed portfolio: ${result.advice?.oneLiner || "Portfolio analysis complete"}`,
            status: "success",
            details: {
              action: result.advice?.action,
              savings: result.advice?.expectedSavings,
            },
          });

          if (result.advice) {
            const topAction = result.advice.action
              ? `\n\n💡 **Top action:** ${result.advice.action}${result.advice.oneLiner ? ` — ${result.advice.oneLiner}` : ""}. Want me to set that up?`
              : "";
            const summary = [
              `📊 **Portfolio Analysis Complete**`,
              result.advice.oneLiner,
              result.advice.reasoning ? `\n${result.advice.reasoning}` : "",
              result.advice.expectedSavings
                ? `\n💰 Potential savings: $${result.advice.expectedSavings.toFixed(2)}/yr`
                : "",
              topAction,
            ]
              .filter(Boolean)
              .join("\n");
            addMessage({
              id: `analysis-${Date.now()}`,
              role: "assistant",
              content: summary,
              timestamp: new Date(),
              type: "text",
            });
          }

          return result.advice;
        } else {
          updateState({ thinkingStep: "Analysis disrupted. Retrying..." });
          throw new Error(`API returned ${response.status}`);
        }
      } catch (error) {
        console.error("[useAgentAnalysis] Analysis failed:", error);
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        updateState({ thinkingStep: "Connection interrupted. Please retry." });
        setTimeout(() => {
          updateState({
            isAnalyzing: false,
            thinkingStep: "",
            analysisProgress: 0,
          });
        }, 1500);
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      }
    },
    [apiBase, capabilities.analysis, config, addActivity, addMessage, showToast],
  );

  const analyze = useCallback(
    async (
      inflationData: Record<string, RegionalInflationData>,
      userBalanceOrPortfolio: number | MultichainPortfolio,
      currentHoldings?: string[],
      networkInfo?: { chainId: number; name: string },
      _multiChainContext?: unknown,
      aggregatedPortfolio?: MultichainPortfolio,
      userRegion?: string,
      analysisGoal?: string,
      macroData?: Record<string, any>,
      networkActivity?: any,
      strategyPrompt?: string,
    ) => {
      console.log("[useAgentAnalysis] analyze called with:", {
        hasInflationData: !!inflationData,
        userRegion: userRegion,
        analysisGoal: analysisGoal,
        portfolioType: typeof userBalanceOrPortfolio,
        portfolioValue:
          typeof userBalanceOrPortfolio === "number"
            ? userBalanceOrPortfolio
            : userBalanceOrPortfolio.totalValue,
        approach: "Using app-level region settings (no duplicate UI)",
      });

      let portfolio: MultichainPortfolio;
      if (typeof userBalanceOrPortfolio === "number") {
        portfolio = aggregatedPortfolio || {
          totalValue: userBalanceOrPortfolio,
          chains: networkInfo
            ? [
                {
                  chainId: networkInfo.chainId,
                  chainName: networkInfo.name,
                  balances: [],
                  totalValue: userBalanceOrPortfolio,
                  tokenCount: currentHoldings?.length || 0,
                  isLoading: false,
                  error: null,
                },
              ]
            : [],
          allTokens: [],
          tokenMap: {},
          regionData: [],
          isLoading: false,
          isStale: false,
          errors: [],
          lastUpdated: Date.now(),
          chainCount: networkInfo ? 1 : 0,
          ...({} as any),
        };
      } else {
        portfolio = userBalanceOrPortfolio;
      }

      return analyzePortfolioAI(
        inflationData,
        portfolio,
        undefined,
        userRegion,
        analysisGoal,
        macroData,
        networkActivity,
        strategyPrompt,
      );
    },
    [analyzePortfolioAI],
  );

  const runAutonomousAnalysis = useCallback(
    async (
      inflationData: Record<string, RegionalInflationData>,
      portfolio: MultichainPortfolio,
      signedPermission?: any,
    ) => {
      if (!autonomousEnabled || !autonomousStatus?.enabled) {
        console.warn("[useAgentAnalysis] Autonomous mode not available");
        return null;
      }

      updateState({ isAnalyzing: true, thinkingStep: "Running autonomous analysis..." });

      try {
        let userZapierPrefs = undefined;
        try {
          // Attempt to locate any saved automation preferences in local storage to use client-defined webhooks
          const prefKey = Object.keys(localStorage).find(k => k.startsWith('diversifi-automation-prefs'));
          if (prefKey) {
             const prefs = JSON.parse(localStorage.getItem(prefKey) || '{}');
             userZapierPrefs = prefs?.zapier;
          }
        } catch (e) {
            // Ignore parse errors securely
        }

        const response = await fetch(`${apiBase}/api/agent/deep-analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolio,
            inflationData,
            config: {
              userGoal: config.goal,
              riskTolerance: config.riskTolerance,
              timeHorizon: config.timeHorizon || '3 months',
              zapier: userZapierPrefs // Phase 5D: Inject user-driven Zapier config map
            },
            useAutonomousMode: true,
            userId: user?.id, // Pass authenticated user ID for "Agent Fuel" flow
            signedPermission: signedPermission || undefined, // Phase 2A: Thread session permission
          }),
        });

        if (response.ok) {
          const result = await response.json();
          updateState({ advice: result.advice });
          
          // Phase 5B & 5C: Emit event for Guardian Activity Feed to show execution receipts
          agentEventBus.emit("advisor:analysis", { 
            advice: result.advice, 
            timestamp: Date.now() 
          });
          
          return result.advice;
        }
      } catch (error) {
        console.error("[useAgentAnalysis] Autonomous analysis failed:", error);
      } finally {
        updateState({ isAnalyzing: false, thinkingStep: "" });
      }

      return null;
    },
    [apiBase, autonomousEnabled, autonomousStatus, user?.id, config],
  );

  const clearAdvice = useCallback(() => updateState({ advice: null }), []);

  return {
    advice: state.advice,
    isAnalyzing: state.isAnalyzing,
    thinkingStep: state.thinkingStep,
    analysisProgress: state.analysisProgress,
    analysisSteps: state.analysisSteps,
    portfolioAnalysis: state.portfolioAnalysis,
    analyze,
    analyzePortfolio: analyzePortfolioAI,
    runAutonomousAnalysis,
    clearAdvice,
  };
}

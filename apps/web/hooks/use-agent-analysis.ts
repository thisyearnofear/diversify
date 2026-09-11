import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletContext } from "../components/wallet/WalletProvider";
// Deep leaf imports — NOT the barrel — keeps the portfolio-analysis + strategy stacks out of first-load.
import { analyzePortfolio, type PortfolioAnalysis } from "@diversifi/shared/src/utils/portfolio-analysis";
import { fetchWithTimeout } from "@diversifi/shared/src/utils/promise-utils";
import { getCachedWalletAuth } from "@/lib/wallet-auth";
import { scorePlanAlignment } from "@/lib/plan-alignment";
import { canonicalToken } from "@/lib/plan-legs";
import { getArchetypeAllocations, legsForRisk } from "@/components/protection-cards/plan-preview";
import { strategyToArchetype } from "@/components/protection-cards/tokens";

// Tiered timeouts (see packages/shared/src/utils/promise-utils jsdoc for the
// full convention). 30s preserves the original AbortController budget for the
// rotating thinkingStep messages so they don't give up before the LLM
// finishes; 12s covers the multi-source synthesis for autonomous mode.
const ADVISOR_ANALYSIS_TIMEOUT_MS = 30000;
const DEEP_ANALYZE_TIMEOUT_MS = 12000;
const GUARDIAN_STATE_TIMEOUT_MS = 6000;
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
  const { address, signMessage } = useWalletContext();
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
        if (strategy) {
          const archetypeId = strategyToArchetype(strategy);
          const baseLegs = archetypeId ? getArchetypeAllocations(archetypeId) : [];
          // Same risk-adjusted legs the ring draws — drift feedback can't
          // disagree with what the user sees.
          const legs = legsForRisk(baseLegs, config.riskTolerance);
          const heldPctByToken = new Map<string, number>();
          if (portfolio.totalValue > 0) {
            for (const b of (portfolio.chains ?? []).flatMap((c) => c.balances ?? [])) {
              if (b.value > 0) {
                const key = canonicalToken(b.symbol);
                heldPctByToken.set(
                  key,
                  (heldPctByToken.get(key) ?? 0) + (b.value / portfolio.totalValue) * 100,
                );
              }
            }
          }
          const { score, legs: alignedLegs } = scorePlanAlignment(
            legs,
            heldPctByToken,
            portfolio.totalValue,
          );
          const feedback = alignedLegs.map((leg) => {
            if (leg.gap > 2) {
              return `⚠ ${leg.token}: ${Math.round(leg.gap)} pts light (${leg.held.toFixed(0)}% vs ${leg.target}%)`;
            }
            if (leg.gap < -2) {
              return `○ ${leg.token}: ${Math.round(-leg.gap)} pts over`;
            }
            return `✓ ${leg.token}: on target (${leg.held.toFixed(0)}%)`;
          });
          const lines = score == null ? ["No holdings to score yet"] : feedback;
          if (score != null && score < 60 && lines.length > 0) {
            showToast(`⚠️ Strategy drift detected: ${lines[0]}`, "warning");
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

        // Long-running synthesis (World Bank / IMF / DefiLlama) — keep the
        // original 30s budget so the rotating thinkingStep messages don't
        // give up before the LLM finishes.
        const response = await fetchWithTimeout(
          `${apiBase}/api/agent/advisor`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
          },
          ADVISOR_ANALYSIS_TIMEOUT_MS,
        );

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
          if (address && result.advice) {
            // Best-effort write of the analysis to guardian-state — 6s
            // budget is plenty for a same-origin POST and a hang here
            // shouldn't block the user from seeing the analysis result.
            // Uses cached auth only — never prompts for a signature.
            const proof = getCachedWalletAuth(address);
            if (proof) {
              fetchWithTimeout(
                `${apiBase}/api/vault/guardian-state`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Wallet-Auth-Message": encodeURIComponent(proof.message),
                    "X-Wallet-Auth-Signature": proof.signature,
                  },
                  body: JSON.stringify({
                    latestRecommendation: {
                      capturedAt: new Date().toISOString(),
                      source: "advisor-analysis",
                      action: result.advice.action,
                      targetToken: result.advice.targetToken || result.advice.token,
                      oneLiner: result.advice.oneLiner,
                      reasoning: result.advice.reasoning,
                      expectedSavings: result.advice.expectedSavings,
                      confidence: result.advice.confidence,
                      riskLevel: result.advice.riskLevel,
                      researchEvidence: result.advice.researchEvidence,
                    },
                  }),
                },
                GUARDIAN_STATE_TIMEOUT_MS,
              ).catch(() => {});
            }
          }
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
              researchEvidence: result.advice?.researchEvidence,
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
    [apiBase, capabilities.analysis, config, addActivity, addMessage, showToast, address],
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

        // Autonomous deep-analyze pulls multiple macro sources + the LLM
        // — 12s is the same budget the regular advisor got pre-fetchWithTimeout.
        const response = await fetchWithTimeout(
          `${apiBase}/api/agent/deep-analyze`,
          {
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
              userId: user?.id, // Pass authenticated user ID for Guardian Wallet flow
              signedPermission: signedPermission || undefined, // Phase 2A: Thread session permission
            }),
          },
          DEEP_ANALYZE_TIMEOUT_MS,
        );

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

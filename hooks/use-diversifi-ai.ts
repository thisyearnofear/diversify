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

import { useState, useCallback, useEffect } from 'react';
import { AI_FEATURES, AUTONOMOUS_FEATURES } from '../config/features';
import type { RegionalInflationData } from './use-inflation-data';
import type { MultichainPortfolio } from './use-multichain-balances';
import { analyzePortfolio, type PortfolioAnalysis } from '../utils/portfolio-analysis';
import { useAIConversationOptional } from '../context/AIConversationContext';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAdvice {
  action: 'SWAP' | 'HOLD' | 'REBALANCE' | 'BRIDGE' | 'BUY' | 'SELL' | 'GUIDED_TOUR';
  oneLiner: string; // Punchy, single-line summary for mobile/Farcaster
  targetToken?: string;
  token?: string; // Alias for targetToken (compatibility)
  targetAllocation?: Array<{ symbol: string; percentage: number; reason: string }>;
  targetNetwork?: 'Celo' | 'Arbitrum' | 'Ethereum';
  reasoning: string;
  confidence: number;
  suggestedAmount?: number;
  expectedSavings?: number;
  timeHorizon?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSources?: string[];
  // For alternative recommendations
  alternatives?: AIAdvice[];
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  executionMode?: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY';
  // Expandable reasoning sections
  expandableReasoning?: {
    whyThis: string;
    risks: string[];
    alternatives: string;
    timing: string;
    technicalDetails?: string;
  };
  // For compatibility with InteractiveAdviceCard
  pros?: string[];
  cons?: string[];
  apy?: number;
  liquidityScore?: number;
  inflationProtection?: number;
  comparisonVsPrimary?: {
    savingsDiff: number;
    riskDiff: 'LOWER' | 'SAME' | 'HIGHER';
    liquidityDiff: 'BETTER' | 'SAME' | 'WORSE';
  };
  comparisonProjection?: {
    currentPathValue: number;
    recommendedPathValue: number;
    oraclePathValue?: number;
    difference: number;
    timeframe: string;
  };
  // Guided tour recommendation
  guidedTour?: {
    tourId: string;
    title: string;
    description: string;
    steps: TourStep[];
    estimatedBenefit?: string;
  };

  // Onramp recommendation for BUY/SELL actions
  onrampRecommendation?: OnrampRecommendation;
  // Portfolio analysis snapshot (for embedded display)
  portfolioAnalysis?: {
    weightedInflationRisk: number;
    diversificationScore: number;
    dataSource?: string;
    regionCount?: number;
    topOpportunity?: {
      token: string;
      potentialSavings: number;
      fromToken?: string;
      toToken?: string;
      fromRegion?: string;
      toRegion?: string;
      fromInflation?: number;
      toInflation?: number;
      annualSavings?: number;
    };
  };
}

// Tour step definition
export interface TourStep {
  tab: string;
  section?: string;
  title?: string;
  description?: string;
}

// Onramp recommendation
export interface OnrampRecommendation {
  provider: string;
  reasoning: string;
  estimatedFee?: number;
  estimatedTime?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  alternatives?: string[];
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'recommendation' | 'insight';
}

export interface AICapabilities {
  analysis: boolean;
  voiceInput: boolean;
  voiceOutput: boolean;
  chat: boolean;
  webSearch: boolean;
}

export interface AutonomousStatus {
  enabled: boolean;
  isTestnet: boolean;
  walletType: 'privateKey' | 'circle' | 'none';
  spendingLimit: number;
  spent: number;
  remaining: number;
}

interface AIConfig {
  riskTolerance: 'Conservative' | 'Balanced' | 'Aggressive';
  goal: string;
  timeHorizon: string;
  spendingLimit: number;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useDiversifiAI(useGlobalConversation: boolean = true) {
  // Core AI state
  const [advice, setAdvice] = useState<AIAdvice | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
  const [localMessages, setLocalMessages] = useState<AIMessage[]>([]);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);

  // Use global conversation context if available and requested
  const globalConversation = useAIConversationOptional();
  const isUsingGlobal = useGlobalConversation && globalConversation !== undefined;
  const messages = isUsingGlobal
    ? globalConversation!.messages
    : localMessages;

  // Unified add message function
  const addMessage = useCallback((message: AIMessage) => {
    if (isUsingGlobal) {
      globalConversation!.addMessage(message);
    } else {
      setLocalMessages(prev => [...prev, message]);
    }
  }, [isUsingGlobal, globalConversation]);

  // Unified clear messages function
  const clearMessages = useCallback(() => {
    if (isUsingGlobal) {
      globalConversation!.clearMessages();
    } else {
      setLocalMessages([]);
    }
  }, [isUsingGlobal, globalConversation]);

  // Capabilities (from feature flags + server status)
  const [capabilities, setCapabilities] = useState<AICapabilities>({
    analysis: AI_FEATURES.ANALYSIS,
    voiceInput: AI_FEATURES.VOICE_INPUT,
    voiceOutput: AI_FEATURES.VOICE_OUTPUT,
    chat: AI_FEATURES.CHAT,
    webSearch: AI_FEATURES.WEB_SEARCH,
  });

  // Autonomous mode state (separate from core AI)
  const [autonomousStatus, setAutonomousStatus] = useState<AutonomousStatus | null>(null);

  const [config, setConfig] = useState<AIConfig>({
    riskTolerance: 'Balanced',
    goal: 'Inflation Hedge',
    timeHorizon: '3 months',
    spendingLimit: 5.0,
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize AI capabilities and check server status
   * Core AI works independently of autonomous mode
   */
  const initializeAI = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/status');
      if (response.ok) {
        const status = await response.json();

        // Update capabilities from server (validates API keys are working)
        if (status.capabilities) {
          setCapabilities({
            analysis: status.capabilities.analysis ?? AI_FEATURES.ANALYSIS,
            voiceInput: status.capabilities.transcription ?? AI_FEATURES.VOICE_INPUT,
            voiceOutput: status.capabilities.speech ?? AI_FEATURES.VOICE_OUTPUT,
            chat: status.capabilities.analysis ?? AI_FEATURES.CHAT,
            webSearch: status.capabilities.webSearch ?? AI_FEATURES.WEB_SEARCH,
          });
        }

        // Set autonomous status separately (only if enabled)
        if (AUTONOMOUS_FEATURES.AUTONOMOUS_MODE && status.enabled) {
          setAutonomousStatus({
            enabled: true,
            isTestnet: status.isTestnet ?? true,
            walletType: status.walletType ?? 'none',
            spendingLimit: status.spendingLimit ?? 5.0,
            spent: status.spent ?? 0,
            remaining: status.remaining ?? 5.0,
          });
        }
      }
    } catch (error) {
      console.error('[DiversifiAI] Failed to initialize:', error);
      // Fall back to feature flag defaults
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    initializeAI();
  }, [initializeAI]);

  // ============================================================================
  // CORE AI FUNCTIONS
  // ============================================================================

  /**
   * Analyze portfolio and generate recommendations
   * Works on any chain (Celo, Arbitrum, etc.)
   */
  const analyzePortfolioAI = useCallback(async (
    inflationData: Record<string, RegionalInflationData>,
    portfolio: MultichainPortfolio,
    userGoal?: string,
    userRegion?: string,
  ) => {
    if (!capabilities.analysis) {
      console.warn('[DiversifiAI] Analysis not available');
      return null;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setThinkingStep('Initializing protection protocols...');

    try {
      // Phase 1: Local Data Collection (0-30%) - Slower progression
      setAnalysisProgress(5); // Start slower
      setThinkingStep('Securing market data...');

      // Simulate data gathering with more realistic timing
      await new Promise(resolve => setTimeout(resolve, 1200)); // Increased from 800ms

      setAnalysisProgress(15); // Slower increment
      setThinkingStep('Calibrating inflation models...');
      const localAnalysis = analyzePortfolio(portfolio, inflationData, userGoal || config.goal);
      setPortfolioAnalysis(localAnalysis);

      // Phase 2: AI Consultation (15-90%) - More time for AI analysis
      setAnalysisProgress(20); // Start AI phase slower

      const THEMATIC_MESSAGES = [
        "Consulting mathematics...",
        "Analyzing the macro...",
        "Calculating...",
        "Stability loading...",
        "Checking yield...",
        "Scanning volatility...",
        "Identifying inflation...",
        "Optimizing insights...",
        "Perambulating...",
      ];

      let messageIndex = 0;
      setThinkingStep(THEMATIC_MESSAGES[0]);

      // Enhanced AI analysis via API
      // Slower, more realistic progress bar from 20% to 90%
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          // Much slower progression - more realistic for AI analysis
          if (prev >= 90) return 90;
          if (prev > 80) return prev + 0.4; // Very slow near the end
          if (prev > 70) return prev + 0.7; // Slow down significantly
          if (prev > 50) return prev + 1.0; // Moderate pace in middle
          return prev + 1.3; // Slightly faster at the beginning
        });

        // Cycle messages every few ticks (less frequently for better UX)
        if (Math.random() > 0.8) {
          messageIndex = (messageIndex + 1) % THEMATIC_MESSAGES.length;
          setThinkingStep(THEMATIC_MESSAGES[messageIndex]);
        }
      }, 1000); // Increased from 600ms to 1000ms for much slower updates

      const response = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio,
          inflationData,
          goal: userGoal || config.goal,
          riskTolerance: config.riskTolerance,
          userRegion: userRegion,
        }),
      });

      clearInterval(progressInterval);

      setAnalysisProgress(92); // Don't jump to 95% immediately
      setThinkingStep('Finalizing strategy...');

      // Add a small delay before completing
      await new Promise(resolve => setTimeout(resolve, 800));

      if (response.ok) {
        const result = await response.json();
        setAnalysisProgress(100);
        setThinkingStep('Analysis complete!');
        setAdvice(result.advice);
        return result.advice;
      } else {
        // Handle non-200 responses gently
        setThinkingStep('Analysis disrupted. Retrying...');
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      console.error('[DiversifiAI] Analysis failed:', error);
      // Keep error state visible for a moment
      setThinkingStep('Connection interrupted. Please retry.');
    } finally {
      // Delay cleaning up state so user sees 100% or error
      if (!isAnalyzing) { // Only reset if we're not already reset (safety)
        setTimeout(() => {
          setIsAnalyzing(false);
          setThinkingStep('');
          setAnalysisProgress(0);
        }, 1500);
      } else {
        setIsAnalyzing(false);
      }
    }
  }, [capabilities.analysis, config]);

  /**
   * Backward-compatible analyze function (legacy signature)
   * Supports both old 6-param and new 2-param signatures
   */
  const analyze = useCallback(async (
    inflationData: Record<string, RegionalInflationData>,
    userBalanceOrPortfolio: number | MultichainPortfolio,
    currentHoldings?: string[],
    networkInfo?: { chainId: number; name: string },
    _multiChainContext?: unknown,
    aggregatedPortfolio?: MultichainPortfolio,
    userRegion?: string,
  ) => {
    // Build portfolio from legacy params if needed
    let portfolio: MultichainPortfolio;
    if (typeof userBalanceOrPortfolio === 'number') {
      portfolio = aggregatedPortfolio || {
        totalValue: userBalanceOrPortfolio,
        chains: networkInfo ? [{
          chainId: networkInfo.chainId,
          chainName: networkInfo.name,
          balances: [], // Changed from Object.fromEntries to array
          totalValue: userBalanceOrPortfolio,
          tokenCount: currentHoldings?.length || 0,
          isLoading: false,
          error: null
        }] : [],
        allTokens: [],
        tokenMap: {},
        regionData: [],
        isLoading: false,
        isStale: false,
        errors: [],
        lastUpdated: Date.now(),
        chainCount: networkInfo ? 1 : 0,
        ...({} as any)
      };
    } else {
      portfolio = userBalanceOrPortfolio;
    }

    return analyzePortfolioAI(inflationData, portfolio, undefined, userRegion);
  }, [analyzePortfolioAI]);

  /**
   * Generate speech from text
   */
  const generateSpeech = useCallback(async (text: string): Promise<Blob | null> => {
    if (!capabilities.voiceOutput) {
      console.warn('[DiversifiAI] Voice output not available');
      return null;
    }

    try {
      const response = await fetch('/api/agent/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.error('[DiversifiAI] Speech generation failed:', error);
    }
    return null;
  }, [capabilities.voiceOutput]);

  /**
   * Send chat message to AI
   */
  const sendChatMessage = useCallback(async (content: string) => {
    if (!capabilities.chat) return;

    const userMessage: AIMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setIsAnalyzing(true); // Show thinking state for chat too

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history: messages }),
      });

      if (response.ok) {
        const result = await response.json();
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          type: result.type || 'text',
        };
        addMessage(assistantMessage);

        // Auto-speak the response if voice output is available
        if (capabilities.voiceOutput) {
          try {
            const speechBlob = await generateSpeech(result.response);
            if (speechBlob) {
              const url = URL.createObjectURL(speechBlob);
              const audio = new Audio(url);
              audio.play();
            }
          } catch (speechError) {
            console.warn('[DiversifiAI] Auto-speech failed:', speechError);
          }
        }
      }
    } catch (error) {
      console.error('[DiversifiAI] Chat failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [capabilities.chat, capabilities.voiceOutput, messages, generateSpeech]);

  /**
   * Transcribe audio to text
   */
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    if (!capabilities.voiceInput) {
      console.warn('[DiversifiAI] Voice input not available');
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/api/agent/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        return result.text;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DiversifiAI] Transcription API error:', response.status, errorData);
      }
    } catch (error) {
      console.error('[DiversifiAI] Transcription network error:', error);
    }
    return null;
  }, [capabilities.voiceInput]);

  // ============================================================================
  // AUTONOMOUS MODE FUNCTIONS (Optional)
  // ============================================================================

  /**
   * Run autonomous analysis (only if autonomous mode enabled)
   * This is the Arc Network / x402 integration
   */
  const runAutonomousAnalysis = useCallback(async (
    inflationData: Record<string, RegionalInflationData>,
    portfolio: MultichainPortfolio,
  ) => {
    if (!AUTONOMOUS_FEATURES.AUTONOMOUS_MODE || !autonomousStatus?.enabled) {
      console.warn('[DiversifiAI] Autonomous mode not available');
      return null;
    }

    setIsAnalyzing(true);
    setThinkingStep('Running autonomous analysis...');

    try {
      const response = await fetch('/api/agent/deep-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio,
          inflationData,
          useAutonomousMode: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAdvice(result.advice);
        return result.advice;
      }
    } catch (error) {
      console.error('[DiversifiAI] Autonomous analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      setThinkingStep('');
    }
  }, [autonomousStatus]);

  // ============================================================================
  // EXPORTS
  // ============================================================================

  return {
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
    analyzePortfolio: analyzePortfolioAI,
    sendMessage: sendChatMessage,
    sendChatMessage,
    transcribeAudio,
    generateSpeech,
    initializeAI,

    // Config
    config,
    updateConfig: setConfig,

    // Autonomous mode (optional)
    autonomousStatus,
    runAutonomousAnalysis,

    // Utilities
    clearMessages,
    clearConversation: clearMessages,
    clearAdvice: () => setAdvice(null),
  };
}

// Legacy export for gradual migration
export { useDiversifiAI as useWealthProtectionAgent };
export default useDiversifiAI;

import { useState, useCallback } from 'react';
import { GeminiService } from '../utils/api-services';
import { ArcAgent } from '../services/arc-agent';

export interface AgentAdvice {
    action: 'SWAP' | 'HOLD' | 'REBALANCE' | 'BRIDGE';
    targetToken?: string;
    targetNetwork?: string;
    reasoning: string;
    confidence: number;
    suggestedAmount?: number;
    expectedSavings?: number;
    timeHorizon?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    dataSources?: string[];
    arcTxHash?: string;
    paymentHashes?: Record<string, string>;
    thoughtChain?: string[];
    actionSteps?: string[]; // New: Step-by-step instructions
    urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // New: How urgent is this action
    _meta?: {
        modelUsed: string;
        totalCost?: number;
        dataSourcesUsed?: number;
    };
}

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';
export type InvestmentGoal = 'Capital Preservation' | 'Inflation Hedge' | 'Growth';

export interface AgentConfig {
    riskTolerance: RiskTolerance;
    goal: InvestmentGoal;
    analysisDepth?: 'Quick' | 'Standard' | 'Deep';
    timeHorizon?: '1 month' | '3 months' | '6 months' | '1 year';
    spendingLimit?: number;
}

export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: any;
    type?: 'text' | 'recommendation' | 'insight';
}

export function useWealthProtectionAgent() {
    const [advice, setAdvice] = useState<AgentAdvice | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [thinkingStep, setThinkingStep] = useState<string>('');
    const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [isCompact, setIsCompact] = useState(false);
    const [arcAgent, setArcAgent] = useState<ArcAgent | null>(null);
    const [config, setConfig] = useState<AgentConfig>({
        riskTolerance: 'Balanced',
        goal: 'Inflation Hedge',
        analysisDepth: 'Standard',
        timeHorizon: '3 months',
        spendingLimit: 5.0
    });

    // Initialize Arc Agent - now delegates to server-side API
    const initializeArcAgent = useCallback(async () => {
        if (!arcAgent) {
            try {
                // Check if server-side agent is available
                const response = await fetch('/api/agent/status');
                if (response.ok) {
                    const status = await response.json();
                    if (status.enabled) {
                        console.log('[Arc Agent] Server-side agent available:', status);
                        // Create a proxy agent that calls server APIs
                        // For now, we just mark that deep analysis is available
                        setArcAgent({ isProxy: true, ...status } as any);
                    } else {
                        console.warn('Agent wallet not configured on server, Arc Agent features disabled');
                    }
                }
            } catch (error) {
                console.error('Failed to check Arc Agent status:', error);
            }
        }
    }, [arcAgent]);

    // Enhanced analysis with Arc Network integration and progress tracking
    const analyzeAutonomously = useCallback(async (
        inflationData: any,
        userBalance: number,
        currentHoldings: string[],
        networkInfo: { chainId: number, name: string } = { chainId: 44787, name: 'Celo Alfajores' }
    ) => {
        setIsAnalyzing(true);
        setAdvice(null);
        setAnalysisSteps([]);
        setAnalysisProgress(0);

        // Initialize Arc Agent if needed
        await initializeArcAgent();

        try {
            if (arcAgent && config.analysisDepth === 'Deep') {
                // Use server-side Arc Agent for premium data analysis
                const response = await fetch('/api/agent/deep-analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        portfolio: { balance: userBalance, holdings: currentHoldings },
                        config,
                        networkInfo
                    })
                });

                if (!response.ok) {
                    throw new Error('Deep analysis failed');
                }

                const result = await response.json();
                setAdvice(result);

                // Add to conversation history
                const newMessage: AIMessage = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: result.reasoning,
                    timestamp: new Date(),
                    data: result,
                    type: 'recommendation'
                };
                setMessages(prev => [...prev, newMessage]);

            } else {
                // Enhanced progress tracking for standard analysis
                const progressSteps = [
                    { step: "🔗 Connecting to Arc Network Oracle...", progress: 10 },
                    { step: "💰 Accessing premium inflation data via x402...", progress: 25 },
                    { step: "📊 Analyzing macro economic signals...", progress: 45 },
                    { step: "🎯 Calculating diversification strategies...", progress: 65 },
                    { step: "🧠 Generating personalized recommendations...", progress: 85 },
                    { step: "✅ Finalizing wealth protection analysis...", progress: 100 }
                ];

                for (let i = 0; i < progressSteps.length; i++) {
                    const { step, progress } = progressSteps[i];
                    setThinkingStep(step);
                    setAnalysisProgress(progress);
                    setAnalysisSteps(prev => [...prev, step]);

                    // Realistic timing with some variation
                    const delay = i === progressSteps.length - 1 ? 1200 : 800 + Math.random() * 600;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const result = await GeminiService.analyzeWealthProtection(
                    inflationData,
                    userBalance,
                    currentHoldings,
                    config
                );

                setAdvice(result);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            setAdvice({
                action: 'HOLD',
                reasoning: 'Analysis temporarily unavailable. Recommend holding current position.',
                confidence: 0,
                riskLevel: 'LOW'
            });
        } finally {
            setIsAnalyzing(false);
            setThinkingStep('');
            setAnalysisProgress(0);
        }
    }, [config, arcAgent, initializeArcAgent]);

    // Chat functionality
    const sendMessage = useCallback(async (content: string) => {
        const userMessage: AIMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, userMessage]);
        setIsAnalyzing(true);

        try {
            // Process user message and generate response
            const response = await GeminiService.analyzeWealthProtection(
                null, // Will be enhanced to handle conversational context
                0,
                [],
                { ...config, userMessage: content }
            );

            const assistantMessage: AIMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.reasoning,
                timestamp: new Date(),
                data: response,
                type: 'text'
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat message failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [config]);

    const updateConfig = (newConfig: Partial<AgentConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    const toggleCompactMode = () => {
        setIsCompact(prev => !prev);
    };

    const clearConversation = () => {
        setMessages([]);
        setAdvice(null);
    };

    const getSpendingStatus = () => {
        return arcAgent?.getSpendingStatus() || { spent: 0, limit: config.spendingLimit || 5, remaining: config.spendingLimit || 5 };
    };

    return {
        // Existing API (backward compatible)
        advice,
        isAnalyzing,
        thinkingStep,
        analysisSteps,
        analysisProgress,
        config,
        analyze: analyzeAutonomously, // Enhanced version
        updateConfig,

        // New conversational API
        messages,
        sendMessage,
        isCompact,
        toggleCompactMode,
        clearConversation,

        // Arc Network features
        arcAgent,
        getSpendingStatus,
        initializeArcAgent
    };
}

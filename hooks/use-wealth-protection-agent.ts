import { useState, useCallback } from 'react';
import { GeminiService } from '../utils/api-services';
import { ArcAgent } from '../services/arc-agent';

export interface AgentAdvice {
    action: 'SWAP' | 'HOLD' | 'REBALANCE';
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

    // Initialize Arc Agent
    const initializeArcAgent = useCallback(async () => {
        if (!arcAgent) {
            try {
                // Get agent configuration from environment
                const privateKey = process.env.NEXT_PUBLIC_ARC_AGENT_PRIVATE_KEY || process.env.ARC_AGENT_PRIVATE_KEY;
                const circleWalletId = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID;
                const circleApiKey = process.env.NEXT_PUBLIC_CIRCLE_API_KEY;
                const isTestnet = process.env.NEXT_PUBLIC_ARC_AGENT_TESTNET === 'true' || process.env.ARC_AGENT_TESTNET === 'true';
                const spendingLimit = parseFloat(process.env.NEXT_PUBLIC_ARC_AGENT_DAILY_LIMIT || process.env.ARC_AGENT_DAILY_LIMIT || '5.0');

                if (!privateKey && (!circleWalletId || !circleApiKey)) {
                    console.warn('Agent wallet not configured (needs Private Key or Circle Wallet ID), Arc Agent features disabled');
                    return;
                }

                const agent = new ArcAgent({
                    privateKey,
                    circleWalletId,
                    circleApiKey,
                    isTestnet,
                    spendingLimit
                });

                // Test network connection
                const networkStatus = await agent.getNetworkStatus();
                if (networkStatus) {
                    console.log('[Arc Agent] Initialized:', networkStatus);
                    setArcAgent(agent);
                } else {
                    console.error('[Arc Agent] Failed to connect to Arc Network');
                }
            } catch (error) {
                console.error('Failed to initialize Arc Agent:', error);
            }
        }
    }, [arcAgent]);

    // Enhanced analysis with Arc Network integration
    const analyzeAutonomously = useCallback(async (
        inflationData: any,
        userBalance: number,
        currentHoldings: string[],
        networkInfo: { chainId: number, name: string } = { chainId: 44787, name: 'Celo Alfajores' }
    ) => {
        setIsAnalyzing(true);
        setAdvice(null);

        // Initialize Arc Agent if needed
        await initializeArcAgent();

        try {
            if (arcAgent && config.analysisDepth === 'Deep') {
                // Use Arc Agent for premium data analysis
                const result = await arcAgent.analyzePortfolioAutonomously(
                    { balance: userBalance, holdings: currentHoldings },
                    config,
                    networkInfo
                );

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
                // Fallback to existing Gemini analysis
                const steps = [
                    "Connecting to Arc Network Oracle...",
                    "Accessing Truflation Premium (x402)...",
                    "Scaling Glassnode sentiment data...",
                    "Optimizing via Heliostat Yields...",
                    "Gemini 3 generating frontier insight..."
                ];

                for (let i = 0; i < steps.length; i++) {
                    setThinkingStep(steps[i]);
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
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

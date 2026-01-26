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
    actionSteps?: string[];
    urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    comparisonProjection?: {
        currentPathValue: number;
        oraclePathValue: number;
        lossPeriod: string;
    };
    _meta?: {
        modelUsed: string;
        totalCost?: number;
        dataSourcesUsed?: number;
    };
}

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';
export type InvestmentGoal = 'Capital Preservation' | 'Inflation Hedge' | 'Growth';
export type UserGoal = 'inflation_protection' | 'geographic_diversification' | 'rwa_access' | 'exploring';

export interface AgentConfig {
    riskTolerance: RiskTolerance;
    goal: InvestmentGoal;
    userGoal?: UserGoal;
    analysisDepth?: 'Quick' | 'Standard' | 'Deep';
    timeHorizon?: '1 month' | '3 months' | '6 months' | '1 year';
    spendingLimit?: number;
}

// Multi-chain portfolio context for the agent
export interface MultiChainContext {
    currentChain: { chainId: number; name: string };
    aggregatedPortfolio?: {
        totalValue: number;
        chains: { chainId: number; chainName: string; totalValue: number; holdings: string[] }[];
        allHoldings: string[];
        diversificationScore: number;
    };
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
    const [capabilities, setCapabilities] = useState<{ analysis: boolean, transcription: boolean, speech: boolean }>({
        analysis: false,
        transcription: false,
        speech: false
    });
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
                    if (status.capabilities) {
                        setCapabilities(status.capabilities);
                    }
                    if (status.enabled) {
                        console.log('[Arc Agent] Server-side agent available:', status);
                        // Create a proxy agent that calls server APIs
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
        networkInfo: { chainId: number, name: string } = { chainId: 44787, name: 'Celo Alfajores' },
        multiChainContext?: MultiChainContext
    ) => {
        setIsAnalyzing(true);
        setAdvice(null);
        setAnalysisSteps([]);
        setAnalysisProgress(0);

        // Initialize Arc Agent if needed
        try {
            setThinkingStep("🤖 Initializing AI Agent...");
            setAnalysisProgress(5);
            await initializeArcAgent();
        } catch (initError) {
            console.warn("Agent initialization failed:", initError);
        }

        try {
            if (arcAgent && config.analysisDepth === 'Deep') {
                // Progress steps for Deep Analysis
                const deepProgressSteps = [
                    { step: "🛡️ Securing Arc Testnet environment...", progress: 15 },
                    { step: "💰 Verifying USDC gas for autonomous payments...", progress: 30 },
                    { step: "📡 Connecting to Premium Data Hub (x402)...", progress: 50 },
                    { step: "🧬 Processing multi-chain risk models...", progress: 75 },
                    { step: "🤖 Finalizing deep analysis with Gemini 3...", progress: 95 }
                ];

                const progressInterval = setInterval(() => {
                    setAnalysisProgress(prev => (prev < 90 ? prev + 2 : prev));
                }, 1000);

                setThinkingStep(deepProgressSteps[0].step);
                setAnalysisProgress(deepProgressSteps[0].progress);
                setAnalysisSteps([deepProgressSteps[0].step]);

                const responsePromise = fetch('/api/agent/deep-analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        portfolio: { balance: userBalance, holdings: currentHoldings },
                        config,
                        networkInfo,
                        multiChainContext
                    })
                });

                for (let i = 1; i < deepProgressSteps.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    setThinkingStep(deepProgressSteps[i].step);
                    setAnalysisProgress(deepProgressSteps[i].progress);
                    setAnalysisSteps(prev => [...prev, deepProgressSteps[i].step]);
                }

                const response = await responsePromise;
                clearInterval(progressInterval);

                if (!response.ok) throw new Error('Deep analysis failed');
                const result = await response.json();
                setAdvice(result);

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
                // Standard analysis progress
                const progressSteps = [
                    { step: "🔗 Connecting to Arc Network Oracle...", progress: 10 },
                    { step: "💰 Accessing premium inflation data via x402...", progress: 25 },
                    { step: "📊 Analyzing macro economic signals...", progress: 45 },
                    { step: "🎯 Calculating diversification strategies...", progress: 65 },
                    { step: "🧠 Generating personalized recommendations...", progress: 85 },
                    { step: "🛡️ Finalizing wealth protection model...", progress: 95 },
                    { step: "✅ Analysis complete!", progress: 100 }
                ];

                for (let i = 0; i < progressSteps.length; i++) {
                    const { step, progress } = progressSteps[i];
                    setThinkingStep(step);
                    setAnalysisProgress(progress);
                    setAnalysisSteps(prev => [...prev, step]);
                    const delay = i === progressSteps.length - 1 ? 800 : 600 + Math.random() * 400;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                const result = await GeminiService.analyzeWealthProtection(
                    inflationData,
                    userBalance,
                    currentHoldings,
                    { ...config, multiChainContext, networkInfo }
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
        setAdvice(null); // Clear old advice when starting new chat analysis

        try {
            const response = await GeminiService.analyzeWealthProtection(
                null,
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
                type: 'recommendation'
            };

            setAdvice(response);
            setMessages(prev => [...prev, assistantMessage]);

            // Optional: Speak the reasoning back to the user
            if (response.reasoning) {
                generateSpeech(response.reasoning);
            }
        } catch (error) {
            console.error('Chat message failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [config]);

    // Voice: Transcribe audio blob to text
    const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
        setIsAnalyzing(true);
        setThinkingStep("🎙️ Transcribing voice...");

        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'query.webm');

            const response = await fetch('/api/agent/transcribe', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const { text } = await response.json();
                return text;
            }
            return null;
        } catch (error) {
            console.error('Transcription failed:', error);
            return null;
        } finally {
            setIsAnalyzing(false);
            setThinkingStep("");
        }
    }, []);

    // Voice: Generate speech from text and play it
    const generateSpeech = useCallback(async (text: string) => {
        try {
            const response = await fetch('/api/agent/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.play();
            }
        } catch (error) {
            console.error('Speech synthesis failed:', error);
        }
    }, []);

    const updateConfig = (newConfig: Partial<AgentConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    return {
        advice,
        isAnalyzing,
        thinkingStep,
        analysisSteps,
        analysisProgress,
        config,
        analyze: analyzeAutonomously,
        updateConfig,
        messages,
        sendMessage,
        transcribeAudio,
        generateSpeech,
        isCompact,
        toggleCompactMode: () => setIsCompact(p => !p),
        clearConversation: () => { setMessages([]); setAdvice(null); },
        arcAgent,
        capabilities,
        getSpendingStatus: () => arcAgent?.getSpendingStatus() || { spent: 0, limit: config.spendingLimit || 5, remaining: config.spendingLimit || 5 },
        initializeArcAgent
    };
}

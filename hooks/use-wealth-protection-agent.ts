import { useState, useCallback } from 'react';
import { GeminiService } from '../utils/api-services';

export interface AgentAdvice {
    action: 'SWAP' | 'HOLD';
    targetToken?: string;
    reasoning: string;
    confidence: number;
    suggestedAmount?: number;
    _meta?: {
        modelUsed: string;
    };
}

export type RiskTolerance = 'Conservative' | 'Balanced' | 'Aggressive';
export type InvestmentGoal = 'Capital Preservation' | 'Inflation Hedge' | 'Growth';

export interface AgentConfig {
    riskTolerance: RiskTolerance;
    goal: InvestmentGoal;
}

export function useWealthProtectionAgent() {
    const [advice, setAdvice] = useState<AgentAdvice | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [thinkingStep, setThinkingStep] = useState<string>('');
    const [config, setConfig] = useState<AgentConfig>({
        riskTolerance: 'Balanced',
        goal: 'Inflation Hedge'
    });

    const steps = [
        "Connecting to Arc Network node...",
        "Scanning cross-chain liquidity pools...",
        "Fetching global consumer price indices...",
        "Measuring regional currency volatility...",
        "Running risk simulation on current holdings...",
        "Optimizing for " + config.riskTolerance.toLowerCase() + " strategy...",
        "Synthesizing final recommendation..."
    ];

    const analyze = useCallback(async (
        inflationData: any,
        userBalance: number,
        currentHoldings: string[]
    ) => {
        setIsAnalyzing(true);
        setAdvice(null);

        // Iterate through steps for better UX "feeling" of work
        for (let i = 0; i < steps.length; i++) {
            setThinkingStep(steps[i]);
            // Simulated delay for each "thought"
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        }

        try {
            const result = await GeminiService.analyzeWealthProtection(
                inflationData,
                userBalance,
                currentHoldings,
                config
            );
            setAdvice(result);
        } catch (e) {
            console.error("Agent failed", e);
        } finally {
            setIsAnalyzing(false);
            setThinkingStep('');
        }
    }, [config]);

    const updateConfig = (newConfig: Partial<AgentConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    return {
        advice,
        isAnalyzing,
        thinkingStep,
        config,
        analyze,
        updateConfig
    };
}

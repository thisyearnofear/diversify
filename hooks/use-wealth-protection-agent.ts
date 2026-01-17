
import { useState, useCallback } from 'react';
import { GeminiService } from '../utils/api-services';

export interface AgentAdvice {
    action: 'SWAP' | 'HOLD';
    targetToken?: string;
    reasoning: string;
    confidence: number;
    suggestedAmount?: number;
}

export function useWealthProtectionAgent() {
    const [advice, setAdvice] = useState<AgentAdvice | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const analyze = useCallback(async (
        inflationData: any,
        userBalance: number,
        currentHoldings: string[]
    ) => {
        setIsAnalyzing(true);
        try {
            const result = await GeminiService.analyzeWealthProtection(
                inflationData,
                userBalance,
                currentHoldings
            );
            setAdvice(result);
        } catch (e) {
            console.error("Agent failed", e);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    return {
        advice,
        isAnalyzing,
        analyze
    };
}

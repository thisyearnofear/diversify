import { AIService } from '../ai/ai-service';
import type { AnalysisResult } from '../agent-service';
import type { GuardianAnalysisContext } from './guardian-analysis-data.service';

type RecommendationShape = Partial<AnalysisResult> & {
  action?: string;
  targetToken?: string;
  targetNetwork?: string;
  confidence?: number;
  expectedSavings?: number;
  riskLevel?: string;
  actionSteps?: string[];
};

export class GuardianRecommendationService {
  static buildPrompt(context: GuardianAnalysisContext): string {
    return `
You are ArcAgent, an autonomous AI financial analyst with access to premium verified data.
Analyze the following data and provide a portfolio recommendation.

PORTFOLIO:
- Balance: ${context.unifiedBalance.totalUSDC} USDC
- Holdings: ${context.portfolioData.holdings.join(', ')}

MARKET PULSE:
- Sentiment: ${context.pulse.sentiment}
- AI Momentum: ${context.pulse.aiMomentum}
- War Risk: ${context.pulse.warRisk}
- Liquidation Risk: ${context.pulse.liquidationRisk}%

TRUFLATION / MACRO:
${JSON.stringify(context.inflationResult.data, null, 2)}
${JSON.stringify(context.economicResult.data, null, 2)}

SYNTHDATA FORECASTS:
${JSON.stringify(context.synthPredictions, null, 2)}

YIELD OPPORTUNITIES:
${JSON.stringify(context.yieldResult.data, null, 2)}

TASK:
Provide a JSON response with:
- action: 'SWAP', 'REBALANCE', 'HOLD', or 'BRIDGE'
- targetToken: (if applicable)
- targetNetwork: 'Arc' | 'Arbitrum' | 'Celo'
- confidence: 0-1
- reasoning: A detailed explanation leveraging the data above
- riskLevel: 'LOW', 'MEDIUM', 'HIGH'
- expectedSavings: Estimated alpha generated
`;
  }

  static async generateRecommendation(
    context: GuardianAnalysisContext,
    parseRecommendation: (content: string) => RecommendationShape,
  ): Promise<RecommendationShape> {
    const prompt = this.buildPrompt(context);
    const aiResponse = await AIService.chat({
      messages: [{ role: 'system', content: prompt }],
      responseMimeType: 'application/json'
    });

    return parseRecommendation(aiResponse.content);
  }

  static buildFinalResult(params: {
    recommendation: RecommendationShape;
    normalizedAction: AnalysisResult['action'];
    normalizeNumber: (value: any, fallback: number, min?: number, max?: number) => number;
    normalizeRiskLevel: (value: any) => AnalysisResult['riskLevel'];
    determineUrgency: (analysis: Partial<AnalysisResult>, portfolioValue?: number) => AnalysisResult['urgencyLevel'];
    portfolioValue: number;
    dataSources: string[];
    paymentHashes: Record<string, string>;
    steps: string[];
    executionTxHash?: string;
    evidenceCids?: Record<string, string>;
  }): AnalysisResult {
    const {
      recommendation,
      normalizedAction,
      normalizeNumber,
      normalizeRiskLevel,
      determineUrgency,
      portfolioValue,
      dataSources,
      paymentHashes,
      evidenceCids,
      steps,
      executionTxHash,
    } = params;

    const confidence = normalizeNumber(recommendation.confidence, 0.8, 0, 1);
    const expectedSavings = normalizeNumber(recommendation.expectedSavings, 0, 0);
    const riskLevel = normalizeRiskLevel(recommendation.riskLevel);
    const urgencyLevel = determineUrgency({ action: normalizedAction, expectedSavings }, portfolioValue);
    const actionSteps = Array.isArray(recommendation.actionSteps) ? recommendation.actionSteps : [];

    return {
      action: normalizedAction,
      targetToken: recommendation.targetToken,
      confidence,
      reasoning: recommendation.reasoning || "Balanced hold strategy based on current macro stability.",
      expectedSavings,
      timeHorizon: '7D',
      riskLevel,
      dataSources,
      paymentHashes,
      executionMode: executionTxHash ? 'MAINNET_READY' : 'ADVISORY',
      actionSteps: steps.concat(actionSteps),
      urgencyLevel,
      arcTxHash: executionTxHash,
      evidenceCids,
    };
  }
}

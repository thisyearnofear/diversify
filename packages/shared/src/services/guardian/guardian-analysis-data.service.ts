import { marketPulseService } from '../../utils/market-pulse-service';
import { getDefaultArcResearchBundleSources, type ArcResearchBundle } from '../../utils/arc-research-sources';

export type GuardianAnalysisContext = {
  portfolioData: { balance: number; holdings: string[] };
  unifiedBalance: any;
  macroData: any;
  researchBundle?: ArcResearchBundle;
  inflationResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> };
  economicResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> };
  yieldResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> };
  pulse: Awaited<ReturnType<typeof marketPulseService.getMarketPulse>>;
  riskStatus: any;
};

export class GuardianAnalysisDataService {
  static async gatherContext(params: {
    portfolioData: { balance: number; holdings: string[] };
    spendingLimit: number;
    steps: string[];
    dataSources: string[];
    paymentHashes: Record<string, string>;
    getUnifiedUSDCBalance: () => Promise<any>;
    fetchWithNanopayment: (url: string, payment: { amount: string; currency: 'USDC' }) => Promise<Response>;
    fetchInflationData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string>; storageCids?: Record<string, string> }>;
    fetchEconomicData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string>; storageCids?: Record<string, string> }>;
    fetchYieldData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string>; storageCids?: Record<string, string> }>;
    getFallbackRecommendation: () => any;
  }): Promise<{ context?: GuardianAnalysisContext; earlyResult?: any }> {
    const {
      portfolioData,
      spendingLimit,
      steps,
      dataSources,
      paymentHashes,
      getUnifiedUSDCBalance,
      fetchWithNanopayment,
      fetchInflationData,
      fetchEconomicData,
      fetchYieldData,
      getFallbackRecommendation,
    } = params;

    steps.push("Analyzing capital efficiency across chains...");
    const unifiedBalance = await getUnifiedUSDCBalance();
    const balance = parseFloat(unifiedBalance.arcBalance || '0');
    console.log(`[Arc Agent] Capital efficiency check: Total ${unifiedBalance.totalUSDC} USDC`);

    if (!Number.isFinite(balance) || !Number.isFinite(spendingLimit) || spendingLimit <= 0 || balance < spendingLimit) {
      steps.push("Research funding unavailable on Arc. Analysis does not move funds between chains.");
      return {
        earlyResult: {
          ...getFallbackRecommendation(),
          action: 'HOLD',
          executionMode: 'ADVISORY',
          arcTxHash: undefined,
          actionSteps: [...steps],
        },
      };
    }

    let macroData: any = {};
    let inflationResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> } = { data: {}, hashes: {}, storageCids: {} };
    let economicResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> } = { data: {}, hashes: {}, storageCids: {} };
    let yieldResult: { data: any; hashes: Record<string, string>; storageCids?: Record<string, string> } = { data: {}, hashes: {}, storageCids: {} };
    let researchBundle: ArcResearchBundle | undefined;

    try {
      const bundleSources = getDefaultArcResearchBundleSources();
      steps.push("Purchasing market intelligence bundle via Nanopayments...");
      const bundleResponse = await fetchWithNanopayment(
        `/api/agent/x402-gateway?sources=${bundleSources.join(',')}`,
        {
          amount: '0.05',
          currency: 'USDC'
        }
      );

      const bundlePayload = await bundleResponse.json();
      const bundleRecords = Array.isArray(bundlePayload?.bundle?.sources)
        ? bundlePayload.bundle.sources
        : [];

      if (bundleResponse.headers.get('x-payment-proof')) {
        paymentHashes['Arc Research Bundle'] = bundleResponse.headers.get('x-payment-proof')!;
      }

      researchBundle = bundlePayload?.bundle;
      macroData = bundlePayload;
      dataSources.push(...bundleRecords.map((record: any) => record.label || record.sourceId));

      const groupedRecords = bundleRecords.reduce((acc: Record<string, Record<string, any>>, record: any) => {
        const dataType = record.dataType || 'economic';
        if (!acc[dataType]) {
          acc[dataType] = {};
        }
        acc[dataType][record.sourceId || record.label] = record.data;
        return acc;
      }, {});

      inflationResult = { data: groupedRecords.inflation || {}, hashes: {}, storageCids: {} };
      economicResult = { data: groupedRecords.economic || {}, hashes: {}, storageCids: {} };
      yieldResult = { data: groupedRecords.yield || {}, hashes: {}, storageCids: {} };
    } catch (error) {
      console.warn('[Arc Agent] Research bundle unavailable, falling back to individual sources:', error);
      steps.push("Research bundle unavailable, falling back to individual sources...");
      steps.push("Fetching real-time inflation data...");
      inflationResult = await fetchInflationData(steps, dataSources);
      Object.assign(paymentHashes, inflationResult.hashes);

      steps.push("Accessing premium economic indicators...");
      economicResult = await fetchEconomicData(steps, dataSources);
      Object.assign(paymentHashes, economicResult.hashes);

      steps.push("Scanning DeFi yield opportunities...");
      yieldResult = await fetchYieldData(steps, dataSources);
      Object.assign(paymentHashes, yieldResult.hashes);
    }

    steps.push("Synth sunset: probabilistic forecasts removed (was SynthData)...");

    const pulse = await marketPulseService.getMarketPulse();
    // Observing risk is not permission to open a hedge.
    const riskStatus = { status: 'ADVISORY' };

    return {
      context: {
        portfolioData,
        unifiedBalance,
        macroData,
        researchBundle,
        inflationResult,
        economicResult,
        yieldResult,
        pulse,
        riskStatus,
      }
    };
  }
}

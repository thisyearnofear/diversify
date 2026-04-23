import { SynthDataService } from '../synth-data-service';
import { marketPulseService } from '../../utils/market-pulse-service';
import { getDefaultArcResearchBundleSources, type ArcResearchBundle } from '../../utils/arc-research-sources';

export type GuardianAnalysisContext = {
  portfolioData: { balance: number; holdings: string[] };
  unifiedBalance: any;
  macroData: any;
  researchBundle?: ArcResearchBundle;
  inflationResult: { data: any; hashes: Record<string, string> };
  economicResult: { data: any; hashes: Record<string, string> };
  yieldResult: { data: any; hashes: Record<string, string> };
  synthPredictions: Record<string, any>;
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
    executeAutonomousBridge: (params: {
      fromChainId: number;
      toChainId: number;
      fromToken: string;
      toToken: string;
      amount: string;
    }) => Promise<any>;
    transferUSDCViaGateway: (fromChainId: number, toChainId: number, amount: string) => Promise<string>;
    fetchWithNanopayment: (url: string, payment: { amount: string; currency: 'USDC' }) => Promise<Response>;
    fetchInflationData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string> }>;
    fetchEconomicData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string> }>;
    fetchYieldData: (steps: string[], sources: string[]) => Promise<{ data: any; hashes: Record<string, string> }>;
    monitorRiskExposure: (steps: string[], portfolioUsd: number) => Promise<any>;
    getFallbackRecommendation: () => any;
  }): Promise<{ context?: GuardianAnalysisContext; earlyResult?: any }> {
    const {
      portfolioData,
      spendingLimit,
      steps,
      dataSources,
      paymentHashes,
      getUnifiedUSDCBalance,
      executeAutonomousBridge,
      transferUSDCViaGateway,
      fetchWithNanopayment,
      fetchInflationData,
      fetchEconomicData,
      fetchYieldData,
      monitorRiskExposure,
      getFallbackRecommendation,
    } = params;

    steps.push("Analyzing capital efficiency across chains...");
    const unifiedBalance = await getUnifiedUSDCBalance();
    const balance = parseFloat(unifiedBalance.arcBalance || '0');
    console.log(`[Arc Agent] Capital efficiency check: Total ${unifiedBalance.totalUSDC} USDC`);

    if (balance < spendingLimit) {
      if (parseFloat(unifiedBalance.totalUSDC) >= spendingLimit) {
        steps.push("Optimizing capital location via BridgeService...");

        const sourceChain = unifiedBalance.chainBalances?.sort((a: any, b: any) => parseFloat(b.amount) - parseFloat(a.amount))[0];

        if (sourceChain) {
          steps.push(`Moving capital from ${sourceChain.chainName} using LI.FI optimal route...`);

          try {
            const bridgeResult = await executeAutonomousBridge({
              fromChainId: sourceChain.chainId,
              toChainId: 5042002,
              fromToken: 'USDC',
              toToken: 'USDC',
              amount: spendingLimit.toString()
            });

            steps.push(`✓ Capital optimized: ${bridgeResult.txHash}`);
            return { earlyResult: getFallbackRecommendation() };
          } catch (bridgeError) {
            console.error('LI.FI bridge failed, falling back to Circle Native:', bridgeError);
            const transferHash = await transferUSDCViaGateway(sourceChain.chainId, 5042002, spendingLimit.toString());
            steps.push(`✓ Circle Native transfer: ${transferHash}`);
            return { earlyResult: getFallbackRecommendation() };
          }
        }
      } else {
        throw new Error(`Insufficient USDC balance across all chains.`);
      }
    }

    let macroData: any = {};
    let inflationResult: { data: any; hashes: Record<string, string> } = { data: {}, hashes: {} };
    let economicResult: { data: any; hashes: Record<string, string> } = { data: {}, hashes: {} };
    let yieldResult: { data: any; hashes: Record<string, string> } = { data: {}, hashes: {} };
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

      inflationResult = { data: groupedRecords.inflation || {}, hashes: {} };
      economicResult = { data: groupedRecords.economic || {}, hashes: {} };
      yieldResult = { data: groupedRecords.yield || {}, hashes: {} };
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

    steps.push("Analyzing probabilistic price forecasts (SynthData)...");
    const synthPredictions: Record<string, any> = {};
    const assetsToAnalyze = ['BTC', 'ETH', 'NVDAX', 'SPYX'];
    await Promise.all(assetsToAnalyze.map(async (asset) => {
      const pred = await SynthDataService.getPredictions(asset);
      if (pred) synthPredictions[asset] = pred;
    }));

    const riskStatus = await monitorRiskExposure(steps, parseFloat(unifiedBalance.totalUSDC));
    if (riskStatus.status === 'PROTECTED') {
      paymentHashes['Hyperliquid Risk Hedge'] = riskStatus.hedgeTx!;
    }

    const pulse = await marketPulseService.getMarketPulse();

    return {
      context: {
        portfolioData,
        unifiedBalance,
        macroData,
        researchBundle,
        inflationResult,
        economicResult,
        yieldResult,
        synthPredictions,
        pulse,
        riskStatus,
      }
    };
  }
}

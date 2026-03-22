/**
 * OracleMetrics — Real-time market metrics for the Oracle card.
 * Shows inflation rate, diversification score, and top opportunity.
 * 
 * CLEAN: Single-purpose component for displaying market data.
 * MODULAR: Composable with AgentTierStatus.
 */
import React, { useMemo } from 'react';
import { useInflationData } from '../../hooks/use-inflation-data';
import { useStablecoinPortfolio } from '../../hooks/use-stablecoin-portfolio';
import { useWalletContext } from '../wallet/WalletProvider';

interface OracleMetricsProps {
  compact?: boolean;
}

export default function OracleMetrics({ compact = false }: OracleMetricsProps) {
  const { inflationData, dataSource } = useInflationData();
  const { address } = useWalletContext();
  const { metrics: portfolioMetrics } = useStablecoinPortfolio(address ?? undefined);

  const marketData = useMemo(() => {
    // Find highest inflation region
    let highestInflation = { region: 'Unknown', rate: 0 };
    Object.entries(inflationData).forEach(([region, data]) => {
      if (data.avgRate > highestInflation.rate) {
        highestInflation = { region, rate: data.avgRate };
      }
    });

    // Find diversification score from portfolio metrics
    const diversificationMetric = portfolioMetrics?.find(m => 
      m.name.toLowerCase().includes('diversif')
    );
    const diversificationScore = diversificationMetric?.value ?? 0;

    // Find top opportunity (lowest inflation region with available stablecoins)
    let topOpportunity = { region: 'Unknown', rate: 100 };
    Object.entries(inflationData).forEach(([region, data]) => {
      if (data.avgRate < topOpportunity.rate && data.stablecoins.length > 0) {
        topOpportunity = { region, rate: data.avgRate };
      }
    });

    return {
      highestInflation,
      diversificationScore,
      topOpportunity,
      dataSource,
    };
  }, [inflationData, portfolioMetrics, dataSource]);

  if (compact) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Top Inflation</span>
          <span className="text-xs font-bold text-red-600 dark:text-red-400">
            {marketData.highestInflation.rate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Diversification</span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {marketData.diversificationScore.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Top Opp.</span>
          <span className="text-xs font-bold text-green-600 dark:text-green-400">
            {marketData.topOpportunity.region}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">Highest Inflation</div>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {marketData.highestInflation.region} · {marketData.highestInflation.rate.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">Diversification Score</div>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {marketData.diversificationScore.toFixed(0)}%
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <div className="flex-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">Top Opportunity</div>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {marketData.topOpportunity.region} · {marketData.topOpportunity.rate.toFixed(1)}% inflation
          </div>
        </div>
      </div>
      
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        Data: {marketData.dataSource}
      </div>
    </div>
  );
}

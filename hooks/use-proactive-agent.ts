import { useEffect, useRef } from 'react';
import { agentEventBus } from './agent-event-bus';
import { marketPulseService } from '@diversifi/shared';
import { useStreakRewards } from './use-streak-rewards';
import { useAgentConfig } from './use-agent-config';
import { useAdvisor } from './use-advisor';
import { useWalletContext } from '../components/wallet/WalletProvider';

type YieldOpportunity = {
  protocol: string;
  chain: string;
  symbol: string;
  apy: number;
  tvl: number;
  pool: string;
};

const EXECUTABLE_YIELD_TOKENS = new Set(['USDY', 'PAXG', 'SYRUPUSDC', 'CUSD', 'CEUR', 'USDC', 'USDT']);

function getExecutableTargetToken(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || normalized.includes('-') || normalized.includes('/')) {
    return null;
  }
  return EXECUTABLE_YIELD_TOKENS.has(normalized) ? normalized : null;
}

/**
 * useProactiveAgent
 * 
 * CORE PRINCIPLES:
 * - PROACTIVE: Monitors REAL on-chain and market data in the background.
 * - MODULAR: Decoupled from the Chat UI. It emits events or pushes to existing context.
 * - HONEST: No fabricated data. Alerts only when real thresholds are crossed.
 * 
 * Monitoring Loop:
 * 1. GoodDollar UBI claim status (via useStreakRewards)
 * 2. Market volatility (via marketPulseService)
 * 3. DeFi yield spikes (via /api/agent/yield-monitor — DeFiLlama data)
 */
export function useProactiveAgent() {
  const { config } = useAgentConfig();
  const { publishAdvisorUpdate } = useAdvisor();
  const { address } = useWalletContext();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  // GoodDollar Integration
  const { canClaim, estimatedReward, alreadyClaimedOnChain } = useStreakRewards();

  // Configurable thresholds (Phase 4C)
  const volatilityThreshold = (config as any).volatilityAlertThreshold ?? 80;
  const yieldThreshold = (config as any).yieldAlertThreshold ?? 10;

  // Prevent duplicate triggers within a session
  const ubiPrompted = useRef(false);
  const yieldAlerted = useRef(false);
  const volatilityAlerted = useRef(false);

  // Monitor GoodDollar Claim Status
  useEffect(() => {
    if (canClaim && !alreadyClaimedOnChain && !ubiPrompted.current) {
        ubiPrompted.current = true;
        
        const ubiInsight = `✨ Good news! I've been monitoring your on-chain status, and your daily Universal Basic Income of ${estimatedReward} is ready to claim on Celo.`;
        
        const triggerUbiAlert = () => {
             publishAdvisorUpdate({
               content: ubiInsight,
               type: 'recommendation',
               openDrawer: true,
               action: {
                 type: 'claim_ubi',
                 delay: 3500,
               }
             }).catch(() => {});
        };

        setTimeout(triggerUbiAlert, 4000); 
    }
  }, [canClaim, alreadyClaimedOnChain, estimatedReward, publishAdvisorUpdate]);

  // Real Market & Yield Monitoring Loop
  useEffect(() => {
    const monitoringInterval = setInterval(async () => {
      try {
        // 1. Market Volatility Check (real data from marketPulseService)
        const pulse = await marketPulseService.getMarketPulse('1h');
        
        if (pulse.impliedVolatility && pulse.impliedVolatility > volatilityThreshold && !volatilityAlerted.current) {
          volatilityAlerted.current = true;
          
          const volMessage = `⚠️ Market volatility has spiked to ${Math.round(pulse.impliedVolatility)}% (your threshold: ${volatilityThreshold}%). Sentiment: ${pulse.sentiment}. Would you like me to bridge your crypto to stable assets on Celo?`;
          
          agentEventBus.emit('proactive:insight', {
            title: 'High Volatility Detected',
            message: volMessage,
            type: 'alert'
          });
          
          publishAdvisorUpdate({
            content: volMessage,
            type: 'recommendation',
            openDrawer: false,
          }).catch(() => {});
          
          // Reset alert after 30 minutes so it can fire again
          setTimeout(() => { volatilityAlerted.current = false; }, 30 * 60 * 1000);
        }

        // 2. DeFi Yield Spike Check (real DeFiLlama data via yield-monitor endpoint)
        if (!yieldAlerted.current) {
          try {
            const yieldRes = await fetch(`${API_BASE}/api/agent/yield-monitor`);
            if (yieldRes.ok) {
              const yieldData = await yieldRes.json();
              const spikes = yieldData.opportunities?.filter(
                (o: YieldOpportunity) => o.apy > yieldThreshold && o.chain?.toLowerCase().includes('celo')
              ) || [];
              
              if (spikes.length > 0) {
                yieldAlerted.current = true;
                const best = spikes[0] as YieldOpportunity;
                const targetToken = getExecutableTargetToken(best.symbol);
                const formattedTvl = best.tvl >= 1_000_000
                  ? `$${(best.tvl / 1e6).toFixed(1)}M`
                  : `$${(best.tvl / 1e3).toFixed(0)}k`;

                if (targetToken && address) {
                  fetch(`${API_BASE}/api/vault/guardian-state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userAddress: address,
                      latestRecommendation: {
                        capturedAt: new Date().toISOString(),
                        source: 'proactive-yield',
                        action: 'REBALANCE',
                        targetToken,
                        oneLiner: `Review moving idle stablecoins toward ${targetToken} yield.`,
                        reasoning: `${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} with TVL ${formattedTvl}.`,
                        confidence: best.tvl >= 1_000_000 ? 0.72 : 0.55,
                        riskLevel: best.tvl >= 1_000_000 ? 'MEDIUM' : 'HIGH',
                        protocol: best.protocol,
                        chain: best.chain,
                        marketSymbol: best.symbol,
                        apy: best.apy,
                        tvl: best.tvl,
                        expectedSavings: Math.max(25, Math.round(best.apy)),
                      },
                    }),
                  }).catch(() => {});

                  const yieldMessage = `📈 On-chain data shows ${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} (TVL: ${formattedTvl}). This exceeds your ${yieldThreshold}% alert threshold. Should I have Guardian review a dry-run rebalance for this opportunity?`;

                  publishAdvisorUpdate({
                    content: yieldMessage,
                    type: 'recommendation',
                    openDrawer: false,
                    action: {
                      type: 'guardian_review',
                    },
                  }).catch(() => {});
                } else {
                  const yieldMessage = `📈 On-chain data shows ${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} (TVL: ${formattedTvl}). This exceeds your ${yieldThreshold}% alert threshold, but Guardian does not currently open LP or unsupported yield positions automatically. Treat this as a research alert, not an executable action.`;

                  publishAdvisorUpdate({
                    content: yieldMessage,
                    type: 'recommendation',
                    openDrawer: false,
                  }).catch(() => {});
                }
                
                // Reset after 1 hour
                setTimeout(() => { yieldAlerted.current = false; }, 60 * 60 * 1000);
              }
            }
          } catch (yieldErr) {
            // Silently skip — yield monitoring is best-effort
            console.warn('[ProactiveAgent] Yield monitor fetch failed:', yieldErr);
          }
        }
      } catch (err) {
        console.warn('[ProactiveAgent] Monitoring loop error:', err);
      }
    }, 300000); // Check every 5 minutes (was 60s — too noisy)

    return () => {
      clearInterval(monitoringInterval);
    };
  }, [API_BASE, address, publishAdvisorUpdate, volatilityThreshold, yieldThreshold]);
}

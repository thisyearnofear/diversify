import { useEffect, useRef } from 'react';
import { agentEventBus } from './agent-event-bus';
import { marketPulseService } from '@diversifi/shared';
import { useStreakRewards } from './use-streak-rewards';
import { useAgentConfig } from './use-agent-config';
import { useAdvisor } from './use-advisor';

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
               speak: true,
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
            speak: true,
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
                (o: any) => o.apy > yieldThreshold && o.chain?.toLowerCase().includes('celo')
              ) || [];
              
              if (spikes.length > 0) {
                yieldAlerted.current = true;
                const best = spikes[0];
                const yieldMessage = `📈 On-chain data shows ${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} (TVL: $${(best.tvl / 1e6).toFixed(1)}M). This exceeds your ${yieldThreshold}% alert threshold. Should I rebalance idle USDC into this pool?`;
                
                publishAdvisorUpdate({
                  content: yieldMessage,
                  type: 'recommendation',
                  openDrawer: false,
                  speak: true,
                }).catch(() => {});
                
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
  }, [API_BASE, publishAdvisorUpdate, volatilityThreshold, yieldThreshold]);
}

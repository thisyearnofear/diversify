import { useEffect, useRef } from 'react';
import { agentEventBus } from './agent-event-bus';
import { marketPulseService } from '@diversifi/shared';
import { useAIConversation } from '../context/AIConversationContext';
import { useAgentVoice } from './use-agent-voice';
import { useAgentStatus } from './use-agent-status';
import { useStreakRewards } from './use-streak-rewards';
import { useAgentConfig } from './use-agent-config';

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
  const { addMessage, setDrawerOpen } = useAIConversation();
  const { capabilities } = useAgentStatus();
  const { config } = useAgentConfig();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });

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
             setDrawerOpen(true);
             addMessage({
               role: 'assistant',
               content: ubiInsight,
               type: 'recommendation',
               timestamp: new Date(),
               action: {
                 type: 'claim_ubi',
                 delay: 3500,
               }
             });
             
             if (capabilities.voiceOutput) {
                 generateSpeech(ubiInsight);
             }
        };

        setTimeout(triggerUbiAlert, 4000); 
    }
  }, [canClaim, alreadyClaimedOnChain, estimatedReward, addMessage, setDrawerOpen, capabilities.voiceOutput, generateSpeech]);

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
          
          setDrawerOpen(true);
          addMessage({
            role: 'assistant',
            content: volMessage,
            type: 'recommendation',
            timestamp: new Date(),
          });
          
          if (capabilities.voiceOutput) {
            generateSpeech(volMessage);
          }
          
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
                
                setDrawerOpen(true);
                addMessage({
                  role: 'assistant',
                  content: yieldMessage,
                  type: 'recommendation',
                  timestamp: new Date(),
                  action: {
                    type: 'execute_rwa',
                    amount: '500',
                    network: 'celo',
                    targetAsset: best.symbol,
                  }
                });
                
                if (capabilities.voiceOutput) {
                  generateSpeech(yieldMessage);
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
    }, 60000); // Check every minute

    return () => {
      clearInterval(monitoringInterval);
    };
  }, [addMessage, setDrawerOpen, capabilities.voiceOutput, generateSpeech, API_BASE, volatilityThreshold, yieldThreshold]);
}

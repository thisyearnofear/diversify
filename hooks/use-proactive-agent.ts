import { useEffect, useRef } from 'react';
import { agentEventBus } from './agent-event-bus';
import { marketPulseService } from '@diversifi/shared';
import { useAIConversation } from '../context/AIConversationContext';
import { useAgentVoice } from './use-agent-voice';
import { useAgentStatus } from './use-agent-status';

/**
 * useProactiveAgent
 * 
 * CORE PRINCIPLES:
 * - PROACTIVE: Monitors on-chain and market data in the background.
 * - MODULAR: Decoupled from the Chat UI. It just emits events or pushes to the existing context.
 * 
 * Hackathon Focus (Celo "Build Agents for the Real World"):
 * - Simulates an ERC-8004 Agent Skill that monitors on-chain Celo events (e.g., Mento yield spikes, large stablecoin transfers).
 */
export function useProactiveAgent() {
  const { addMessage, setDrawerOpen } = useAIConversation();
  const { capabilities } = useAgentStatus();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });

  // Prevent duplicate demo triggers
  const demoTriggered = useRef(false);

  useEffect(() => {
    // Poll for market pulse shifts (Real Data)
    const interval = setInterval(async () => {
      try {
        const pulse = await marketPulseService.getMarketPulse('1h');
        
        // Example logic: if extreme volatility, push proactive alert
        if (pulse.impliedVolatility && pulse.impliedVolatility > 80) {
          agentEventBus.emit('proactive:insight', {
            title: 'High Volatility Detected',
            message: `Market implied volatility has spiked to ${Math.round(pulse.impliedVolatility)}%. Would you like me to automatically bridge your crypto to stable assets on Celo?`,
            type: 'alert'
          });
        }
      } catch (err) {
        console.warn('Proactive agent failed to fetch pulse:', err);
      }
    }, 60000); // Check every minute

    // Hackathon Demo: Celo On-Chain Event Trigger
    // We simulate catching a webhook/event from an indexer (e.g. Envio on Base/Celo)
    const demoTimeout = setTimeout(() => {
      if (!demoTriggered.current) {
        demoTriggered.current = true;
        
        const celoInsight = "Alert: My on-chain Indexer detected a 14% APY localized yield spike on Mento EURC (Celo). Should I autonomously rebalance your idle USDC into this pool to capture the yield?";
        
        // 1. Open the drawer to get user's attention
        setDrawerOpen(true);
        
        // 2. Add message to the UI with an interactive execution action
        addMessage({
          role: 'assistant',
          content: celoInsight,
          type: 'recommendation',
          timestamp: new Date(),
          action: {
            type: 'execute_rwa',
            amount: '500', // Example amount
            network: 'celo',
            targetAsset: 'cEUR'
          }
        });
        
        // 3. Synthesize voice if enabled
        if (capabilities.voiceOutput) {
           generateSpeech(celoInsight);
        }
      }
    }, 8000); // Triggers 8 seconds after the app loads

    return () => {
      clearInterval(interval);
      clearTimeout(demoTimeout);
    };
  }, [addMessage, setDrawerOpen, capabilities.voiceOutput, generateSpeech]);
}

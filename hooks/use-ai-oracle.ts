/**
 * use-ai-oracle — Single source of truth for all AI interactions
 *
 * DRY: Consolidates addUserMessage + sendChatMessage into one hook so
 * no consumer needs to know about both AIConversationContext AND lower-level chat plumbing.
 * CLEAN: Callers express *intent* (analyzePortfolio, askOracle) not mechanics.
 * MODULAR: Drop-in replacement wherever AI is triggered.
 */
import { useCallback } from 'react';
import { useAIConversation } from '../context/AIConversationContext';
import { useAgentChat } from './use-agent-chat';
import { useAgentStatus } from './use-agent-status';
import { useAgentVoice } from './use-agent-voice';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function useAIOracle() {
  const { addMessage, addUserMessage, setDrawerOpen, markAsRead, unreadCount } = useAIConversation();
  const { capabilities } = useAgentStatus();
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });
  const { sendChatMessage } = useAgentChat({
    apiBase: API_BASE,
    capabilities,
    useGlobalConversation: true,
    generateSpeech,
  });

  /** Add message to chat history AND trigger AI response in one call */
  const ask = useCallback(
    async (message: string) => {
      addUserMessage(message);      // shows in chat UI immediately
      setDrawerOpen(true);          // explicitly open the drawer
      sendChatMessage(message);     // triggers AI analysis

      // Intelligent Voice Insights (Summaries, Tags, Action Items)
      try {
        const response = await fetch(`${API_BASE}/api/agent/voice-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcription: message }),
        });

        if (response.ok) {
          const { insights } = await response.json();
          addMessage({
             role: 'assistant',
             content: insights.summary,
             timestamp: new Date(),
             type: 'insight',
             insights: {
               summary: insights.summary,
               tags: insights.tags,
               actionItems: insights.actionItems
             }
          });
        }
      } catch (err) {
        console.warn("[useAIOracle] Failed to fetch voice insights:", err);
      }
    },
    [addMessage, addUserMessage, sendChatMessage, setDrawerOpen],
  );

  /** Open the AI drawer and mark existing messages read */
  const openOracle = useCallback(() => {
    setDrawerOpen(true);
    markAsRead();
  }, [setDrawerOpen, markAsRead]);

  return { ask, openOracle, unreadCount };
}

/**
 * use-ai-oracle — Single source of truth for all AI interactions
 *
 * DRY: Consolidates addUserMessage + sendChatMessage into one hook so
 * no consumer needs to know about both AIConversationContext AND useDiversifiAI.
 * CLEAN: Callers express *intent* (analyzePortfolio, askOracle) not mechanics.
 * MODULAR: Drop-in replacement wherever AI is triggered.
 */
import { useCallback } from 'react';
import { useAIConversation } from '../context/AIConversationContext';
import { useDiversifiAI } from './use-diversifi-ai';

export function useAIOracle() {
  const { addUserMessage, setDrawerOpen, markAsRead } = useAIConversation();
  const { sendChatMessage } = useDiversifiAI();

  /** Add message to chat history AND trigger AI response in one call */
  const ask = useCallback(
    (message: string) => {
      addUserMessage(message);      // shows in chat UI immediately
      sendChatMessage(message);     // triggers AI analysis
      // Drawer opens automatically via AIChat's new user-message-count effect
    },
    [addUserMessage, sendChatMessage],
  );

  /** Open the AI drawer and mark existing messages read */
  const openOracle = useCallback(() => {
    setDrawerOpen(true);
    markAsRead();
  }, [setDrawerOpen, markAsRead]);

  return { ask, openOracle };
}

import { useCallback } from 'react';
import { useAIConversation } from '../context/AIConversationContext';
import { useAgentChat } from './use-agent-chat';
import { useAgentStatus } from './use-agent-status';
import { useAgentVoice } from './use-agent-voice';
import { useAgentConfig } from './use-agent-config';
// Deep leaf import — NOT the barrel — so the AI provider stack (openai,
// gemini, ethers, lifi…) stays out of the app's first-load bundle.
import { saveVoiceInsight } from '@diversifi/shared/src/services/ai/voice-insights-history';
import type { AIMessage } from './agent-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function useAdvisor() {
  const { addMessage, addUserMessage, setDrawerOpen, markAsRead, unreadCount } = useAIConversation();
  const { capabilities } = useAgentStatus();
  const { config } = useAgentConfig();
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });
  const { sendChatMessage } = useAgentChat({
    apiBase: API_BASE,
    capabilities,
    useGlobalConversation: true,
    generateSpeech,
  });

  const askAdvisor = useCallback(
    async (
      message: string,
      options?: {
        includeVoiceInsights?: boolean;
      },
    ) => {
      addUserMessage(message);
      setDrawerOpen(true);
      sendChatMessage(message);

      if (!options?.includeVoiceInsights) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/agent/voice-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcription: message }),
        });

        if (!response.ok) {
          console.warn(`[useAdvisor] Voice insights endpoint returned ${response.status} — feature may not be deployed`);
          return;
        }

        const { insights } = await response.json();
        saveVoiceInsight(insights);

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
      } catch (err) {
        console.warn("[useAdvisor] Failed to fetch voice insights:", err);
      }
    },
    [addMessage, addUserMessage, sendChatMessage, setDrawerOpen],
  );

  const publishAdvisorUpdate = useCallback(
    async ({
      content,
      type = 'text',
      action,
      openDrawer = false,
      speak = false,
    }: {
      content: string;
      type?: AIMessage['type'];
      action?: AIMessage['action'];
      openDrawer?: boolean;
      speak?: boolean;
    }) => {
      if (openDrawer) {
        setDrawerOpen(true);
      }

      addMessage({
        role: 'assistant',
        content,
        timestamp: new Date(),
        type,
        action,
      });

      if (speak && config.voiceResponsesEnabled && capabilities.voiceOutput && generateSpeech) {
        try {
          const speechBlob = await generateSpeech(content);
          if (speechBlob) {
            const url = URL.createObjectURL(speechBlob);
            const audio = new Audio(url);
            audio.play().catch((playError) => {
              console.warn("[useAdvisor] Audio playback failed:", playError);
            });
          }
        } catch (err) {
          console.warn("[useAdvisor] Failed to generate proactive speech:", err);
        }
      }
    },
    [addMessage, capabilities.voiceOutput, config.voiceResponsesEnabled, generateSpeech, setDrawerOpen],
  );

  const openAdvisor = useCallback(() => {
    setDrawerOpen(true);
    markAsRead();
  }, [setDrawerOpen, markAsRead]);

  return {
    askAdvisor,
    openAdvisor,
    publishAdvisorUpdate,
    unreadCount,
    ask: askAdvisor,
  };
}

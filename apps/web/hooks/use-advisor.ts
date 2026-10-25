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
import { useGuardianVoice } from '../context/app/GuardianVoiceContext';
import { useBalanceVisibility } from '../context/app/BalanceVisibilityContext';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function useAdvisor() {
  const { addMessage, addUserMessage, setDrawerOpen, markAsRead, unreadCount, addGuardianUpdate, dismissGuardianUpdate, markGuardianUpdateRead, snoozeGuardianUpdate, muteGuardianUpdateType, guardianUpdates, setActiveGuardianReview } = useAIConversation();
  const { capabilities } = useAgentStatus();
  const { config } = useAgentConfig();
  const voiceSession = useGuardianVoice();
  const { hidden: balancesHidden } = useBalanceVisibility();
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
        /** Compact voice turns keep the current instrument visible. */
        openDrawer?: boolean;
        /** Journaled Guardian record attached for a grounded drill-down. */
        decisionRef?: import('../context/app/NavigationContext').GuardianDecisionRef;
        /** The pair being asked about — symbols only, facts are
         *  rebuilt server-side from the curated registry. */
        pair?: { from: string; to: string };
      },
    ) => {
      addUserMessage(message);
      if (options?.openDrawer !== false) setDrawerOpen(true);
      await sendChatMessage(
        message,
        options?.decisionRef || options?.pair
          ? { ...(options.decisionRef ? { decisionRef: options.decisionRef } : {}), ...(options.pair ? { pair: options.pair } : {}) }
          : undefined,
      );

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
      guardianUpdate,
    }: {
      content: string;
      type?: AIMessage['type'];
      action?: AIMessage['action'];
      openDrawer?: boolean;
      speak?: boolean;
      /** When set, surfaces a compact Guardian update without opening the drawer. */
      guardianUpdate?: {
        summary: string;
        detail?: string;
        whyReason?: string;
        updateType?: import('../context/AIConversationContext').GuardianUpdateType;
        contract?: import('@diversifi/shared/src/types/guardian-protection').GuardianRecommendationContract;
      };
    }) => {
      if (guardianUpdate) {
        addGuardianUpdate({
          summary: guardianUpdate.summary,
          detail: guardianUpdate.detail ?? content,
          whyReason: guardianUpdate.whyReason,
          type: guardianUpdate.updateType ?? (type === 'recommendation' ? 'proposal' : 'observation'),
          action,
          contract: guardianUpdate.contract,
        });
      }

      if (openDrawer) {
        setDrawerOpen(true);
      }

      if (!guardianUpdate) {
        addMessage({
          role: 'assistant',
          content,
          timestamp: new Date(),
          type,
          action,
        });
      }

      if (speak && !balancesHidden && config.voiceResponsesEnabled && capabilities.voiceOutput) {
        await voiceSession?.speak(content, generateSpeech);
      }
    },
    [addMessage, capabilities.voiceOutput, config.voiceResponsesEnabled, generateSpeech, setDrawerOpen, addGuardianUpdate, voiceSession, balancesHidden],
  );

  const openAdvisor = useCallback(() => {
    setDrawerOpen(true);
    markAsRead();
  }, [setDrawerOpen, markAsRead]);

  const openGuardianReview = useCallback(
    (updateId?: string) => {
      if (updateId) {
        const update = guardianUpdates.find((u) => u.id === updateId);
        if (update) setActiveGuardianReview(update);
        // Opening marks read but keeps the update until Not now / Dismiss.
        markGuardianUpdateRead(updateId);
      }
      setDrawerOpen(true);
      markAsRead();
    },
    [guardianUpdates, markAsRead, markGuardianUpdateRead, setActiveGuardianReview, setDrawerOpen],
  );

  return {
    askAdvisor,
    openAdvisor,
    openGuardianReview,
    publishAdvisorUpdate,
    unreadCount,
    guardianUpdates,
    dismissGuardianUpdate,
    snoozeGuardianUpdate,
    muteGuardianUpdateType,
    ask: askAdvisor,
  };
}

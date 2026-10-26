/**
 * use-voice-intent — Routes voice transcriptions to app actions
 *
 * CLEAN: Single place for all voice → intent → action routing.
 * DRY: Removed duplicated routing in index.tsx, AIAssistant, etc.
 * MODULAR: Pass as `onTranscription` prop to any VoiceButton.
 *
 * NOTE: No imports from components/ — hooks must only import from
 * hooks/, services/, context/, and utils/ to preserve layer boundaries.
 *
 * A transcription that matches the voice-verb grammar goes to the active
 * tab's registered handler (preview/draft actions only — never commits)
 * and Guardian confirms with a third-person line. Anything else falls
 * through to askAdvisor.
 */
import { useCallback } from 'react';
import { useAdvisor } from './use-advisor';
import { useNavigationOptional } from '../context/app/NavigationContext';
import { useGuardianVoice } from '../context/app/GuardianVoiceContext';
import { useVoiceVerbRegistry } from '../context/app/VoiceVerbContext';
import { useAgentStatus } from './use-agent-status';
import { useAgentConfig } from './use-agent-config';
import { useAgentVoice } from './use-agent-voice';
import { useBalanceVisibility } from '../context/app/BalanceVisibilityContext';
import { matchVoiceVerb } from '@/lib/voice-verbs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export function useVoiceIntent() {
  const { askAdvisor } = useAdvisor();
  const navigation = useNavigationOptional();
  const voice = useGuardianVoice();
  const registry = useVoiceVerbRegistry();
  const { capabilities } = useAgentStatus();
  const { config } = useAgentConfig();
  const { hidden: balancesHidden } = useBalanceVisibility();
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });

  const handleTranscription = useCallback(
    async (text: string) => {
      const tab = navigation?.activeTab;
      const verb = tab ? matchVoiceVerb(text, tab) : null;
      if (verb && registry && tab) {
        const handler = registry.handlerFor(tab);
        const line = handler ? await handler(verb) : null;
        if (line) {
          const generator =
            capabilities.voiceOutput && !balancesHidden ? generateSpeech : undefined;
          voice?.reportReply(line, generator);
          if (config.voiceResponsesEnabled && generator) {
            await voice?.speak(line, generator);
          }
          return;
        }
      }
      // Voice and typed messages use the same interpreter, UI callbacks,
      // transcript, allowance gate, and confirmation boundary.
      await askAdvisor(text, { openDrawer: false });
    },
    [
      askAdvisor,
      navigation,
      registry,
      voice,
      capabilities,
      balancesHidden,
      generateSpeech,
      config.voiceResponsesEnabled,
    ],
  );

  return { handleTranscription };
}

/**
 * use-voice-intent — Routes voice transcriptions to app actions
 *
 * CLEAN: Single place for all voice → intent → action routing.
 * DRY: Removed duplicated routing in index.tsx, AIAssistant, etc.
 * MODULAR: Pass as `onTranscription` prop to any VoiceButton.
 *
 * NOTE: No imports from components/ — hooks must only import from
 * hooks/, services/, context/, and utils/ to preserve layer boundaries.
 */
import { useCallback } from 'react';
import { useAdvisor } from './use-advisor';

export function useVoiceIntent() {
  const { askAdvisor } = useAdvisor();

  const handleTranscription = useCallback(
    async (text: string) => {
      // Voice and typed messages use the same interpreter, UI callbacks,
      // transcript, allowance gate, and confirmation boundary.
      await askAdvisor(text, { openDrawer: false });
    },
    [askAdvisor],
  );

  return { handleTranscription };
}

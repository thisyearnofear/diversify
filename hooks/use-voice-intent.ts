/**
 * use-voice-intent — Routes voice transcriptions to app actions
 *
 * CLEAN: Single place for all voice → intent → action routing.
 * DRY: Removed duplicated routing in index.tsx, AIAssistant, etc.
 * MODULAR: Pass as `onTranscription` prop to any VoiceButton.
 *
 * NOTE: No imports from components/ — hooks must only import from
 * hooks/, services/, context/, and utils/ to preserve layer boundaries.
 * Wallet address is not needed: onOpenWalletTutorial is an always-safe
 * callback that the caller gates on address availability.
 */
import { useCallback } from 'react';
import { useNavigation } from '../context/app/NavigationContext';
import { useDemoMode } from '../context/app/DemoModeContext';
import { useAdvisor } from './use-advisor';
import { useToast } from '../components/ui/Toast';
import { IntentDiscoveryService, AgentActionService } from '@diversifi/shared';

interface VoiceIntentOptions {
  /** Called when the user asks for wallet/connection help */
  onOpenWalletTutorial?: () => void;
}

export function useVoiceIntent(options: VoiceIntentOptions = {}) {
  const { setActiveTab, setSwapPrefill } = useNavigation();
  const { enableDemoMode } = useDemoMode();
  const { askAdvisor, openAdvisor } = useAdvisor();
  const { showToast } = useToast();

  const handleTranscription = useCallback(
    async (text: string) => {
      const intent = IntentDiscoveryService.discover(text);

      // Unified action execution logic
      await AgentActionService.execute(intent, text, {
        onNavigate: setActiveTab as (tab: string) => void,
        onSwapPrefill: setSwapPrefill,
        onToast: showToast,
        onOpenWalletTutorial: options.onOpenWalletTutorial,
        onEnableDemoMode: enableDemoMode,
        onAskAI: askAdvisor,
        onOpenAIChat: openAdvisor,
      });
    },
    [askAdvisor, enableDemoMode, openAdvisor, options, setActiveTab, setSwapPrefill, showToast],
  );

  return { handleTranscription };
}

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
import { useAppState } from '../context/AppStateContext';
import { useAIOracle } from './use-ai-oracle';
import { useToast } from '../components/ui/Toast';
import { IntentDiscoveryService } from '../services/ai/intent-discovery.service';

interface VoiceIntentOptions {
  /** Called when the user asks for wallet/connection help */
  onOpenWalletTutorial?: () => void;
}

export function useVoiceIntent(options: VoiceIntentOptions = {}) {
  const { setActiveTab, setSwapPrefill, enableDemoMode } = useAppState();
  const { ask, openOracle } = useAIOracle();
  const { showToast } = useToast();

  const handleTranscription = useCallback(
    (text: string) => {
      const intent = IntentDiscoveryService.discover(text);

      switch (intent.type) {
        case 'ONBOARDING':
          if (intent.topic === 'demo') {
            showToast('Enabling demo mode...', 'info');
            enableDemoMode();
          } else if (intent.topic === 'wallet-help') {
            // Caller (index.tsx) decides whether to show tutorial or connect prompt
            options.onOpenWalletTutorial?.();
          } else {
            ask(text);
          }
          break;

        case 'NAVIGATE':
          showToast(`Switching to ${intent.tab.toUpperCase()}`, 'info');
          setActiveTab(intent.tab);
          break;

        case 'SWAP_SHORTCUT':
          showToast(`Preparing swap for ${intent.fromToken || 'assets'}...`, 'success');
          setSwapPrefill({
            fromToken: intent.fromToken,
            toToken: intent.toToken,
            amount: intent.amount,
            reason: `Voice: "${text}"`,
          });
          setActiveTab('swap');
          break;

        default:
          ask(text);
          openOracle();
          break;
      }
    },
    [ask, enableDemoMode, openOracle, options, setActiveTab, setSwapPrefill, showToast],
  );

  return { handleTranscription };
}

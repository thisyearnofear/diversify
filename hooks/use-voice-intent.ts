/**
 * use-voice-intent — Routes voice transcriptions to app actions
 *
 * CLEAN: Single place for all voice → intent → action routing.
 * DRY: Removed duplicated routing in index.tsx, AIAssistant, etc.
 * MODULAR: Pass as `onTranscription` prop to any VoiceButton.
 */
import { useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';
import { useAIConversation } from '../context/AIConversationContext';
import { useAIOracle } from './use-ai-oracle';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { useToast } from '../components/ui/Toast';
import { IntentDiscoveryService } from '../services/ai/intent-discovery.service';

interface VoiceIntentOptions {
  /** Called when wallet tutorial should open */
  onOpenWalletTutorial?: () => void;
}

export function useVoiceIntent(options: VoiceIntentOptions = {}) {
  const { setActiveTab, setSwapPrefill, enableDemoMode } = useAppState();
  const { setDrawerOpen } = useAIConversation();
  const { ask } = useAIOracle();
  const { address } = useWalletContext();
  const { showToast } = useToast();

  const handleTranscription = useCallback(
    (text: string) => {
      const intent = IntentDiscoveryService.discover(text);

      switch (intent.type) {
        case 'ONBOARDING':
          if (intent.topic === 'demo') {
            showToast('Enabling demo mode...', 'info');
            enableDemoMode();
          } else if (intent.topic === 'wallet-help' && !address) {
            showToast('Opening wallet tutorial...', 'info');
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
          setDrawerOpen(true);
          break;
      }
    },
    [ask, address, enableDemoMode, options, setActiveTab, setDrawerOpen, setSwapPrefill, showToast],
  );

  return { handleTranscription };
}

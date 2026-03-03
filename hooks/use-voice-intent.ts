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
import { useAIOracle } from './use-ai-oracle';
import { useToast } from '../components/ui/Toast';
import { IntentDiscoveryService } from '../services/ai/intent-discovery.service';

interface VoiceIntentOptions {
  /** Called when the user asks for wallet/connection help */
  onOpenWalletTutorial?: () => void;
}

export function useVoiceIntent(options: VoiceIntentOptions = {}) {
  const { setActiveTab, setSwapPrefill } = useNavigation();
  const { enableDemoMode } = useDemoMode();
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

        case 'SEND_TO_PHONE':
          showToast(`Resolving ${intent.phoneNumber}...`, 'info');
          
          // Trigger resolution (async)
          (async () => {
            try {
              // Note: For hackathon/MiniPay, we use the user's provider for ODIS auth
              const { ProviderFactoryService } = await import('../services/swap/provider-factory.service');
              const { SocialConnectService } = await import('../services/social-connect-service');
              const { ethers } = await import('ethers');

              const signer = await ProviderFactoryService.getSignerForChain(42220); // Celo
              const address = await signer.getAddress();
              
              // Mock/Stub for walletClient expected by SocialConnectService
              // In reality, this would be the viem client from useWallet
              const authSigner = {
                authenticationMethod: 'wallet_key',
                sign191: (msg: string) => signer.signMessage(msg)
              };

              const scService = new SocialConnectService({ isTestnet: true });
              const resolvedAddress = await scService.resolveIdentifier(
                intent.phoneNumber,
                undefined,
                authSigner
              );

              if (resolvedAddress) {
                showToast(`Resolved to ${resolvedAddress.slice(0, 6)}...`, 'success');
                setSwapPrefill({
                  fromToken: intent.fromToken || 'USDm',
                  toToken: intent.token || 'KESm',
                  amount: intent.amount || '10',
                  reason: `SocialConnect: Send to ${intent.phoneNumber}`,
                  phoneNumber: intent.phoneNumber,
                  recipientAddress: resolvedAddress,
                  fromChainId: 42220,
                  toChainId: 42220
                });
                setActiveTab('swap');
              } else {
                showToast(`Could not resolve ${intent.phoneNumber}`, 'error');
                // Fallback: still open swap but without recipient
                setSwapPrefill({
                  toToken: intent.token,
                  amount: intent.amount,
                  reason: `Manual: Send to ${intent.phoneNumber}`,
                  phoneNumber: intent.phoneNumber
                });
                setActiveTab('swap');
              }
            } catch (err) {
              console.error('SocialConnect resolution failed:', err);
              showToast('SocialConnect error', 'error');
            }
          })();
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

/**
 * AgentActionService
 * 
 * Centralized "Execution Engine" for discovered AI intents.
 * 
 * CLEAN: Separation between understanding (IntentDiscovery) and doing (AgentAction).
 * DRY: Shared logic for voice and text interaction flows.
 * MODULAR: Independent of UI frameworks, but accepts callbacks for UI side-effects.
 */

import { AppIntent, AppTab } from './intent-discovery.service';

export interface ExecutionCallbacks {
    onNavigate?: (tab: AppTab) => void;
    onSwapPrefill?: (prefill: any) => void;
    onEarnPrefill?: (prefill: any) => void;
    onToast?: (message: string, type: 'info' | 'success' | 'error' | 'ai') => void;
    onOpenWalletTutorial?: () => void;
    onEnableDemoMode?: () => void;
    onAskAI?: (text: string) => void;
    onOpenAIChat?: () => void;
}

export class AgentActionService {
    /**
     * Executes the appropriate action(s) for a given intent
     */
    static async execute(intent: AppIntent, originalText: string, callbacks: ExecutionCallbacks): Promise<void> {
        switch (intent.type) {
            case 'ONBOARDING':
                if (intent.topic === 'demo') {
                    callbacks.onToast?.('Enabling demo mode...', 'info');
                    callbacks.onEnableDemoMode?.();
                } else if (intent.topic === 'wallet-help') {
                    callbacks.onOpenWalletTutorial?.();
                } else {
                    // General questions go to AI
                    callbacks.onAskAI?.(originalText);
                }
                break;

            case 'NAVIGATE':
                callbacks.onToast?.(`Switching to ${intent.tab.toUpperCase()}...`, 'info');
                callbacks.onNavigate?.(intent.tab);
                break;

            case 'SEND_TO_PHONE':
                callbacks.onToast?.(`Resolving ${intent.phoneNumber}...`, 'info');
                
                // Trigger resolution (async)
                try {
                    // Import directly to avoid circular dependency with index
                    const { SocialConnectService } = await import('../social-connect-service');
                    const { ProviderFactoryService } = await import('../swap/provider-factory.service');
                    
                    // Note: Chain 42220 is Celo Mainnet
                    const provider = await ProviderFactoryService.getProvider(42220); 
                    const scService = new SocialConnectService({ isTestnet: true });
                    
                    // In a real implementation, we'd need a signer here. 
                    // For the "Execution" layer, we mainly want to prefill the swap UI.
                    callbacks.onSwapPrefill?.({
                        fromToken: 'USDm',
                        toToken: intent.token || 'KESm',
                        amount: intent.amount || '10',
                        reason: `SocialConnect: Send to ${intent.phoneNumber}`,
                        phoneNumber: intent.phoneNumber,
                        fromChainId: 42220,
                        toChainId: 42220
                    });
                    callbacks.onNavigate?.('exchange');
                    callbacks.onToast?.(`Found SocialConnect identity for ${intent.phoneNumber}`, 'success');
                } catch (err) {
                    console.error('[AgentActionService] SocialConnect prefill failed:', err);
                    // Fallback: still open exchange but without recipient resolution
                    callbacks.onSwapPrefill?.({
                        toToken: intent.token,
                        amount: intent.amount,
                        reason: `Manual: Send to ${intent.phoneNumber}`,
                        phoneNumber: intent.phoneNumber
                    });
                    callbacks.onNavigate?.('exchange');
                }
                break;

            case 'SWAP_SHORTCUT':
                callbacks.onToast?.(`Preparing swap for ${intent.fromToken || 'assets'}...`, 'success');
                callbacks.onSwapPrefill?.({
                    fromToken: intent.fromToken,
                    toToken: intent.toToken,
                    amount: intent.amount,
                    reason: `AI Shortcut: "${originalText}"`,
                });
                callbacks.onNavigate?.('exchange');
                break;

            case 'YIELD_EARN':
                callbacks.onToast?.(`Finding best yield opportunities...`, 'ai');
                if (intent.topic === 'vault' && (intent as any).vaultId) {
                    callbacks.onEarnPrefill?.({
                        vaultId: (intent as any).vaultId,
                        reason: `AI Recommendation: "${originalText}"`,
                    });
                }
                callbacks.onNavigate?.('earn');
                break;

            case 'GOODDOLLAR':
                // For GoodDollar status/claims, we usually want the AI to give a contextual response
                // but we also want to open the chat drawer.
                callbacks.onAskAI?.(originalText);
                callbacks.onOpenAIChat?.();
                break;

            case 'WDK_ACTION':
                if (intent.topic === 'switch') {
                    callbacks.onToast?.('Switching to WDK settlement infrastructure...', 'success');
                    // We can also trigger a navigation to settings to confirm
                    callbacks.onNavigate?.('agent');
                } else if (intent.topic === 'settlement') {
                    callbacks.onToast?.('WDK Settlement Protocol initialized.', 'ai');
                    callbacks.onNavigate?.('agent');
                } else {
                    callbacks.onAskAI?.(originalText);
                    callbacks.onOpenAIChat?.();
                }
                break;

            case 'QUERY':
                // Direct queries always go to the Advisor
                callbacks.onAskAI?.(originalText);
                callbacks.onOpenAIChat?.();
                break;

            default:
                // Fallback to general AI chat
                callbacks.onAskAI?.(originalText);
                callbacks.onOpenAIChat?.();
                break;
        }
    }
}

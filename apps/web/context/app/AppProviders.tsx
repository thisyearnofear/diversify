import React from 'react';
import { NavigationProvider } from './NavigationContext';
import { ThemeProvider } from './ThemeContext';
import { ExperienceProvider } from './ExperienceContext';
import { TourProvider } from './TourContext';
import { ProtectionProfileProvider } from '@/hooks/use-protection-profile';
import { WalletProvider } from '@/components/wallet/WalletProvider';
import { DemoModeProvider } from './DemoModeContext';
import { PortfolioProvider } from './PortfolioContext';
import { AgentChatProvider } from './AgentChatContext';

/**
 * AppProviders
 *
 * Provider order matters where contexts depend on each other:
 * - Navigation must wrap Tour/DemoMode (they call navigation setters)
 * - WalletProvider must sit above PortfolioProvider and any other
 *   consumer of useWalletContext() (PortfolioContext, AIConversationContext,
 *   use-agent-chat). React context only flows downward: with WalletProvider
 *   mounted below this tree, those consumers silently saw the default null
 *   address — balances never fetched and Home stayed on its wait state
 *   after connecting a wallet.
 * - PortfolioProvider wraps the app so useMultichainBalances fires once
 *   instead of once per consumer (AgentTierStatus, useAgentChat, SwapTab, etc.)
 * - AgentChatProvider shares isChatting/thinkingStep state across
 *   components without a module-level pub-sub.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <ThemeProvider>
        <ExperienceProvider>
          <ProtectionProfileProvider>
            <TourProvider>
              <WalletProvider>
                <DemoModeProvider>
                  <PortfolioProvider>
                    <AgentChatProvider>{children}</AgentChatProvider>
                  </PortfolioProvider>
                </DemoModeProvider>
              </WalletProvider>
            </TourProvider>
          </ProtectionProfileProvider>
        </ExperienceProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

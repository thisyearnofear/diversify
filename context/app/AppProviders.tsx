import React from 'react';
import { NavigationProvider } from './NavigationContext';
import { ThemeProvider } from './ThemeContext';
import { ExperienceProvider } from './ExperienceContext';
import { StrategyProvider } from './StrategyContext';
import { TourProvider } from './TourContext';
import { DemoModeProvider } from './DemoModeContext';
import { PortfolioProvider } from './PortfolioContext';
import { AgentChatProvider } from './AgentChatContext';

/**
 * AppProviders
 *
 * Provider order matters where contexts depend on each other:
 * - Navigation must wrap Tour/DemoMode (they call navigation setters)
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
          <StrategyProvider>
            <TourProvider>
              <DemoModeProvider>
                <PortfolioProvider>
                  <AgentChatProvider>{children}</AgentChatProvider>
                </PortfolioProvider>
              </DemoModeProvider>
            </TourProvider>
          </StrategyProvider>
        </ExperienceProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

import React from 'react';
import { NavigationProvider } from './NavigationContext';
import { ThemeProvider } from './ThemeContext';
import { ExperienceProvider } from './ExperienceContext';
import { StrategyProvider } from './StrategyContext';
import { TourProvider } from './TourContext';
import { DemoModeProvider } from './DemoModeContext';

/**
 * AppProviders
 *
 * Provider order matters where contexts depend on each other:
 * - Navigation must wrap Tour/DemoMode (they call navigation setters)
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <ThemeProvider>
        <ExperienceProvider>
          <StrategyProvider>
            <TourProvider>
              <DemoModeProvider>{children}</DemoModeProvider>
            </TourProvider>
          </StrategyProvider>
        </ExperienceProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

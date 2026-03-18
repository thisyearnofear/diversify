import React from 'react';
import { NavigationProvider } from './NavigationContext';
import { ThemeProvider } from './ThemeContext';
import { ExperienceProvider } from './ExperienceContext';
import { StrategyProvider } from './StrategyContext';
import { TourProvider } from './TourContext';
import { DemoModeProvider } from './DemoModeContext';
import { BacktestProvider } from './BacktestContext';

/**
 * AppProviders
 *
 * Provider order matters where contexts depend on each other:
 * - Navigation must wrap Tour/DemoMode (they call navigation setters)
 * - BacktestProvider provides shared backtest state for PerformanceChart
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <ThemeProvider>
        <ExperienceProvider>
          <StrategyProvider>
            <BacktestProvider>
              <TourProvider>
                <DemoModeProvider>{children}</DemoModeProvider>
              </TourProvider>
            </BacktestProvider>
          </StrategyProvider>
        </ExperienceProvider>
      </ThemeProvider>
    </NavigationProvider>
  );
}

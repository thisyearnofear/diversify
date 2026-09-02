/**
 * ProviderTree — Composes the provider hierarchy for _app.tsx.
 *
 * Keeps the App component focused on layout, not provider nesting.
 * WalletProvider lives inside AppProviders (it must sit above
 * PortfolioProvider and AIConversationProvider — context only flows down).
 */
import { type ReactNode } from "react";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { AppProviders } from "@/context/app/AppProviders";
import { AdaptiveProvider } from "@/context/app/AdaptiveContext";
import { AIConversationProvider } from "@/context/AIConversationContext";
import { PrivyProvider } from "@/context/PrivyProvider";
import { StreakRewardsProvider } from "@/hooks/use-streak-rewards";
import { ProofFeedProvider } from "@/hooks/proof-feed-provider";
import { ClaimFlowProvider } from "@/hooks/claim-flow-context";
import { ProtectionAmbient } from "@/components/tabs/protect/ProtectionAmbient";

interface ProviderTreeProps {
  children: ReactNode;
}

export default function ProviderTree({ children }: ProviderTreeProps) {
  return (
    <ErrorBoundary>
      <PrivyProvider>
        <AppProviders>
          <AdaptiveProvider>
            <AIConversationProvider>
              <ToastProvider>
                <StreakRewardsProvider>
                  <ProofFeedProvider>
                    <ClaimFlowProvider>
                      <ProtectionAmbient>{children}</ProtectionAmbient>
                    </ClaimFlowProvider>
                  </ProofFeedProvider>
                </StreakRewardsProvider>
              </ToastProvider>
            </AIConversationProvider>
          </AdaptiveProvider>
        </AppProviders>
      </PrivyProvider>
    </ErrorBoundary>
  );
}

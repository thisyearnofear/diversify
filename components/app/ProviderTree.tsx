/**
 * ProviderTree — Composes the provider hierarchy for _app.tsx.
 *
 * Keeps the App component focused on layout, not provider nesting.
 */
import { type ReactNode } from "react";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AppProviders } from "@/context/app/AppProviders";
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
          <AIConversationProvider>
            <ToastProvider>
              <WalletProvider>
                <StreakRewardsProvider>
                  <ProofFeedProvider>
                    <ClaimFlowProvider>
                      <ProtectionAmbient>{children}</ProtectionAmbient>
                    </ClaimFlowProvider>
                  </ProofFeedProvider>
                </StreakRewardsProvider>
              </WalletProvider>
            </ToastProvider>
          </AIConversationProvider>
        </AppProviders>
      </PrivyProvider>
    </ErrorBoundary>
  );
}
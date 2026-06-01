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
                {children}
              </WalletProvider>
            </ToastProvider>
          </AIConversationProvider>
        </AppProviders>
      </PrivyProvider>
    </ErrorBoundary>
  );
}
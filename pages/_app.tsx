import "../styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Head from "next/head";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import { WalletProvider } from "../components/wallet/WalletProvider";
import { ToastProvider } from "../components/ui/Toast";
import { AppProviders } from "../context/app/AppProviders";
import { AIConversationProvider } from "../context/AIConversationContext";
import { PrivyProvider } from "../context/PrivyProvider";
import AIChat from "../components/agent/AIChat";
import { useRouter } from "next/router";
import sdk from "@farcaster/miniapp-sdk";

export default function App({ Component, pageProps }: AppProps) {
  const [isInMiniPay, setIsInMiniPay] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  // Initialize environment and signal readiness
  useEffect(() => {
    const init = async () => {
      try {
        // Dynamically import to ensure client-side only execution from shared bundle
        const { isMiniPayEnvironment } = await import("@diversifi/shared");
        const inMiniPay = isMiniPayEnvironment();
        setIsInMiniPay(inMiniPay);
        
        // Signal Farcaster Readiness
        console.log("[Farcaster] Attempting early ready signal...");
        if (sdk && sdk.actions && sdk.actions.ready) {
          sdk.actions.ready();
        } else if (sdk && (sdk as any).ready) {
          (sdk as any).ready();
        }

        // Handle MiniPay specific logic
        if (inMiniPay && router.pathname === "/") {
          console.log("Redirecting to /minipay-test page");
          router.push("/minipay-test");
        }

        setIsReady(true);
      } catch (e) {
        console.error("App initialization failed:", e);
        setIsReady(true);
      }
    };

    init();
  }, [router]);

  // Prevent hydration mismatch by only rendering after client-side init
  if (!isReady) {
    return null;
  }

  return (
    <>
      <Head>
        <title>DiversiFi - Stablecoin Portfolio Diversification</title>
        <meta
          name="description"
          content="Visualize and manage your stablecoin portfolio diversification"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        {/* Add MiniPay compatibility meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </Head>

      <ErrorBoundary>
        <PrivyProvider>
          <AppProviders>
            <AIConversationProvider>
              <ToastProvider>
                <WalletProvider>
                  <Component {...pageProps} isInMiniPay={isInMiniPay} />
                  <AIChat />
                </WalletProvider>
              </ToastProvider>
            </AIConversationProvider>
          </AppProviders>
        </PrivyProvider>
      </ErrorBoundary>
    </>
  );
}

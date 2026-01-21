import "../styles/globals.css";
import type { AppProps } from "next/app";
import { isMiniPayEnvironment } from "../utils/environment";
import { useEffect, useState } from "react";
import Head from "next/head";
import ErrorBoundary from "../components/ErrorBoundary";
import { WalletProvider } from "../components/WalletProvider";
import { ToastProvider } from "../components/Toast";
import { AppStateProvider } from "../context/AppStateContext";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const [isInMiniPay, setIsInMiniPay] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure everything is loaded properly
    setTimeout(() => {
      // Check if we're in MiniPay environment
      const inMiniPay = isMiniPayEnvironment();
      setIsInMiniPay(inMiniPay);

      // Log basic info for development
      if (process.env.NODE_ENV === "development") {
        console.log("App initialized", {
          inMiniPay,
          path: router.pathname,
        });
      }

      // Log when app loads
      console.log("DiversiFi app loaded", {
        inMiniPay,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        hasEthereum: typeof window !== 'undefined' && typeof window.ethereum !== "undefined",
        ethereumIsMiniPay: typeof window !== 'undefined' && window.ethereum?.isMiniPay || false,
        inIframe: typeof window !== 'undefined' && window !== window.parent,
        referrer: typeof document !== 'undefined' ? (document.referrer || "None") : 'N/A',
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        pathname: typeof window !== 'undefined' ? window.location.pathname : 'N/A',
      });

      // If in MiniPay and on the main page, redirect to the minipay-test page
      if (inMiniPay && router.pathname === "/") {
        console.log("Redirecting to /minipay-test page");
        router.push("/minipay-test");
      }

      // Note: Auto-connect is now handled by the useWallet hook
      // We'll keep this log for debugging
      if (inMiniPay && window.ethereum) {
        console.log(
          "MiniPay detected, wallet connection will be handled by useWallet hook"
        );
      }
    }, 500);
  }, [router]);

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
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ErrorBoundary>
        {/* Debug overlay removed */}

        {/* Wrap with AppStateProvider and other providers */}
        <AppStateProvider>
          <ToastProvider>
            <WalletProvider>
              <Component {...pageProps} isInMiniPay={isInMiniPay} />
            </WalletProvider>
          </ToastProvider>
        </AppStateProvider>
      </ErrorBoundary>
    </>
  );
}

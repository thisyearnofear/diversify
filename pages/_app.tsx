import "../styles/globals.css";
import type { AppProps } from "next/app";
import { useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

import { useAppInit } from "../hooks/use-app-init";
import ProviderTree from "../components/app/ProviderTree";

const AIChat = dynamic(() => import("../components/agent/AIChat"), {
  ssr: false,
});

const headMeta = (
  <Head>
    <title>DiversiFi - Stablecoin Portfolio Diversification</title>
    <meta name="description" content="Visualize and manage your stablecoin portfolio diversification" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" href="/icon.png" />
    <link rel="apple-touch-icon" href="/icon.png" />
  </Head>
);

export default function App({ Component, pageProps }: AppProps) {
  const [ready, setReady] = useState(false);
  const { isInMiniPay } = useAppInit();

  // Gate hydration until client-side init is complete.
  // Privy, Wagmi, and wallet hooks access localStorage/window during hydration.
  if (!ready) {
    // Schedule a microtask to flip the flag — avoids blocking the render
    Promise.resolve().then(() => setReady(true));
    return <>{headMeta}</>;
  }

  return (
    <>
      {headMeta}
      <ProviderTree>
        <Component {...pageProps} isInMiniPay={isInMiniPay} />
        <AIChat />
      </ProviderTree>
    </>
  );
}
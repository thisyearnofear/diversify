import "../styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

import { useAppInit } from "../hooks/use-app-init";
import ProviderTree from "../components/app/ProviderTree";
import { ProactiveAgentRunner } from "../components/agent/ProactiveAgentRunner";

const AIChat = dynamic(() => import("../components/agent/AIChat"), {
  ssr: false,
});

const headMeta = (
  <Head>
    <title>DiversiFi - Shield Your Savings</title>
    <meta name="description" content="Protect your savings from inflation and currency risk with verifiable, on-chain proof" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
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
  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <>{headMeta}</>;
  }

  return (
    <>
      {headMeta}
      <ProviderTree>
        <ProactiveAgentRunner />
        <Component {...pageProps} isInMiniPay={isInMiniPay} />
        <AIChat />
      </ProviderTree>
    </>
  );
}
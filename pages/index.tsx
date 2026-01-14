import { useEffect } from "react";
import { isMiniPayEnvironment } from "../utils/environment";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure everything is loaded
    setTimeout(() => {
      // Check if we're in MiniPay environment
      const inMiniPay = isMiniPayEnvironment();

      // Log page load with detailed info
      console.log("Home page loaded", {
        inMiniPay,
        userAgent: navigator.userAgent,
        hasEthereum: typeof window.ethereum !== "undefined",
        ethereumIsMiniPay: window.ethereum?.isMiniPay || false,
        inIframe: window !== window.parent,
        referrer: document.referrer || "None",
      });

      // Always redirect to the diversifi page
      router.push("/diversifi");
    }, 300);
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Head>
        <title>DiversiFi - MiniPay</title>
        <meta
          name="description"
          content="Visualize and manage your stablecoin portfolio diversification"
        />
      </Head>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading DiversiFi...</p>
      </div>
    </div>
  );
}

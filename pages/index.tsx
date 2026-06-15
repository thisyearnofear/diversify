import { useEffect, useState } from "react";
import Head from "next/head";
import { useWalletContext } from "../components/wallet/WalletProvider";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";
import AppShell from "../components/app/AppShell";
import confetti from "canvas-confetti";

const ogImageUrl = "https://diversifiapp.vercel.app/embed-image.png";

const farcasterMeta = {
  version: "1",
  imageUrl: ogImageUrl,
  button: {
    title: "Open DiversiFi",
    action: {
      name: "DiversiFi",
      url: "https://diversifiapp.vercel.app",
      splashImageUrl: "https://diversifiapp.vercel.app/splash.png",
      splashBackgroundColor: "#8B5CF6",
    },
  },
};

export default function DiversiFiPage() {
  const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal } = useStrategyModal();

  const {
    address, connect: connectWallet,
  } = useWalletContext();

  // Onboarding gate — show only the modal until user completes
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("onboardingCompleted") === "true";
  });

  // Fire confetti the first time wallet connects
  const [hasCelebratedConnect, setHasCelebratedConnect] = useState(false);
  useEffect(() => {
    if (address && !hasCelebratedConnect) {
      setHasCelebratedConnect(true);
      if (onboardingComplete) {
        // Only celebrate if onboarding is already done (avoids double-confetti)
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
      }
    }
  }, [address, hasCelebratedConnect, onboardingComplete]);

  const handleOnboardingComplete = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setOnboardingComplete(true);
    closeStrategyModal();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-2 sm:p-4 transition-colors relative">
      <Head>
        <title>DiversiFi - Protect Your Savings</title>
        <meta name="description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />

        <meta property="og:title" content="DiversiFi - Protect Your Savings" />
        <meta property="og:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DiversiFi - Protect Your Savings" />
        <meta name="twitter:description" content="Diversify your stablecoin savings across regions to protect against currency debasement" />
        <meta name="twitter:image" content={ogImageUrl} />

        <meta name="fc:miniapp" content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button, action: { ...farcasterMeta.button.action, type: "launch_miniapp" } } })} />
        <meta name="fc:frame" content={JSON.stringify({ ...farcasterMeta, button: { ...farcasterMeta.button.action, type: "launch_frame" } })} />
      </Head>

      {/* Onboarding gate: show only the StrategyModal for first-time users */}
      {!onboardingComplete && (
        <StrategyModal
          isOpen={true}
          onClose={handleOnboardingComplete}
          onConnectWallet={connectWallet}
          isWalletConnected={!!address}
          chainId={undefined}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* App shell: full app for returning/completed users */}
      {onboardingComplete && <AppShell />}
    </div>
  );
}
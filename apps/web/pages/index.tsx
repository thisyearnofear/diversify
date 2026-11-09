import { useState } from "react";
import Head from "next/head";
import { useWalletContext } from "../components/wallet/WalletProvider";
import AppShell from "../components/app/AppShell";
import StrategyModal, { useStrategyModal } from "../components/onboarding/StrategyModal";

const ogImageUrl = "https://diversifi.persidian.com/embed-image.png";
// Brand MP4 hosted on Lens Grove (immutable, chain_id=1) — repo keeps only SVGs.
// See .perch/svgator-lab/lens-manifest.json for the full media manifest.
const ogVideoUrl = "https://api.grove.storage/5b9d2f61c4201c998c18dfb25e2e740db7b88b39bc1535130d0ba87738b792c8";

const farcasterMeta = {
  version: "1",
  imageUrl: ogImageUrl,
  button: {
    title: "Open DiversiFi",
    action: {
      name: "DiversiFi",
      url: "https://diversifi.persidian.com",
      splashImageUrl: "https://diversifi.persidian.com/splash.png",
      splashBackgroundColor: "#8B5CF6",
    },
  },
};

export default function DiversiFiPage() {
  const { closeModal: closeStrategyModal } = useStrategyModal();

  const {
    address, connect: connectWallet,
  } = useWalletContext();

  // Onboarding gate — show only the modal until user completes
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("onboardingCompleted") === "true";
  });

  const handleOnboardingComplete = () => {
    setOnboardingComplete(true);
    closeStrategyModal();
  };

  return (
    <div className="min-h-screen bg-transparent p-2 sm:p-4 transition-colors relative">
      <Head>
        <title>DiversiFi - Shield Your Savings</title>
        <meta name="description" content="Understand your currency risk and choose a values-driven protection philosophy — from Africapitalism to Islamic Finance" />

        <meta property="og:title" content="DiversiFi - Shield Your Savings" />
        <meta property="og:description" content="Understand your currency risk and choose a values-driven protection philosophy" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:video" content={ogVideoUrl} />
        <meta property="og:video:secure_url" content={ogVideoUrl} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1200" />
        <meta property="og:video:height" content="630" />
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

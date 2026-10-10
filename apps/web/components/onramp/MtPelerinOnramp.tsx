import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { NETWORKS } from "../../config";
import { OnrampModal } from "./OnrampModal";

export interface MtPelerinOnrampProps {
  mode?: "buy" | "sell" | "swap";
  className?: string;
  compact?: boolean;
  variant?: "default" | "white" | "outline";
  /** Token symbol the user actually needs — prefilled as the widget's
   *  destination currency when it's one the ramp sells (see MTP_BUYABLE).
   *  Anything else buys USDC, the closest bridgeable asset. */
  neededAsset?: string;
  /** Fiat amount (USD) prefill — the intent's gap + buffer, never a
   *  generic round number when we can compute the real one. */
  neededAmountUsd?: number;
  /** Called once when the widget opens — callers persist the paused
   *  intent (pending-fund) so Home can resume it on arrival. */
  onBuyStarted?: () => void;
}

// Mt Pelerin widget configuration
// Uses their public widget - no API key required for basic integration
// Full documentation: https://developers.mtpelerin.com

const MTP_WIDGET_BASE = "https://widget.mtpelerin.com";

const MTP_BRAND = {
  icon: "🏦",
  name: "Mt Pelerin",
  tagline: "Secure Swiss Ramp",
  badge: "Swiss Regulated",
  infoUrl: "https://www.mtpelerin.com",
};

/**
 * Widget destination codes verified to render. Keep this small — an
 * unknown `wdc` is worse than a USDC default because the widget silently
 * ignores it. Add symbols only after checking the live widget.
 */
export const MTP_BUYABLE: ReadonlySet<string> = new Set([
  "CELO",
  "CUSD",
  "USDC",
]);

/** The destination code to prefill for a needed app symbol. */
export function mtpDestinationFor(symbol: string | null | undefined): string {
  const s = (symbol ?? "").toUpperCase();
  return MTP_BUYABLE.has(s) ? s : "USDC";
}

function getNetworkName(chainId: number | null): string {
  switch (chainId) {
    case NETWORKS.CELO_MAINNET.chainId:
      return "celo_mainnet";
    case 42161:
      return "arbitrum_mainnet";
    case 1:
      return "mainnet";
    case 137:
      return "matic_mainnet";
    case 8453:
      return "base_mainnet";
    default:
      return "celo_mainnet"; // Default to Celo for DiversiFi
  }
}

export function MtPelerinOnramp({
  mode = "buy",
  className = "",
  compact = false,
  variant = "default",
  neededAsset,
  neededAmountUsd,
  onBuyStarted,
}: MtPelerinOnrampProps) {
  const { address, chainId } = useWalletContext();
  const [isOpen, setIsOpen] = useState(false);
  const [widgetUrl, setWidgetUrl] = useState("");

  // Generate widget URL with parameters
  useEffect(() => {
    if (!address) return;

    const params = new URLSearchParams({
      addr: address,
      lang: "en",
      net: getNetworkName(chainId),
      wdc: mtpDestinationFor(neededAsset), // Wallet Destination Code
      fiat: "USD",
      amount: String(Math.max(1, Math.ceil(neededAmountUsd ?? 100))),
      // Embedded optimizations
      theme: "light",
      redirectUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });

    setWidgetUrl(`${MTP_WIDGET_BASE}/?${params.toString()}`);
  }, [address, chainId, mode, neededAsset, neededAmountUsd]);

  const getModeLabel = () => {
    switch (mode) {
      case "buy":
        return "Buy Crypto";
      case "sell":
        return "Sell Crypto";
      case "swap":
        return "Swap";
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case "buy":
        return "💳";
      case "sell":
        return "💰";
      case "swap":
        return "⚡";
    }
  };

  const getButtonStyles = () => {
    if (variant === "white") {
      return "bg-white text-blue-600 hover:bg-blue-50 shadow-md border-transparent";
    }

    if (variant === "outline") {
      return "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800";
    }

    // Default gradients
    switch (mode) {
      case "buy":
        return "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/30 border-transparent";
      case "sell":
        return "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 border-transparent";
      case "swap":
        return "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 border-transparent";
      default:
        return "";
    }
  };

  // Modal option (iframe)
  const openModal = () => {
    if (widgetUrl) {
      setIsOpen(true);
      onBuyStarted?.();
    }
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  if (!address) {
    return (
      <button
        disabled
        className={`opacity-50 cursor-not-allowed ${className}`}
        title="Connect wallet first"
      >
        {getModeIcon()} {getModeLabel()}
      </button>
    );
  }

  // Compact button style (for dropdowns, small spaces)
  if (compact) {
    return (
      <>
        <button
          onClick={openModal}
          className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
        >
          <span>{getModeIcon()}</span>
          <span>{getModeLabel()}</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <OnrampModal widgetUrl={widgetUrl} onClose={closeModal} brand={MTP_BRAND} />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Full button style
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={openModal}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all border ${getButtonStyles()} ${className}`}
      >
        <span className="text-lg">{getModeIcon()}</span>
        <span>{getModeLabel()}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 ml-1 opacity-70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <OnrampModal widgetUrl={widgetUrl} onClose={closeModal} brand={MTP_BRAND} />
        )}
      </AnimatePresence>
    </>
  );
}

// Convenience exports for specific modes
export function BuyCryptoButton(props: Omit<MtPelerinOnrampProps, "mode">) {
  return <MtPelerinOnramp {...props} mode="buy" />;
}

export function SellCryptoButton(props: Omit<MtPelerinOnrampProps, "mode">) {
  return <MtPelerinOnramp {...props} mode="sell" />;
}

// Widget for embedding directly in a page (not modal)
export function MtPelerinWidget({
  height = "500px",
  className = "",
}: {
  height?: string;
  className?: string;
}) {
  const { address, chainId } = useWalletContext();
  const [widgetUrl, setWidgetUrl] = useState("");

  useEffect(() => {
    if (!address) return;

    const params = new URLSearchParams({
      type: "direct-link",
      tabs: "buy,sell,swap",
      tab: "buy",
      addr: address,
      lang: "en",
      net: chainId === NETWORKS.CELO_MAINNET.chainId ? "celo" : chainId === NETWORKS.ARBITRUM_ONE.chainId ? "arbitrum" : "celo",
    });

    setWidgetUrl(`${MTP_WIDGET_BASE}/?${params.toString()}`);
  }, [address, chainId]);

  if (!address) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Connect wallet to access fiat on-ramp
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <iframe
        src={widgetUrl}
        title="Mt Pelerin Exchange"
        className="w-full border-0"
        style={{ height }}
        allow="usb; ethereum; clipboard-write; payment; microphone; camera"
      />
    </div>
  );
}

export default MtPelerinOnramp;

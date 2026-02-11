import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";

export interface MtPelerinOnrampProps {
  mode?: "buy" | "sell" | "swap";
  className?: string;
  compact?: boolean;
  variant?: "default" | "white" | "outline";
}

// Mt Pelerin widget configuration
// Uses their public widget - no API key required for basic integration
// Full documentation: https://developers.mtpelerin.com

const MTP_WIDGET_BASE = "https://widget.mtpelerin.com";

function getNetworkName(chainId: number | null): string {
  switch (chainId) {
    case 42220:
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
      wdc: "CELO", // Wallet Destination Code
      fiat: "USD",
      amount: "100",
      // Embedded optimizations
      theme: "light",
      redirectUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });

    setWidgetUrl(`${MTP_WIDGET_BASE}/?${params.toString()}`);
  }, [address, chainId, mode]);

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
            <MtPelerinModal widgetUrl={widgetUrl} onClose={closeModal} />
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
          <MtPelerinModal widgetUrl={widgetUrl} onClose={closeModal} />
        )}
      </AnimatePresence>
    </>
  );
}

// Modal component for iframe embed
interface MtPelerinModalProps {
  widgetUrl: string;
  onClose: () => void;
}

function MtPelerinModal({ widgetUrl, onClose }: MtPelerinModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Safety timeout - if iframe doesn't load in 5 seconds, show fallback option
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) setShowFallback(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏦</span>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-white leading-tight">
                Mt Pelerin
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Secure Swiss Ramp
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Widget iframe container - Flexible height for mobile */}
        <div className="flex-1 relative w-full min-h-0 bg-gray-50 dark:bg-gray-900">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500 font-medium">
                Loading secure widget...
              </p>
              <p className="text-xs text-gray-400 mt-2 max-w-[200px]">
                Connecting to Mt Pelerin&apos;s Swiss infrastructure
              </p>

              {showFallback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <a
                    href={widgetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <span>Taking too long? Open in browser</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
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
                  </a>
                </motion.div>
              )}
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <span className="text-4xl mb-4">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Unable to load widget
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-[240px]">
                Your browser or network settings might be blocking the embedded
                view.
              </p>
              <a
                href={widgetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                Open in New Window
              </a>
            </div>
          ) : (
            <iframe
              src={widgetUrl}
              title="Mt Pelerin Exchange"
              className={`w-full h-full border-0 transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
              allow="usb; ethereum; clipboard-write; payment; microphone; camera"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-none px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 safe-area-pb">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Swiss Regulated</span>
            </div>
            <a
              href="https://www.mtpelerin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-500 transition-colors flex items-center gap-1"
            >
              <span>Info</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
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
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
      net: chainId === 42220 ? "celo" : chainId === 42161 ? "arbitrum" : "celo",
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

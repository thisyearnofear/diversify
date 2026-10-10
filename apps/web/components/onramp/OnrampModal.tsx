import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Scrim from "../shared/Scrim";

export interface OnrampBrand {
  icon: string;
  name: string;
  tagline: string;
  badge: string;
  infoUrl: string;
}

interface OnrampModalProps {
  widgetUrl: string;
  onClose: () => void;
  brand: OnrampBrand;
}

// One modal for every embedded ramp widget — brand and URL are props,
// loading/fallback/error chrome is shared.
export function OnrampModal({ widgetUrl, onClose, brand }: OnrampModalProps) {
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
    <>
      {/* Scrim is a sibling, not a child: nested, its fixed z-[49] would
          paint above the panel (z-auto) and swallow its clicks. */}
      <Scrim intensity="heavy" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
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
            <span className="text-lg">{brand.icon}</span>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-white leading-tight">
                {brand.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {brand.tagline}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
                Connecting to {brand.name}&apos;s infrastructure
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
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
              >
                Open in New Window
              </a>
            </div>
          ) : (
            <iframe
              src={widgetUrl}
              title={`${brand.name} Exchange`}
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
              <span>{brand.badge}</span>
            </div>
            <a
              href={brand.infoUrl}
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
    </>
  );
}

export default OnrampModal;

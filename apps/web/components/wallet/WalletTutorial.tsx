import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletContext } from './WalletProvider';

/**
 * WalletTutorial — one screen, one job: connect.
 *
 * Used to be a 3-step carousel (pitch → security lecture → connect), which
 * put two screens of persuasion between the visitor and the button they had
 * already decided to tap. Now the connect options are the screen, and the
 * trust claims compress to one quiet line (§7: honesty styled as restraint).
 */
export const WalletTutorial: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  isMiniPay?: boolean;
}> = ({ isOpen, onClose, onConnect, isMiniPay = false }) => {
  const { isConnected } = useWalletContext();
  const wasConnectedRef = useRef(isConnected);

  useEffect(() => {
    if (isOpen) {
      wasConnectedRef.current = isConnected;
    }
  }, [isOpen, isConnected]);

  useEffect(() => {
    if (isOpen && isConnected && !wasConnectedRef.current) {
      onClose();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, isOpen, onClose]);

  const handleConnect = async () => {
    try {
      await onConnect();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto custom-scrollbar bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 p-6 md:p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 min-h-11 min-w-11 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon — no ambient pulse; the moment is the connect */}
            <div className="size-16 md:size-20 bg-white dark:bg-gray-800 rounded-2xl shadow-lg flex items-center justify-center border border-gray-100 dark:border-gray-700 mx-auto mb-4">
              <span className="text-3xl md:text-4xl select-none">{isMiniPay ? '📱' : '👛'}</span>
            </div>

            <h3 className="text-2xl font-[900] tracking-tight text-gray-900 dark:text-white mb-2">
              {isMiniPay ? (
                'MiniPay ready'
              ) : (
                <>Connect your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">wallet</span></>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
              {isMiniPay
                ? 'Your MiniPay wallet is detected — one tap links it.'
                : 'Balances, protection, and swaps — self-custodied the whole way.'}
            </p>

            {isMiniPay ? (
              <motion.button
                onClick={handleConnect}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 p-4 mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-base font-black">MP</span>
                Connect MiniPay
              </motion.button>
            ) : (
              <div className="space-y-3 mb-3">
                <motion.button
                  onClick={handleConnect}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <span className="text-white text-xl">🔗</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">I have a wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">MetaMask, Coinbase, WalletConnect, and more</p>
                  </div>
                </motion.button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">or</span>
                  </div>
                </div>

                <motion.button
                  onClick={handleConnect}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <span className="text-white text-xl">✉️</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">Create with email</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No wallet needed — just your email</p>
                  </div>
                </motion.button>
              </div>
            )}

            {/* Trust — one quiet line instead of three cards and an amber box */}
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              🔒 Non-custodial · read-only access · you approve every transaction
            </p>

            <button
              onClick={onClose}
              className="mt-3 min-h-[44px] px-4 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * REMOVED auto-trigger for Wallet Tutorial
 * Users should connect wallet on their own terms, not be forced through tutorial first
 * The "Connect Wallet" button in the header is now always visible and accessible
 * Users can still access the tutorial manually if they want help
 */
export const useWalletTutorial = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const { isMiniPay } = useWalletContext();

  // No longer auto-opens tutorial - users can access it manually via header help button
  // This reduces friction for wallet connection

  const openTutorial = () => setIsTutorialOpen(true);
  const closeTutorial = () => setIsTutorialOpen(false);

  return {
    isTutorialOpen,
    openTutorial,
    closeTutorial,
    isMiniPay
  };
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletContext } from './WalletProvider';

const isDev = process.env.NODE_ENV === 'development';

export const WalletTutorial: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  isMiniPay?: boolean;
}> = ({ isOpen, onClose, onConnect, isMiniPay = false }) => {
  const [step, setStep] = useState(1);
  const { isConnected } = useWalletContext();
  const wasConnectedRef = useRef(isConnected);

  const totalSteps = 3;

  useEffect(() => {
    if (isOpen) {
      setStep(1);
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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-x-auto md:inset-y-8 md:w-full md:max-w-lg md:mx-auto z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="p-6 md:p-10 pb-0">
                <button
                  onClick={onClose}
                  className="absolute top-5 right-5 md:top-6 md:right-6 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex items-center justify-center mb-8">
                  <div className="flex space-x-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          width: i + 1 === step ? 24 : 8,
                          backgroundColor: i + 1 === step ? '#3b82f6' : i + 1 < step ? '#22c55e' : '#d1d5db',
                        }}
                        className="h-2 rounded-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 px-6 md:px-10">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="text-center"
                    >
                      <motion.div
                        className="mb-6 relative mx-auto w-fit"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', duration: 0.8 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 blur-2xl rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                        <div className="relative size-20 md:size-24 bg-white dark:bg-gray-800 rounded-[1.5rem] md:rounded-[2rem] shadow-xl flex items-center justify-center border border-gray-100 dark:border-gray-700">
                          <span className="text-4xl md:text-5xl select-none">👛</span>
                        </div>
                      </motion.div>

                      <h3 className="text-2xl md:text-3xl font-[900] tracking-tight text-gray-900 dark:text-white mb-3">
                        Connect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Wallet</span>
                      </h3>
                      <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto leading-relaxed font-medium">
                        Start protecting your savings on Celo{isDev && ' and Arc'} with multi-region stablecoins.
                      </p>

                      <div className="grid grid-cols-3 gap-3 mb-6">
                        {[
                          { icon: '💰', label: 'View Balances', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                          { icon: '🛡️', label: 'Protect Savings', bg: 'bg-green-100 dark:bg-green-900/30' },
                          { icon: '🔄', label: 'Swap Currencies', bg: 'bg-purple-100 dark:bg-purple-900/30' },
                        ].map((item) => (
                          <div key={item.label} className="flex flex-col items-center">
                            <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center mb-2`}>
                              <span className="text-xl">{item.icon}</span>
                            </div>
                            <span className="text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400">{item.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/30 text-left">
                        <p className="text-blue-700 dark:text-blue-300 font-bold text-xs mb-2">Why connect?</p>
                        <ul className="text-blue-600 dark:text-blue-400 text-xs space-y-1 font-medium">
                          <li>Personalized inflation protection</li>
                          <li>Advanced wealth strategies</li>
                          <li>Voice-powered insights</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="text-center"
                    >
                      <div className="size-20 md:size-24 bg-white dark:bg-gray-800 rounded-[1.5rem] md:rounded-[2rem] shadow-xl flex items-center justify-center border border-gray-100 dark:border-gray-700 mx-auto mb-6">
                        <span className="text-4xl md:text-5xl select-none">🔐</span>
                      </div>

                      <h3 className="text-2xl md:text-3xl font-[900] tracking-tight text-gray-900 dark:text-white mb-3">
                        Safe & Secure
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
                        Your security is our priority. We never store your private keys.
                      </p>

                      <div className="space-y-3 mb-6">
                        {[
                          { title: 'Non-custodial', desc: 'Only you control your funds' },
                          { title: 'Read-only access', desc: 'We only see balances, never move funds' },
                          { title: 'Industry standard', desc: 'Uses WalletConnect secure protocol' },
                        ].map((item, i) => (
                          <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-left"
                          >
                            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mr-3 mt-0.5 shrink-0">
                              <span className="text-green-600 dark:text-green-400 text-xs font-bold">&#10003;</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">{item.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30 text-left">
                        <p className="text-amber-800 dark:text-amber-200 font-bold text-xs mb-1">Good to know</p>
                        <p className="text-amber-700 dark:text-amber-300 text-xs font-medium">
                          You approve each transaction in your wallet. We can never access your funds without permission.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="text-center"
                    >
                      <div className="size-20 md:size-24 bg-white dark:bg-gray-800 rounded-[1.5rem] md:rounded-[2rem] shadow-xl flex items-center justify-center border border-gray-100 dark:border-gray-700 mx-auto mb-6">
                        <span className="text-4xl md:text-5xl select-none">📱</span>
                      </div>

                      <h3 className="text-2xl md:text-3xl font-[900] tracking-tight text-gray-900 dark:text-white mb-2">
                        {isMiniPay ? 'MiniPay Ready' : 'Get Started'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
                        {isMiniPay ? 'Your MiniPay wallet is detected and ready.' : 'Choose how you want to connect.'}
                      </p>

                      {isMiniPay ? (
                        <div className="mb-6">
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                              <span className="text-white text-2xl font-black">MP</span>
                            </div>
                            <h4 className="font-bold text-blue-700 dark:text-blue-300 mb-1">MiniPay Detected</h4>
                            <p className="text-blue-600 dark:text-blue-400 text-xs text-center font-medium">
                              Tap below for seamless connection.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-6">
                          <motion.button
                            onClick={handleConnect}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all text-left"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                              <span className="text-white text-xl">🔗</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">I Have a Wallet</p>
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium">MetaMask, Coinbase, WalletConnect, and more</p>
                            </div>
                          </motion.button>

                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                              <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">
                                or create new wallet
                              </span>
                            </div>
                          </div>

                          <motion.button
                            onClick={handleConnect}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all text-left"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                              <span className="text-white text-xl">&#9993;&#65039;</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 dark:text-white">Create with Email</p>
                              <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium">Easiest option - uses your email address</p>
                            </div>
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="p-6 md:px-10 md:pb-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-t border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center">
                {step > 1 ? (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Skip
                  </button>
                )}

                {step < totalSteps ? (
                  <motion.button
                    onClick={() => setStep(step + 1)}
                    whileHover={{ y: -1 }}
                    className="px-6 md:px-8 py-3 md:py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl md:rounded-[1.5rem] font-black text-sm shadow-lg active:scale-95 transition-all"
                  >
                    Next
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleConnect}
                    whileHover={{ y: -1 }}
                    className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl md:rounded-[1.5rem] font-black text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Connect Wallet
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const useWalletTutorial = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const { isMiniPay, isFarcaster, isConnected } = useWalletContext();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isMiniPay || isFarcaster || isConnected) return;

    const hasSeenTutorial = localStorage.getItem('hasSeenWalletTutorial') === 'true';
    if (hasSeenTutorial) return;

    // Auto-open tutorial after strategy modal OR if user dismissed strategy modal
    const hasSeenStrategyModal = localStorage.getItem('hasSeenStrategyModal') === 'true';

    const timer = setTimeout(() => {
      setIsTutorialOpen(true);
      localStorage.setItem('hasSeenWalletTutorial', 'true');
    }, hasSeenStrategyModal ? 1500 : 3000); // Longer delay if no strategy modal

    return () => clearTimeout(timer);
  }, [isMiniPay, isFarcaster, isConnected]);

  const openTutorial = () => setIsTutorialOpen(true);
  const closeTutorial = () => setIsTutorialOpen(false);

  return {
    isTutorialOpen,
    openTutorial,
    closeTutorial,
    isMiniPay
  };
};

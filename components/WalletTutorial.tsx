import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletContext } from './WalletProvider';

// Wallet provider icons
const WalletIcons = {
  MetaMask: '/wallets/metamask.svg',
  WalletConnect: '/wallets/walletconnect.svg',
  Coinbase: '/wallets/coinbase.svg',
  TrustWallet: '/wallets/trustwallet.svg',
  MiniPay: '/wallets/minipay.svg'
};

export const WalletTutorial: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
  isMiniPay?: boolean;
}> = ({ isOpen, onClose, onConnect, isMiniPay = false }) => {
  const [step, setStep] = useState(1);
  const { chainId } = useWalletContext();
  const _isArc = chainId === 5042002;

  const totalSteps = isMiniPay ? 3 : 4;

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  const handleConnect = async () => {
    try {
      await onConnect();
      onClose();
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Step indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex space-x-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i + 1 === step ? 'bg-blue-600 scale-125' : i + 1 < step ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            </div>

            {/* Tutorial content */}
            <div className="text-center">
              {step === 1 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">👛 Connect Your Wallet</h3>
                  <p className="text-gray-600 mb-6">
                    Connect your wallet to start protecting your savings. We support Celo and Arc networks for multi-region stablecoins.
                  </p>

                  <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
                    <p className="text-blue-700 font-medium mb-2">✨ Why connect?</p>
                    <ul className="text-blue-600 text-sm space-y-1">
                      <li>• View your stablecoin balances</li>
                      <li>• Get personalized inflation protection</li>
                      <li>• Swap between regional stablecoins</li>
                      <li>• Access advanced wealth strategies</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                        <span className="text-blue-600 text-xl">💰</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700">View Balances</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                        <span className="text-green-600 text-xl">🛡️</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700">Protect Savings</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                        <span className="text-purple-600 text-xl">🔄</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700">Swap Currencies</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">🔐 Safe & Secure</h3>
                  <p className="text-gray-600 mb-6">
                    Your security is our priority. We never store your private keys.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-1">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Non-custodial</p>
                        <p className="text-sm text-gray-600">Only you control your funds</p>
                      </div>
                    </div>

                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-1">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Read-only access</p>
                        <p className="text-sm text-gray-600">We only see balances, never move funds</p>
                      </div>
                    </div>

                    <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3 mt-1">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Industry standard</p>
                        <p className="text-sm text-gray-600">Uses WalletConnect secure protocol</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                    <p className="text-yellow-700 font-medium mb-2">💡 Good to know</p>
                    <p className="text-yellow-600 text-sm">
                      You&#39;ll need to approve each transaction in your wallet app. We can&#39;t access your funds without your permission.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">📱 Choose Your Wallet</h3>
                  <p className="text-gray-600 mb-6">
                    {isMiniPay ? 'MiniPay detected! Ready to connect.' : 'Select your preferred wallet provider.'}
                  </p>

                  {isMiniPay ? (
                    <div className="mb-6">
                      <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                        <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <span className="text-blue-600 text-3xl font-bold">MP</span>
                        </div>
                        <h4 className="font-bold text-blue-700 mb-2">MiniPay Ready</h4>
                        <p className="text-blue-600 text-sm text-center">
                          Your MiniPay wallet is detected and ready for seamless connection.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {Object.entries(WalletIcons).map(([name]) => (
                        <div key={name} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center mb-2">
                            <span className="text-gray-600 font-bold text-xs">{name.slice(0, 2)}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-700">{name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 font-medium mb-2">📲 Mobile users</p>
                    <p className="text-gray-600 text-sm">
                      {isMiniPay ? 'MiniPay will open automatically' : 'Your wallet app will open to confirm the connection'}
                    </p>
                  </div>
                </div>
              )}

              {!isMiniPay && step === 4 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">🎉 Ready to Connect!</h3>
                  <p className="text-gray-600 mb-6">
                    Click below to connect your wallet and start your wealth protection journey.
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-green-700 font-medium">Instant access</span>
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-green-700 font-medium">No signup required</span>
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-green-700 font-medium">Free to use</span>
                      <span className="text-green-600 text-sm">✓</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center mt-8">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                >
                  ← Back
                </button>
              )}

              {step < totalSteps ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${step === 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
                >
                  {step === totalSteps - 1 ? 'Continue' : 'Next'} →
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const useWalletTutorial = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const { isMiniPay } = useWalletContext();

  const openTutorial = () => setIsTutorialOpen(true);
  const closeTutorial = () => setIsTutorialOpen(false);

  return {
    isTutorialOpen,
    openTutorial,
    closeTutorial,
    isMiniPay
  };
};
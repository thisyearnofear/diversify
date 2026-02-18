import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletContext } from './WalletProvider';
import { useToast } from '../ui/Toast';
import { SmartBuyCryptoButton, SmartSellCryptoButton } from '../onramp';
import { WALLET_FEATURES } from '../../config/features';
import { NETWORKS, isTestnetChain } from '../../config';

// FarCaster Mini App supported chains (as of 2025)
// Source: https://github.com/farcasterxyz/miniapps/discussions/240
const FARCASTER_SUPPORTED_CHAINS = [
  NETWORKS.CELO_MAINNET.chainId,  // ✅ Supported
  NETWORKS.ARBITRUM_ONE.chainId,  // ✅ Supported
  NETWORKS.ALFAJORES.chainId,     // ✅ Supported (Celo testnet)
  // Other chains not in this app: Base, Optimism, Ethereum, Polygon, Unichain, Zora
  // Note: Arc Testnet & Robinhood Testnet are NOT supported in FarCaster
];

// Chain metadata for UI
const CHAIN_METADATA: Record<number, { icon: string; color: string; farcasterSupported: boolean }> = {
  [NETWORKS.CELO_MAINNET.chainId]: { icon: '🌱', color: 'green', farcasterSupported: true },
  [NETWORKS.ARBITRUM_ONE.chainId]: { icon: '🔷', color: 'blue', farcasterSupported: true },
  [NETWORKS.ARC_TESTNET.chainId]: { icon: '⚡', color: 'purple', farcasterSupported: false },
  [NETWORKS.RH_TESTNET.chainId]: { icon: '📈', color: 'orange', farcasterSupported: false },
  [NETWORKS.ALFAJORES.chainId]: { icon: '🧪', color: 'yellow', farcasterSupported: true },
};

type ButtonVariant = 'primary' | 'secondary' | 'inline' | 'minimal';

interface WalletButtonProps {
  variant?: ButtonVariant;
  className?: string;
  onConnect?: (address: string) => void;
}

export default function WalletButton({
  variant = 'primary',
  className = "",
  onConnect
}: WalletButtonProps) {
  const {
    address,
    isConnected,
    isConnecting,
    error: walletError,
    isMiniPay,
    isFarcaster,
    chainId,
    connect,
    disconnect,
    formatAddress,
    switchNetwork,
  } = useWalletContext();

  // Privy integration (always call hooks, but check if enabled)
  const privy = usePrivy();
  const isPrivyUser = WALLET_FEATURES.PRIVY_ENABLED &&
    WALLET_FEATURES.PRIVY_APP_ID &&
    privy.authenticated &&
    privy.user;

  const { showToast } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const prevAddressRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (address && !prevAddressRef.current) {
      showToast("Wallet connected successfully", "success");
    }
    if (address && onConnect) {
      onConnect(address);
    }
    prevAddressRef.current = address;
  }, [address, onConnect, showToast]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Error in WalletButton handleConnect:", error);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      showToast("Address copied to clipboard!", "success");
      setShowDropdown(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      showToast("Wallet disconnected", "success");
      setShowDropdown(false);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      showToast("Failed to disconnect wallet", "error");
    }
  };

  // Network helpers
  const isTestnet = isTestnetChain(chainId);
  const networkName = chainId ? 
    Object.values(NETWORKS).find(n => n.chainId === chainId)?.name || 'Unknown' : 
    'Not Connected';
  
  // Get the opposite network for toggling
  const getToggleNetwork = () => {
    if (isTestnet) {
      // Switch to mainnet (Celo or Arbitrum)
      return NETWORKS.CELO_MAINNET.chainId;
    } else {
      // Switch to Robinhood testnet (showcase stock tokenization)
      return NETWORKS.RH_TESTNET.chainId;
    }
  };

  const handleToggleNetwork = async () => {
    try {
      const targetChain = getToggleNetwork();
      const targetName = isTestnet ? 'Mainnet' : 'Testnet';
      
      showToast(`Requesting ${targetName}...`, "info");
      await switchNetwork(targetChain);
      
      // Wait a moment and check if actually switched
      setTimeout(() => {
        if (chainId === targetChain) {
          showToast(`Switched to ${targetName}`, "success");
        } else {
          showToast(`Please confirm the network switch in your wallet`, "info");
        }
      }, 1000);
      
      setShowDropdown(false);
    } catch (error: any) {
      console.error("Error switching network:", error);
      if (error?.message?.includes('rejected') || error?.code === 4001) {
        showToast("Network switch cancelled", "info");
      } else {
        showToast("Failed to switch network. Try manually in your wallet.", "error");
      }
    }
  };

  const handleSwitchToChain = async (targetChainId: number) => {
    try {
      const network = Object.values(NETWORKS).find(n => n.chainId === targetChainId);
      showToast(`Switching to ${network?.name}...`, "info");
      await switchNetwork(targetChainId);
      setShowChainSelector(false);
      setShowDropdown(false);
      
      setTimeout(() => {
        if (chainId === targetChainId) {
          showToast(`Connected to ${network?.name}`, "success");
        }
      }, 1000);
    } catch (error: any) {
      console.error("Error switching chain:", error);
      if (error?.message?.includes('rejected') || error?.code === 4001) {
        showToast("Network switch cancelled", "info");
      } else {
        showToast("Failed to switch network", "error");
      }
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30";
      case 'secondary':
        return "bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-300 shadow-sm";
      case 'inline':
        return "bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md";
      case 'minimal':
        return "bg-transparent text-blue-600 hover:underline px-0 py-0";
      default:
        return "";
    }
  };

  // 1. Connected State
  if (address) {
    // Determine display text based on connection type
    const privyEmail = isPrivyUser && privy.user?.email
      ? (typeof privy.user.email === 'string' ? privy.user.email : privy.user.email.address)
      : null;

    const displayText = privyEmail || formatAddress(address);
    const displayIcon = privyEmail ? '📧' : '🔗';

    return (
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center space-x-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm min-w-[48px] min-h-[48px] px-4 py-3 rounded-full text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-md transition-all duration-200 ${className}`}
          aria-label="Wallet menu"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">{displayIcon} {displayText}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-1">
              {/* Network Status with Chain Selector */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                {!showChainSelector ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setShowChainSelector(true)}
                        className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded hover:opacity-80 transition-opacity ${isTestnet ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}
                      >
                        {isTestnet ? 'TESTNET' : 'MAINNET'}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowChainSelector(true)}
                        className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        {networkName}
                      </button>
                    </div>
                    <button
                      onClick={handleToggleNetwork}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Switch to {isTestnet ? 'Mainnet' : 'Testnet'}
                    </button>
                  </>
                ) : (
                  <ChainSelector 
                    chainId={chainId}
                    isFarcaster={isFarcaster}
                    onSelectChain={handleSwitchToChain}
                    onClose={() => setShowChainSelector(false)}
                  />
                )}
              </div>

              {/* Fiat On/Off Ramp - Mt Pelerin */}
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Fiat Ramp</p>
                <div className="space-y-1">
                  <SmartBuyCryptoButton compact className="rounded-lg" />
                  <SmartSellCryptoButton compact className="rounded-lg" />
                </div>
              </div>

              <button
                onClick={copyAddress}
                className="flex items-center w-full min-h-[44px] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Copy wallet address"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy Address
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center w-full min-h-[44px] px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Disconnect wallet"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // 2. Connecting State
  if (isConnecting) {
    return (
      <motion.button
        disabled
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className={`flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30 border border-blue-200 dark:border-blue-700 px-5 py-2.5 rounded-full text-blue-700 dark:text-blue-300 cursor-wait ${className}`}
      >
        <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 dark:border-blue-600 dark:border-t-blue-300 rounded-full animate-spin" />
        <span className="text-sm font-bold">Connecting...</span>
      </motion.button>
    );
  }

  // 3. MiniPay Syncing State
  if (isMiniPay && !isConnected) {
    return (
      <div className={`inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full ${className}`}>
        <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm">MiniPay Syncing...</span>
      </div>
    );
  }

  // 4. Default: Connect Wallet
  // Detect if user likely has an injected wallet
  const hasInjectedWallet = typeof window !== 'undefined' && !!(window as typeof window & { ethereum?: unknown }).ethereum;

  return (
    <div className="flex flex-col items-end">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleConnect}
        className={`group relative flex items-center justify-center px-5 py-2 rounded-full font-medium transition-all duration-300 overflow-hidden ${getVariantClasses()} ${className}`}
        title={hasInjectedWallet ? "Connect with MetaMask/Coinbase or other browser wallet" : "Connect via WalletConnect, Email, or Social login"}
      >
        {variant === 'primary' && (
          <div className="absolute top-0 -left-10 w-10 h-full bg-white/20 skew-x-[25deg] group-hover:animate-[shine_1s_infinite]" />
        )}

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span>Connect Wallet</span>
      </motion.button>
      {walletError && (
        <p className="text-red-500 text-[10px] mt-1 font-medium">{walletError}</p>
      )}
    </div>
  );
}

// ============================================================================
// CHAIN SELECTOR SUB-COMPONENT
// ============================================================================

interface ChainSelectorProps {
  chainId: number | null;
  isFarcaster: boolean;
  onSelectChain: (chainId: number) => void;
  onClose: () => void;
}

function ChainSelector({ chainId, isFarcaster, onSelectChain, onClose }: ChainSelectorProps) {
  const [showChainlistHelp, setShowChainlistHelp] = useState<number | null>(null);
  
  const mainnetChains = [
    { id: NETWORKS.CELO_MAINNET.chainId, name: 'Celo', icon: '🌱', desc: 'Low fees, mobile-first' },
    { id: NETWORKS.ARBITRUM_ONE.chainId, name: 'Arbitrum', icon: '🔷', desc: 'Deep liquidity, RWAs' },
  ];
  
  const testnetChains = [
    { id: NETWORKS.ARC_TESTNET.chainId, name: 'Arc', icon: '⚡', desc: 'High performance L2' },
    { id: NETWORKS.RH_TESTNET.chainId, name: 'Robinhood', icon: '📈', desc: 'Stock tokenization' },
    { id: NETWORKS.ALFAJORES.chainId, name: 'Alfajores', icon: '🧪', desc: 'Celo testnet' },
  ];

  const handleChainClick = (chainId: number) => {
    onSelectChain(chainId);
  };

  const openChainlist = (chainId: number) => {
    const chainNames: Record<number, string> = {
      [NETWORKS.ARC_TESTNET.chainId]: 'arc-testnet',
      [NETWORKS.RH_TESTNET.chainId]: 'robinhood-testnet',
      [NETWORKS.ALFAJORES.chainId]: 'celo-alfajores',
    };
    const chainName = chainNames[chainId];
    if (chainName) {
      window.open(`https://chainlist.org/?search=${chainName}`, '_blank');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Select Network</span>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* FarCaster Warning */}
      {isFarcaster && (
        <div className="px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
          <p className="text-[10px] text-blue-700 dark:text-blue-300">
            <span className="font-bold">ℹ️ FarCaster Mode:</span> Only Celo, Arbitrum & Alfajores supported
          </p>
        </div>
      )}
      
      {/* Mainnet Chains */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Mainnet</span>
        {mainnetChains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => handleChainClick(chain.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              chainId === chain.id 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span>{chain.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-medium">{chain.name}</div>
              <div className="text-[10px] opacity-70">{chain.desc}</div>
            </div>
            {chainId === chain.id && <span>✓</span>}
          </button>
        ))}
      </div>
      
      {/* Testnet Chains */}
      <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Testnet</span>
        {testnetChains.map((chain) => {
          const isSupported = CHAIN_METADATA[chain.id]?.farcasterSupported;
          const isDisabled = isFarcaster && !isSupported;
          
          return (
            <div key={chain.id} className="relative">
              <button
                onClick={() => isDisabled ? null : handleChainClick(chain.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  chainId === chain.id 
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' 
                    : isDisabled
                      ? 'opacity-50 cursor-not-allowed text-gray-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>{chain.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium flex items-center gap-1">
                    {chain.name}
                    {isDisabled && (
                      <span className="text-[9px] bg-gray-200 dark:bg-gray-700 px-1 rounded">FarCaster</span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-70">{chain.desc}</div>
                </div>
                {chainId === chain.id && <span>✓</span>}
                {/* Help icon for adding network */}
                {!isDisabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChainlistHelp(showChainlistHelp === chain.id ? null : chain.id);
                    }}
                    className="ml-auto p-1 text-gray-400 hover:text-blue-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Network not in wallet?"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </button>
              
              {/* Chainlist Help Tooltip */}
              {showChainlistHelp === chain.id && (
                <div className="absolute z-10 right-0 top-full mt-1 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                  <p className="mb-1">Network not in wallet?</p>
                  <button
                    onClick={() => openChainlist(chain.id)}
                    className="text-blue-300 hover:text-blue-200 underline"
                  >
                    Add via Chainlist →
                  </button>
                  <button 
                    onClick={() => setShowChainlistHelp(null)}
                    className="absolute top-1 right-1 text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Chainlist Footer */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
          Missing a network?{' '}
          <button 
            onClick={() => window.open('https://chainlist.org', '_blank')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Find it on Chainlist
          </button>
        </p>
      </div>
    </div>
  );
}

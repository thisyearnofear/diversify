/**
 * Farcaster-specific Wallet Button
 * Provides Farcaster-branded wallet connection UI
 */

import { useWalletContext } from './WalletProvider';
import { useState } from 'react';

export default function FarcasterWalletButton() {
  const {
    isFarcaster,
    isConnected,
    isConnecting,
    address,
    connectFarcasterWallet,
    disconnect,
    formatAddress,
    // farcasterContext: _farcasterContext - commented out unused variable
  } = useWalletContext();

  const [showDropdown, setShowDropdown] = useState(false);

  // Don't show if not in Farcaster environment
  if (!isFarcaster) {
    return null;
  }

  // Extract username from Farcaster context
  // const username = farcasterContext?.username || 'User';

  if (isConnected && address) {
    return (
      <div className="relative">
        {/* Connected State - Farcaster Style */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-700 dark:text-purple-300 min-h-[40px] px-3 py-1.5 rounded-full transition-all duration-200 font-bold shadow-sm"
          disabled={isConnecting}
          aria-label="Farcaster wallet menu"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-mono">{formatAddress(address)}</span>
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 border border-purple-100 dark:border-purple-900">
            <div className="py-1">
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full text-left min-h-[44px] px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                aria-label="Disconnect Farcaster wallet"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Disconnect Wallet
                </span>
              </button>
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-purple-100 dark:border-purple-900 mt-1">
                Connected via Farcaster
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={connectFarcasterWallet}
      disabled={isConnecting}
      className={`flex items-center gap-2 min-h-[40px] px-4 py-1.5 rounded-full transition-all font-bold shadow-sm ${isConnecting
        ? 'bg-purple-100 text-purple-400 cursor-not-allowed border border-purple-200'
        : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      aria-label="Connect Farcaster wallet"
      aria-disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Authenticating...</span>
        </>
      ) : (
        <>
          <span className="text-xs">Connect Wallet</span>
        </>
      )}
    </button>
  );
}
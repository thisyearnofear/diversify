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
    farcasterContext
  } = useWalletContext();

  const [showDropdown, setShowDropdown] = useState(false);

  // Don't show if not in Farcaster environment
  if (!isFarcaster) {
    return null;
  }

  // Extract username from Farcaster context
  const username = farcasterContext?.username || 'User';

  if (isConnected && address) {
    return (
      <div className="relative">
        {/* Connected State - Farcaster Style */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white min-w-[48px] min-h-[48px] px-4 py-3 rounded-lg transition-colors font-medium shadow-sm"
          disabled={isConnecting}
          aria-label="Farcaster wallet menu"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>{formatAddress(address)}</span>
          <span className="text-purple-200">@{username}</span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
      className={`flex items-center gap-2 min-w-[48px] min-h-[48px] px-4 py-3 rounded-lg transition-colors font-medium shadow-sm ${
        isConnecting 
          ? 'bg-purple-400 cursor-not-allowed' 
          : 'bg-purple-600 hover:bg-purple-700'
      } text-white`}
      aria-label="Connect Farcaster wallet"
      aria-disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting via Farcaster...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          Connect Farcaster Wallet
        </>
      )}
    </button>
  );
}
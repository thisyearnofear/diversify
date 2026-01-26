/**
 * Farcaster User Information Component
 * Displays Farcaster user data and provides Farcaster-specific UI elements
 */

import { useWalletContext } from '../wallet/WalletProvider';
import { useEffect, useState } from 'react';

export default function FarcasterUserInfo() {
  const { isFarcaster, farcasterContext } = useWalletContext();
  const [showFarcasterUI, setShowFarcasterUI] = useState(false);

  // Check if we should show Farcaster UI
  useEffect(() => {
    setShowFarcasterUI(isFarcaster && farcasterContext !== null);
  }, [isFarcaster, farcasterContext]);

  if (!showFarcasterUI) {
    return null;
  }

  // Extract user data from Farcaster context (Standard 2026 property paths)
  const {
    fid = 0,
    username = 'unknown',
    displayName = username,
    pfpUrl: url = ''
  } = farcasterContext?.user || {};

  const pfp = { url, verified: !!url };

  return (
    <div className="farcaster-user-info bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4 transition-all">
      <div className="flex items-center gap-3">
        {/* Farcaster Profile Picture */}
        {pfp?.url ? (
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-300 dark:border-purple-600">
            <img
              src={pfp.url}
              alt={`${displayName}'s profile`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.src = 'https://via.placeholder.com/40x40/8B5CF6/FFFFFF?text=FC';
              }}
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
            FC
          </div>
        )}

        {/* User Information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {displayName || username}
            </h3>
            {pfp?.verified && (
              <span className="text-purple-500" title="Verified Farcaster account">
                ✓
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>@{username}</span>
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 px-2 py-0.5 rounded-full text-xs font-medium">
              FID: {fid}
            </span>
          </div>
        </div>

        {/* Farcaster Branding */}
        <div className="flex-shrink-0">
          <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">🌐</span>
          </div>
        </div>
      </div>

      {/* Farcaster Welcome Message */}
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Welcome to DiversiFi on Farcaster! Your decentralized finance journey starts here.
      </div>
    </div>
  );
}
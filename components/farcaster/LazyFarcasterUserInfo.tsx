/**
 * Lazy-loaded Farcaster User Info Component
 * Optimized for performance in mobile and mini app environments
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useWalletContext } from '../wallet/WalletProvider';

// Lazy load the actual component
const FarcasterUserInfoComponent = lazy(() => import('./FarcasterUserInfo'));

export default function LazyFarcasterUserInfo() {
  const { isFarcaster, farcasterContext } = useWalletContext();
  const [shouldLoad, setShouldLoad] = useState(false);

  // Only load when in Farcaster environment and context is available
  useEffect(() => {
    if (isFarcaster && farcasterContext) {
      // Small delay to ensure smooth loading
      const timer = setTimeout(() => {
        setShouldLoad(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isFarcaster, farcasterContext]);

  if (!shouldLoad) {
    // Return null or a lightweight placeholder
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FarcasterUserInfoComponent />
    </Suspense>
  );
}
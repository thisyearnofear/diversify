/**
 * Utility functions for environment detection
 */

/**
 * Checks if the app is running in the MiniPay environment
 * MiniPay injects a special property into the window.ethereum object
 */
export function isMiniPayEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for MiniPay property
  const hasMiniPayProperty = window.ethereum && window.ethereum.isMiniPay === true;

  // Check for MiniPay in user agent (backup method)
  const userAgent = navigator.userAgent || '';
  const hasMiniPayUserAgent = userAgent.includes('MiniPay');

  // Check for Opera Mini browser which might host MiniPay
  const hasOperaMini = userAgent.includes('Opera Mini') || userAgent.includes('OPR');

  // Check for URL parameters (can be used for testing)
  const urlParams = new URLSearchParams(window.location.search);
  const hasMiniPayParam = urlParams.get('minipay') === 'true';

  // Check for referrer from MiniPay domains
  const referrer = document.referrer || '';
  const hasMiniPayReferrer = referrer.includes('minipay.app') ||
    referrer.includes('celo.org') ||
    referrer.includes('opera.com');

  // Check if we're in an iframe (MiniPay loads apps in iframes)
  const isInIframe = window !== window.parent;

  // Log detection results for debugging
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('minipay-detection', JSON.stringify({
        hasMiniPayProperty,
        hasMiniPayUserAgent,
        hasMiniPayParam,
        hasOperaMini,
        hasMiniPayReferrer,
        isInIframe,
        userAgent,
        referrer
      }));
    } catch (e) {
      console.error('Failed to log MiniPay detection to localStorage', e);
    }
  }

  // Log to console for debugging
  console.log('MiniPay detection:', {
    hasMiniPayProperty,
    hasMiniPayUserAgent,
    hasMiniPayParam,
    hasOperaMini,
    hasMiniPayReferrer,
    isInIframe,
    userAgent,
    referrer
  });

  return hasMiniPayProperty || hasMiniPayUserAgent || hasMiniPayParam ||
    (isInIframe && (hasMiniPayReferrer || hasOperaMini));
}

/**
 * Checks if the app is running in a mobile environment
 * This is a simple check based on screen width and user agent
 */
export function isMobileEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Check screen width
  const isMobileWidth = window.innerWidth < 768;

  // Check user agent for mobile devices
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  return isMobileWidth || isMobileUserAgent;
}

/**
 * Checks if the app is running in the Farcaster environment
 * Farcaster triggers frames and mini apps with specific referrers or parameters
 */
export function isFarcasterEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for Farcaster in user agent
  const userAgent = navigator.userAgent || '';
  const isFarcasterUserAgent = userAgent.includes('Farcaster') || userAgent.includes('Warpcast');

  // Check for URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isFarcasterParam = urlParams.get('farcaster') === 'true' || !!urlParams.get('fc');

  // Check for referrer from Farcaster domains
  const referrer = document.referrer || '';
  const isFarcasterReferrer = referrer.includes('farcaster.xyz') ||
    referrer.includes('warpcast.com') ||
    referrer.includes('frames.abc');

  // Check if we're in an iframe (Farcaster frames are always in iframes)
  const isInIframe = window !== window.parent;

  return isFarcasterUserAgent || isFarcasterParam || (isInIframe && isFarcasterReferrer);
}

/**
 * Checks if the app should render the DiversiFi UI
 * This is true if the app is running in MiniPay, Farcaster, or on the root path
 */
export function shouldRenderDiversiFiUI(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if in MiniPay
  const isInMiniPay = isMiniPayEnvironment();

  // Check if in Farcaster
  const isInFarcaster = isFarcasterEnvironment();

  // Check if on the diversifi path or root
  const isOnDiversiFiPath = window.location.pathname.startsWith('/diversifi') || window.location.pathname === '/';

  return isInMiniPay || isInFarcaster || isOnDiversiFiPath;
}

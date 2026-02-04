import { useState, useEffect } from 'react';
import { 
  GEOGRAPHIC_REGION_LIST,
  type GeographicRegion,
  type AssetRegion 
} from '../config';

// =============================================================================
// USER REGION DETECTION
// =============================================================================
// This hook detects the user's GEOGRAPHIC location for personalization.
// It uses GeographicRegion (not AssetRegion) because users are located in
// physical places, not asset categories like "Commodities" or "Global".
//
// For asset/token categorization, use AssetRegion from config/index.ts
// =============================================================================

// Re-export types for backward compatibility
// Region = geographic location where a user can be (no Commodities/Global)
export type Region = GeographicRegion;

// For files that need asset categorization, they should import AssetRegion from config
export type { AssetRegion } from '../config';

// Geographic regions only (users can't be "from Commodities")
export const REGIONS = GEOGRAPHIC_REGION_LIST;

// Country code to region mapping
const COUNTRY_TO_REGION: Record<string, Region> = {
  // Africa
  'ZA': 'Africa', 'NG': 'Africa', 'KE': 'Africa', 'GH': 'Africa', 'ET': 'Africa',
  'TZ': 'Africa', 'UG': 'Africa', 'EG': 'Africa', 'MA': 'Africa', 'CI': 'Africa',
  'CM': 'Africa', 'SN': 'Africa', 'DZ': 'Africa', 'TN': 'Africa', 'LY': 'Africa',

  // USA/North America
  'US': 'USA', 'CA': 'USA', 'MX': 'USA',

  // Europe
  'GB': 'Europe', 'DE': 'Europe', 'FR': 'Europe', 'IT': 'Europe', 'ES': 'Europe',
  'NL': 'Europe', 'BE': 'Europe', 'CH': 'Europe', 'AT': 'Europe', 'SE': 'Europe',
  'NO': 'Europe', 'DK': 'Europe', 'FI': 'Europe', 'PT': 'Europe', 'GR': 'Europe',
  'IE': 'Europe', 'PL': 'Europe', 'RO': 'Europe', 'CZ': 'Europe', 'HU': 'Europe',

  // Latin America
  'BR': 'LatAm', 'AR': 'LatAm', 'CO': 'LatAm', 'CL': 'LatAm', 'PE': 'LatAm',
  'VE': 'LatAm', 'EC': 'LatAm', 'BO': 'LatAm', 'PY': 'LatAm', 'UY': 'LatAm',
  'CR': 'LatAm', 'PA': 'LatAm', 'DO': 'LatAm', 'GT': 'LatAm', 'HN': 'LatAm',

  // Asia
  'CN': 'Asia', 'JP': 'Asia', 'KR': 'Asia', 'IN': 'Asia', 'ID': 'Asia',
  'PH': 'Asia', 'VN': 'Asia', 'TH': 'Asia', 'MY': 'Asia', 'SG': 'Asia',
  'HK': 'Asia', 'TW': 'Asia', 'AE': 'Asia', 'SA': 'Asia', 'IL': 'Asia',
};

// Language code to region mapping
const LANGUAGE_TO_REGION: Record<string, Region> = {
  // English variants
  'en-US': 'USA',
  'en-CA': 'USA',
  'en-GB': 'Europe',
  'en-AU': 'Asia',
  'en-NZ': 'Asia',
  'en-ZA': 'Africa',
  'en-NG': 'Africa',
  'en-KE': 'Africa',
  'en-GH': 'Africa',

  // European languages
  'de': 'Europe',
  'fr': 'Europe',
  'it': 'Europe',
  'es-ES': 'Europe',
  'pt-PT': 'Europe',
  'nl': 'Europe',
  'sv': 'Europe',
  'no': 'Europe',
  'da': 'Europe',
  'fi': 'Europe',
  'el': 'Europe',
  'ru': 'Europe',
  'pl': 'Europe',

  // Latin American languages
  'es-MX': 'LatAm',
  'es-AR': 'LatAm',
  'es-CL': 'LatAm',
  'es-CO': 'LatAm',
  'es-PE': 'LatAm',
  'pt-BR': 'LatAm',

  // Asian languages
  'zh': 'Asia',
  'ja': 'Asia',
  'ko': 'Asia',
  'hi': 'Asia',
  'th': 'Asia',
  'vi': 'Asia',
  'id': 'Asia',
  'ms': 'Asia',

  // African languages
  'sw': 'Africa',
  'am': 'Africa',
  'ha': 'Africa',
  'yo': 'Africa',
  'ar': 'Africa',
};

export function useUserRegion() {
  const [region, setRegion] = useState<Region>('Africa'); // Default to Africa
  const [isLoading, setIsLoading] = useState(true);
  const [detectionMethod, setDetectionMethod] = useState<'default' | 'locale' | 'ip' | 'manual'>('default');

  useEffect(() => {
    const detectRegion = async () => {
      try {
        // First try to get from localStorage (if user previously set it)
        const savedRegion = localStorage.getItem('user-region');
        if (savedRegion && REGIONS.includes(savedRegion as Region)) {
          setRegion(savedRegion as Region);
          setDetectionMethod('manual');
          setIsLoading(false);
          return;
        }

        // Try to detect from browser locale
        if (typeof navigator !== 'undefined' && navigator.language) {
          const locale = navigator.language;

          // Check if we have a direct mapping for this locale
          if (LANGUAGE_TO_REGION[locale]) {
            setRegion(LANGUAGE_TO_REGION[locale]);
            setDetectionMethod('locale');
            setIsLoading(false);
            return;
          }

          // Check language part only (e.g., 'en' from 'en-US')
          const language = locale.split('-')[0];
          if (LANGUAGE_TO_REGION[language]) {
            setRegion(LANGUAGE_TO_REGION[language]);
            setDetectionMethod('locale');
            setIsLoading(false);
            return;
          }
        }

        // If locale detection failed, try IP-based detection
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();

          if (data.country_code && COUNTRY_TO_REGION[data.country_code]) {
            setRegion(COUNTRY_TO_REGION[data.country_code]);
            setDetectionMethod('ip');
            setIsLoading(false);
            return;
          }

          // If country not in our mapping, use continent data
          if (data.continent_code) {
            switch (data.continent_code) {
              case 'AF':
                setRegion('Africa');
                break;
              case 'NA':
                setRegion('USA');
                break;
              case 'EU':
                setRegion('Europe');
                break;
              case 'SA':
                setRegion('LatAm');
                break;
              case 'AS':
              case 'OC':
                setRegion('Asia');
                break;
              default:
                setRegion('USA'); // Default to USA if unknown
            }
            setDetectionMethod('ip');
            setIsLoading(false);
            return;
          }
        } catch (ipError) {
          console.warn('IP detection failed:', ipError);
        }

        // If all detection methods fail, default to Africa
        setRegion('Africa');
        setDetectionMethod('default');
      } catch (e) {
        console.warn('Region detection failed:', e);
        setRegion('Africa');
        setDetectionMethod('default');
      } finally {
        setIsLoading(false);
      }
    };

    detectRegion();
  }, []);

  // Function to manually set region
  const setUserRegion = (newRegion: Region) => {
    setRegion(newRegion);
    setDetectionMethod('manual');

    // Save to localStorage
    try {
      localStorage.setItem('user-region', newRegion);
    } catch (e) {
      console.warn('Failed to save region to localStorage:', e);
    }
  };

  return {
    region,
    isLoading,
    detectionMethod,
    setRegion: setUserRegion
  };
}

/**
 * Token Design System
 * 
 * Consistent visual identity for all tokens across the app.
 * Ensures uniform gradients, icons, and styling recommendations.
 * 
 * Core Principles:
 * - CONSISTENT: Same token always looks the same
 * - ACCESSIBLE: High contrast, clear visual hierarchy
 * - DELIGHTFUL: Premium feel with gradients and animations
 * - SCALABLE: Easy to add new tokens
 */

export interface TokenDesign {
  symbol: string;
  name: string;
  gradient: string;           // Tailwind gradient classes
  icon: string;              // Emoji icon
  textColor: string;         // Tailwind text color
  bgColor: string;          // Tailwind bg color for light backgrounds
  borderColor: string;      // Tailwind border color
  shadowColor: string;      // Tailwind shadow color (e.g., 'shadow-amber-500/30')
  category: 'stablecoin' | 'yield' | 'commodity' | 'regional' | 'default';
  description: string;
  shortLabel: string;       // For compact displays
}

// ============================================================================
// TOKEN DESIGN REGISTRY
// ============================================================================

export const TOKEN_DESIGN: Record<string, TokenDesign> = {
  // Commodities
  'PAXG': {
    symbol: 'PAXG',
    name: 'Paxos Gold',
    gradient: 'from-amber-500 via-orange-500 to-orange-600',
    icon: '🥇',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    shadowColor: 'shadow-amber-500/30',
    category: 'commodity',
    description: 'Tokenized physical gold backed 1:1 by London Good Delivery gold bars',
    shortLabel: 'Gold',
  },

  // Treasury Yield
  'USDY': {
    symbol: 'USDY',
    name: 'Ondo US Dollar Yield',
    gradient: 'from-green-600 via-emerald-600 to-emerald-700',
    icon: '💰',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    shadowColor: 'shadow-green-500/30',
    category: 'yield',
    description: 'Tokenized US Treasuries with ~5% APY auto-accruing yield',
    shortLabel: 'Treasury',
  },

  // DeFi Yield
  'SYRUPUSDC': {
    symbol: 'SYRUPUSDC',
    name: 'Syrup USDC',
    gradient: 'from-purple-500 via-indigo-500 to-indigo-600',
    icon: '🍯',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    shadowColor: 'shadow-purple-500/30',
    category: 'yield',
    description: 'Yield-bearing USDC powered by Morpho with ~4.5% APY',
    shortLabel: 'Syrup',
  },

  // Stablecoins
  'USDC': {
    symbol: 'USDC',
    name: 'USD Coin',
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
    icon: '💵',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    shadowColor: 'shadow-blue-500/30',
    category: 'stablecoin',
    description: 'Fully-backed US dollar stablecoin',
    shortLabel: 'USDC',
  },

  'USDm': {
    symbol: 'USDm',
    name: 'Mento Dollar',
    gradient: 'from-yellow-500 via-yellow-600 to-amber-600',
    icon: '💵',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    shadowColor: 'shadow-yellow-500/30',
    category: 'stablecoin',
    description: 'Decentralized stablecoin on Celo',
    shortLabel: 'USDm',
  },

  'EURm': {
    symbol: 'EURm',
    name: 'Mento Euro',
    gradient: 'from-blue-600 via-indigo-600 to-purple-600',
    icon: '💶',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    shadowColor: 'shadow-blue-500/30',
    category: 'regional',
    description: 'Euro stablecoin on Celo',
    shortLabel: 'EURm',
  },

  'EURC': {
    symbol: 'EURC',
    name: 'Euro Coin',
    gradient: 'from-blue-600 via-blue-700 to-indigo-700',
    icon: '💶',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    shadowColor: 'shadow-blue-500/30',
    category: 'regional',
    description: 'Circle\'s euro-backed stablecoin',
    shortLabel: 'EURC',
  },

  'BRLm': {
    symbol: 'BRLm',
    name: 'Mento Real',
    gradient: 'from-green-500 via-emerald-600 to-teal-600',
    icon: '🇧🇷',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    shadowColor: 'shadow-green-500/30',
    category: 'regional',
    description: 'Brazilian Real stablecoin on Celo',
    shortLabel: 'BRLm',
  },

  'KESm': {
    symbol: 'KESm',
    name: 'Mento Kenyan Shilling',
    gradient: 'from-red-600 via-red-700 to-rose-700',
    icon: '🇰🇪',
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    shadowColor: 'shadow-red-500/30',
    category: 'regional',
    description: 'Kenyan Shilling stablecoin on Celo',
    shortLabel: 'KESm',
  },

  'GHSm': {
    symbol: 'GHSm',
    name: 'Mento Ghana Cedi',
    gradient: 'from-yellow-600 via-amber-600 to-orange-600',
    icon: '🇬🇭',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    shadowColor: 'shadow-yellow-500/30',
    category: 'regional',
    description: 'Ghana Cedi stablecoin on Celo',
    shortLabel: 'GHSm',
  },

  'ZARm': {
    symbol: 'ZARm',
    name: 'Mento South African Rand',
    gradient: 'from-green-600 via-emerald-700 to-green-800',
    icon: '🇿🇦',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    shadowColor: 'shadow-green-500/30',
    category: 'regional',
    description: 'South African Rand stablecoin on Celo',
    shortLabel: 'ZARm',
  },

  'XOFm': {
    symbol: 'XOFm',
    name: 'Mento CFA Franc',
    gradient: 'from-green-500 via-teal-600 to-cyan-600',
    icon: '🌍',
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    shadowColor: 'shadow-green-500/30',
    category: 'regional',
    description: 'West African CFA franc on Celo',
    shortLabel: 'XOFm',
  },

  'PHPm': {
    symbol: 'PHPm',
    name: 'Mento Philippine Peso',
    gradient: 'from-blue-500 via-cyan-600 to-blue-700',
    icon: '🇵🇭',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    shadowColor: 'shadow-blue-500/30',
    category: 'regional',
    description: 'Philippine Peso stablecoin on Celo',
    shortLabel: 'PHPm',
  },

  // UBI Token
  'G$': {
    symbol: 'G$',
    name: 'GoodDollar',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    icon: '💚',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    shadowColor: 'shadow-emerald-500/30',
    category: 'stablecoin',
    description: 'Universal Basic Income token - claim free daily G$ on Celo',
    shortLabel: 'G$',
  },

  // Default fallback
  'default': {
    symbol: 'TOKEN',
    name: 'Token',
    gradient: 'from-gray-500 via-gray-600 to-gray-700',
    icon: '💎',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    shadowColor: 'shadow-gray-500/30',
    category: 'default',
    description: 'Token',
    shortLabel: 'Token',
  },
};

// ============================================================================
// REGION DESIGN SYSTEM
// ============================================================================

export interface RegionDesign {
  name: string;
  color: string;
  gradient: string;
  icon: string;
  textColor: string;
  description: string;
}

export const REGION_DESIGN: Record<string, RegionDesign> = {
  'USA': {
    name: 'United States',
    color: '#3B82F6', // blue-500
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
    icon: '🇺🇸',
    textColor: 'text-blue-700',
    description: 'USD stablecoins and Treasury yields',
  },
  'Europe': {
    name: 'Europe',
    color: '#10B981', // emerald-500
    gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
    icon: '🇪🇺',
    textColor: 'text-emerald-700',
    description: 'Euro stablecoins and European assets',
  },
  'Asia': {
    name: 'Asia',
    color: '#8B5CF6', // violet-500
    gradient: 'from-violet-500 via-purple-600 to-indigo-600',
    icon: '🌏',
    textColor: 'text-violet-700',
    description: 'Asian currencies and growth markets',
  },
  'Africa': {
    name: 'Africa',
    color: '#EF4444', // red-500
    gradient: 'from-red-500 via-red-600 to-rose-600',
    icon: '🌍',
    textColor: 'text-red-700',
    description: 'African currencies and emerging markets',
  },
  'LatAm': {
    name: 'Latin America',
    color: '#F97316', // orange-500
    gradient: 'from-orange-500 via-orange-600 to-amber-600',
    icon: '🌎',
    textColor: 'text-orange-700',
    description: 'Latin American currencies and markets',
  },
  'Global': {
    name: 'Global',
    color: '#D97706', // amber-600
    gradient: 'from-amber-500 via-orange-500 to-orange-600',
    icon: '🌐',
    textColor: 'text-amber-700',
    description: 'Gold, commodities, and global assets',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get design for a token (with fallback to default)
 */
export function getTokenDesign(symbol: string): TokenDesign {
  const normalizedSymbol = symbol.toUpperCase();
  return TOKEN_DESIGN[normalizedSymbol] || TOKEN_DESIGN['default'];
}

/**
 * Get design for a region
 */
export function getRegionDesign(region: string): RegionDesign {
  return REGION_DESIGN[region] || {
    name: region,
    color: '#6B7280',
    gradient: 'from-gray-500 via-gray-600 to-gray-700',
    icon: '📍',
    textColor: 'text-gray-700',
    description: region,
  };
}

/**
 * Get icon for token (safe fallback)
 */
export function getTokenIcon(symbol: string): string {
  return getTokenDesign(symbol).icon;
}

/**
 * Get gradient classes for token
 */
export function getTokenGradient(symbol: string): string {
  return getTokenDesign(symbol).gradient;
}

/**
 * Check if token is a yield-bearing asset
 */
export function isYieldToken(symbol: string): boolean {
  const design = getTokenDesign(symbol);
  return design.category === 'yield';
}

/**
 * Check if token is a commodity (gold, etc.)
 */
export function isCommodityToken(symbol: string): boolean {
  const design = getTokenDesign(symbol);
  return design.category === 'commodity';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const TokenDesignSystem = {
  TOKEN_DESIGN,
  REGION_DESIGN,
  getTokenDesign,
  getRegionDesign,
  getTokenIcon,
  getTokenGradient,
  isYieldToken,
  isCommodityToken,
};

export default TokenDesignSystem;

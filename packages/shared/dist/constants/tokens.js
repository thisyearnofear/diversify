"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenDesignSystem = exports.REGION_DESIGN = exports.TOKEN_DESIGN = void 0;
exports.getTokenDesign = getTokenDesign;
exports.getRegionDesign = getRegionDesign;
exports.getTokenIcon = getTokenIcon;
exports.getTokenGradient = getTokenGradient;
exports.isYieldToken = isYieldToken;
exports.isCommodityToken = isCommodityToken;
exports.isEquityToken = isEquityToken;
// ============================================================================
// TOKEN DESIGN REGISTRY
// ============================================================================
exports.TOKEN_DESIGN = {
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
    // Fictional Stock Tokens (Robinhood Chain Testnet)
    'ACME': {
        symbol: 'ACME',
        name: 'Acme Corporation',
        gradient: 'from-red-500 via-orange-500 to-yellow-500',
        icon: '💥',
        textColor: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        shadowColor: 'shadow-red-500/30',
        category: 'equity',
        description: 'Purveyor of fine explosives and rocket-powered gadgets',
        shortLabel: 'Acme',
    },
    'SPACELY': {
        symbol: 'SPACELY',
        name: 'Spacely Sprockets',
        gradient: 'from-cyan-500 via-blue-500 to-indigo-600',
        icon: '🚀',
        textColor: 'text-cyan-700',
        bgColor: 'bg-cyan-100',
        borderColor: 'border-cyan-300',
        shadowColor: 'shadow-cyan-500/30',
        category: 'equity',
        description: 'Galaxy-leading sprocket manufacturer since 2062',
        shortLabel: 'Spacely',
    },
    'WAYNE': {
        symbol: 'WAYNE',
        name: 'Wayne Industries',
        gradient: 'from-slate-700 via-gray-800 to-slate-900',
        icon: '🦇',
        textColor: 'text-slate-300',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-400',
        shadowColor: 'shadow-slate-500/30',
        category: 'equity',
        description: 'Gotham\'s premier defense and technology conglomerate',
        shortLabel: 'Wayne',
    },
    'OSCORP': {
        symbol: 'OSCORP',
        name: 'Oscorp Industries',
        gradient: 'from-green-600 via-emerald-600 to-lime-500',
        icon: '🧪',
        textColor: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        shadowColor: 'shadow-green-500/30',
        category: 'equity',
        description: 'Cutting-edge biotech and genetic research',
        shortLabel: 'Oscorp',
    },
    'STARK': {
        symbol: 'STARK',
        name: 'Stark Industries',
        gradient: 'from-red-600 via-rose-600 to-red-800',
        icon: '⚡',
        textColor: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-400',
        shadowColor: 'shadow-red-600/30',
        category: 'equity',
        description: 'Clean energy and advanced defense systems',
        shortLabel: 'Stark',
    },
    // Real Stock Tokens (Synth API)
    'NVDA': {
        symbol: 'NVDA',
        name: 'NVIDIA Corp',
        gradient: 'from-green-500 via-emerald-600 to-teal-500',
        icon: '🟢',
        textColor: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-400',
        shadowColor: 'shadow-green-500/30',
        category: 'equity',
        description: 'AI and GPU computing leader',
        shortLabel: 'NVIDIA',
    },
    'GOOGL': {
        symbol: 'GOOGL',
        name: 'Alphabet Inc',
        gradient: 'from-blue-500 via-cyan-500 to-blue-600',
        icon: '🔵',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-400',
        shadowColor: 'shadow-blue-500/30',
        category: 'equity',
        description: 'Search, cloud, and AI giant',
        shortLabel: 'Google',
    },
    'TSLA': {
        symbol: 'TSLA',
        name: 'Tesla Inc',
        gradient: 'from-red-500 via-gray-600 to-red-700',
        icon: '🚗',
        textColor: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-400',
        shadowColor: 'shadow-red-500/30',
        category: 'equity',
        description: 'EV and energy innovation leader',
        shortLabel: 'Tesla',
    },
    'AAPL': {
        symbol: 'AAPL',
        name: 'Apple Inc',
        gradient: 'from-gray-400 via-gray-600 to-gray-800',
        icon: '🍎',
        textColor: 'text-gray-700',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-400',
        shadowColor: 'shadow-gray-500/30',
        category: 'equity',
        description: 'Consumer tech and services powerhouse',
        shortLabel: 'Apple',
    },
    'BTC': {
        symbol: 'BTC',
        name: 'Bitcoin',
        gradient: 'from-orange-500 via-amber-600 to-yellow-500',
        icon: '₿',
        textColor: 'text-orange-700',
        bgColor: 'bg-orange-100',
        borderColor: 'border-orange-400',
        shadowColor: 'shadow-orange-500/30',
        category: 'commodity',
        description: 'Original cryptocurrency',
        shortLabel: 'Bitcoin',
    },
    'ETH': {
        symbol: 'ETH',
        name: 'Ethereum',
        gradient: 'from-purple-500 via-violet-600 to-indigo-600',
        icon: '♦',
        textColor: 'text-purple-700',
        bgColor: 'bg-purple-100',
        borderColor: 'border-purple-400',
        shadowColor: 'shadow-purple-500/30',
        category: 'commodity',
        description: 'Smart contract platform',
        shortLabel: 'Ethereum',
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
exports.REGION_DESIGN = {
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
function getTokenDesign(symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    return exports.TOKEN_DESIGN[normalizedSymbol] || exports.TOKEN_DESIGN['default'];
}
/**
 * Get design for a region
 */
function getRegionDesign(region) {
    return exports.REGION_DESIGN[region] || {
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
function getTokenIcon(symbol) {
    return getTokenDesign(symbol).icon;
}
/**
 * Get gradient classes for token
 */
function getTokenGradient(symbol) {
    return getTokenDesign(symbol).gradient;
}
/**
 * Check if token is a yield-bearing asset
 */
function isYieldToken(symbol) {
    const design = getTokenDesign(symbol);
    return design.category === 'yield';
}
/**
 * Check if token is a commodity (gold, etc.)
 */
function isCommodityToken(symbol) {
    const design = getTokenDesign(symbol);
    return design.category === 'commodity';
}
/**
 * Check if token is an equity (stock token)
 */
function isEquityToken(symbol) {
    const design = getTokenDesign(symbol);
    return design.category === 'equity';
}
// ============================================================================
// EXPORTS
// ============================================================================
exports.TokenDesignSystem = {
    TOKEN_DESIGN: exports.TOKEN_DESIGN,
    REGION_DESIGN: exports.REGION_DESIGN,
    getTokenDesign,
    getRegionDesign,
    getTokenIcon,
    getTokenGradient,
    isYieldToken,
    isCommodityToken,
    isEquityToken,
};
exports.default = exports.TokenDesignSystem;
//# sourceMappingURL=tokens.js.map
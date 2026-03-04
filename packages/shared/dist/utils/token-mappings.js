"use strict";
/**
 * Centralized Token Mapping System
 * Single source of truth for Mento token name mappings
 * Consolidates old C-prefix tokens to new m-suffix tokens
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTO_TOKEN_MAPPINGS_REVERSE = exports.MENTO_TOKEN_MAPPINGS = void 0;
exports.normalizeMentoToken = normalizeMentoToken;
exports.getOldMentoTokenName = getOldMentoTokenName;
exports.isMentoToken = isMentoToken;
// Old to new token mapping (for backward compatibility during transition)
exports.MENTO_TOKEN_MAPPINGS = {
    // Stablecoins
    'CUSD': 'USDm',
    'cUSD': 'USDm',
    'cusd': 'USDm',
    'CEUR': 'EURm',
    'cEUR': 'EURm',
    'ceur': 'EURm',
    'CREAL': 'BRLm',
    'cREAL': 'BRLm',
    'creal': 'BRLm',
    // Regional stablecoins
    'CKES': 'KESm',
    'cKES': 'KESm',
    'ckes': 'KESm',
    'CCOP': 'COPm',
    'cCOP': 'COPm',
    'ccop': 'COPm',
    'CPHP': 'PHPm',
    'cPHP': 'PHPm',
    'cphp': 'PHPm',
    'CGHS': 'GHSm',
    'cGHS': 'GHSm',
    'cghs': 'GHSm',
    'CXOF': 'XOFm',
    'cXOF': 'XOFm',
    'cxof': 'XOFm',
    'CGBP': 'GBPm',
    'cGBP': 'GBPm',
    'cgbp': 'GBPm',
    'CZAR': 'ZARm',
    'cZAR': 'ZARm',
    'czar': 'ZARm',
    'CCAD': 'CADm',
    'cCAD': 'CADm',
    'ccad': 'CADm',
    'CAUD': 'AUDm',
    'cAUD': 'AUDm',
    'caud': 'AUDm',
    'CCHF': 'CHFm',
    'cCHF': 'CHFm',
    'cchf': 'CHFm',
    'CJPY': 'JPYm',
    'cJPY': 'JPYm',
    'cjpy': 'JPYm',
    'CNGN': 'NGNm',
    'cNGN': 'NGNm',
    'cngn': 'NGNm',
};
// New token to old token mapping (reverse lookup)
exports.MENTO_TOKEN_MAPPINGS_REVERSE = Object.entries(exports.MENTO_TOKEN_MAPPINGS).reduce((acc, [oldToken, newToken]) => {
    acc[newToken] = oldToken;
    return acc;
}, {});
/**
 * Normalize token symbol to new Mento naming convention
 * @param symbol Token symbol (could be old or new)
 * @returns New token symbol if it exists, otherwise original symbol
 */
function normalizeMentoToken(symbol) {
    const normalized = symbol.toUpperCase();
    return exports.MENTO_TOKEN_MAPPINGS[normalized] || normalized;
}
/**
 * Get the old token name for a given new token (for display purposes)
 * @param symbol New token symbol (e.g., USDm)
 * @returns Old token symbol if it exists, otherwise original symbol
 */
function getOldMentoTokenName(symbol) {
    return exports.MENTO_TOKEN_MAPPINGS_REVERSE[symbol] || symbol;
}
/**
 * Check if a token is a Mento regional stablecoin
 * @param symbol Token symbol
 * @returns Boolean indicating if it's a Mento token
 */
function isMentoToken(symbol) {
    const normalized = symbol.toUpperCase();
    return normalized in exports.MENTO_TOKEN_MAPPINGS ||
        normalized in exports.MENTO_TOKEN_MAPPINGS_REVERSE ||
        normalized.endsWith('m'); // New Mento tokens end with 'm'
}
//# sourceMappingURL=token-mappings.js.map
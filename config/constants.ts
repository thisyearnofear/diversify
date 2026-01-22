/**
 * UI constants for backward compatibility
 * Defines all constants directly to avoid circular dependencies
 */

// Region colors
export const REGION_COLORS = {
    USA: '#3B82F6',
    Europe: '#22C55E',
    LatAm: '#F59E0B',
    Africa: '#EF4444',
    Asia: '#D946EF',
} as const;

export const REGION_BG_COLORS = {
    USA: '#DBEAFE',
    Europe: '#DCFCE7',
    LatAm: '#FEF3C7',
    Africa: '#FEE2E2',
    Asia: '#F5D0FE',
} as const;

export const REGION_DARK_COLORS = {
    USA: '#1E40AF',
    Europe: '#15803D',
    LatAm: '#B45309',
    Africa: '#B91C1C',
    Asia: '#A21CAF',
} as const;

export const REGION_CONTRAST_COLORS = {
    USA: '#172554',
    Europe: '#14532D',
    LatAm: '#78350F',
    Africa: '#7F1D1D',
    Asia: '#701A75',
} as const;

// Exchange rates
export const EXCHANGE_RATES: Record<string, number> = {
    CUSD: 1,
    CEUR: 1.08,
    CREAL: 0.2,
    CKES: 0.0078,
    CCOP: 0.00025,
    PUSO: 0.0179,
    CGHS: 0.069,
    CXOF: 0.0016,
    CPESO: 0.0179,
    CGBP: 1.27,
    CZAR: 0.055,
    CCAD: 0.74,
    CAUD: 0.66,
    USDC: 1,
    PAXG: 2000,
};

// Available tokens list for UI
export const AVAILABLE_TOKENS = [
    { symbol: 'CUSD', name: 'Celo Dollar', region: 'USA' },
    { symbol: 'CEUR', name: 'Celo Euro', region: 'Europe' },
    { symbol: 'CREAL', name: 'Celo Brazilian Real', region: 'LatAm' },
    { symbol: 'CKES', name: 'Celo Kenyan Shilling', region: 'Africa' },
    { symbol: 'CCOP', name: 'Celo Colombian Peso', region: 'LatAm' },
    { symbol: 'PUSO', name: 'Philippine Peso', region: 'Asia' },
    { symbol: 'CGHS', name: 'Celo Ghana Cedi', region: 'Africa' },
    { symbol: 'CXOF', name: 'CFA Franc', region: 'Africa' },
    { symbol: 'CPESO', name: 'Philippine Peso', region: 'Asia' },
    { symbol: 'CGBP', name: 'British Pound', region: 'Europe' },
    { symbol: 'CZAR', name: 'South African Rand', region: 'Africa' },
    { symbol: 'CCAD', name: 'Canadian Dollar', region: 'USA' },
    { symbol: 'CAUD', name: 'Australian Dollar', region: 'Asia' },
] as const;

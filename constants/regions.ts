// Region colors for visualization
export const REGION_COLORS = {
  USA: "#3B82F6", // Enhanced blue
  Europe: "#22C55E", // Enhanced green
  LatAm: "#F59E0B", // Enhanced orange/yellow
  Africa: "#EF4444", // Enhanced red/terracotta
  Asia: "#D946EF", // Enhanced purple/pink
};

// Region background colors (lighter versions)
export const REGION_BG_COLORS = {
  USA: "#DBEAFE", // Light blue
  Europe: "#DCFCE7", // Light green
  LatAm: "#FEF3C7", // Light yellow
  Africa: "#FEE2E2", // Light red
  Asia: "#F5D0FE", // Light purple
};

// Region dark colors for text and borders
export const REGION_DARK_COLORS = {
  USA: "#1E40AF", // Dark blue
  Europe: "#15803D", // Dark green
  LatAm: "#B45309", // Dark orange
  Africa: "#B91C1C", // Dark red
  Asia: "#A21CAF", // Dark purple
};

// Region contrast colors for text on colored backgrounds
export const REGION_CONTRAST_COLORS = {
  USA: "#172554", // Very dark blue
  Europe: "#14532D", // Very dark green
  LatAm: "#78350F", // Very dark orange
  Africa: "#7F1D1D", // Very dark red
  Asia: "#701A75", // Very dark purple
};

// Available tokens - includes all Mento stablecoins
export const AVAILABLE_TOKENS = [
  // Mainnet tokens
  { symbol: "CUSD", name: "Celo Dollar", region: "USA" },
  { symbol: "CEUR", name: "Celo Euro", region: "Europe" },
  { symbol: "CREAL", name: "Celo Brazilian Real", region: "LatAm" },
  { symbol: "CKES", name: "Celo Kenyan Shilling", region: "Africa" },
  { symbol: "CCOP", name: "Celo Colombian Peso", region: "LatAm" },
  { symbol: "PUSO", name: "Philippine Peso", region: "Asia" },
  { symbol: "CGHS", name: "Celo Ghana Cedi", region: "Africa" },
  { symbol: "CXOF", name: "CFA Franc", region: "Africa" },

  // Mento v2.0 Alfajores tokens
  { symbol: "CPESO", name: "Philippine Peso", region: "Asia" },
  { symbol: "CGBP", name: "British Pound", region: "Europe" },
  { symbol: "CZAR", name: "South African Rand", region: "Africa" },
  { symbol: "CCAD", name: "Canadian Dollar", region: "USA" },
  { symbol: "CAUD", name: "Australian Dollar", region: "Asia" },
];

// Mock data for region visualization (used as initial state)
export const MOCK_REGION_DATA = [
  { region: "USA", value: 25, color: REGION_COLORS.USA },
  { region: "Europe", value: 22, color: REGION_COLORS.Europe },
  { region: "LatAm", value: 18, color: REGION_COLORS.LatAm },
  { region: "Africa", value: 26, color: REGION_COLORS.Africa },
  { region: "Asia", value: 9, color: REGION_COLORS.Asia },
];

// Exchange rates for stablecoins to USD (for fallback calculations)
export const EXCHANGE_RATES: Record<string, number> = {
  // Standard format - updated rates for mainnet tokens
  CUSD: 1,
  CEUR: 1.08,
  CREAL: 0.2, // 1 BRL = $0.20
  CKES: 0.0078, // 1 KES = $0.0078
  CCOP: 0.00025, // 1 COP = $0.00025
  PUSO: 0.0179, // 1 PHP = $0.0179
  CGHS: 0.069, // 1 GHS = $0.069
  CXOF: 0.0016, // 1 XOF = $0.0016

  // Mento v2.0 Alfajores tokens
  CPESO: 0.0179, // 1 PHP = $0.0179
  CGBP: 1.27, // 1 GBP = $1.27
  CZAR: 0.055, // 1 ZAR = $0.055
  CCAD: 0.74, // 1 CAD = $0.74
  CAUD: 0.66, // 1 AUD = $0.66

  // Lowercase versions
  cusd: 1,
  ceur: 1.08,
  creal: 0.2,
  ckes: 0.0078,
  ccop: 0.00025,
  puso: 0.0179,
  cghs: 0.069,
  cxof: 0.0016,
  cpeso: 0.0179,
  cgbp: 1.27,
  czar: 0.055,
  ccad: 0.74,
  caud: 0.66,
};

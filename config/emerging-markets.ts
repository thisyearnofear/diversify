/**
 * Emerging Markets Paper Trading Configuration
 * 
 * Proxy tokens deployed on Celo Sepolia for educational paper trading
 * Tracks real emerging market stocks with daily price updates
 */

export interface EmergingMarketStock {
  symbol: string;
  name: string;
  icon: string;
  market: string;
  region: "africa" | "latam" | "asia";
  realTicker: string; // Real stock ticker for price tracking
  description: string;
  tokenAddress?: string; // Deployed on Celo Sepolia
}

export const EMERGING_MARKET_STOCKS: EmergingMarketStock[] = [
  // African Markets
  {
    symbol: "SAFCOM",
    name: "Safaricom",
    icon: "📱",
    market: "Kenya",
    region: "africa",
    realTicker: "SCOM.NR", // Nairobi Stock Exchange
    description: "Leading telecom and mobile money provider in East Africa",
  },
  {
    symbol: "DANGOTE",
    name: "Dangote Cement",
    icon: "🏗️",
    market: "Nigeria",
    region: "africa",
    realTicker: "DANGCEM.LG", // Lagos Stock Exchange
    description: "Africa's largest cement producer",
  },
  {
    symbol: "SHOPRITE",
    name: "Shoprite",
    icon: "🛒",
    market: "South Africa",
    region: "africa",
    realTicker: "SHP.JO", // Johannesburg Stock Exchange
    description: "Africa's largest food retailer",
  },

  // Latin American Markets
  {
    symbol: "PETROBRAS",
    name: "Petrobras",
    icon: "⛽",
    market: "Brazil",
    region: "latam",
    realTicker: "PETR4.SA", // B3 (Brazil Stock Exchange)
    description: "Brazilian state-owned oil and gas giant",
  },
  {
    symbol: "MELI",
    name: "MercadoLibre",
    icon: "🛍️",
    market: "Argentina",
    region: "latam",
    realTicker: "MELI", // NASDAQ (also trades in LatAm)
    description: "Latin America's leading e-commerce platform",
  },
  {
    symbol: "CEMEX",
    name: "CEMEX",
    icon: "🏭",
    market: "Mexico",
    region: "latam",
    realTicker: "CEMEXCPO.MX", // Mexican Stock Exchange
    description: "Global building materials company",
  },

  // Asian Emerging Markets
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    icon: "🏢",
    market: "India",
    region: "asia",
    realTicker: "RELIANCE.NS", // NSE India
    description: "India's largest conglomerate",
  },
  {
    symbol: "GRAB",
    name: "Grab Holdings",
    icon: "🚗",
    market: "Singapore",
    region: "asia",
    realTicker: "GRAB", // NASDAQ
    description: "Southeast Asia's super-app for transport and delivery",
  },
  {
    symbol: "JOLLIBEE",
    name: "Jollibee Foods",
    icon: "🍔",
    market: "Philippines",
    region: "asia",
    realTicker: "JFC.PS", // Philippine Stock Exchange
    description: "Largest fast-food chain in the Philippines",
  },
];

export const EMERGING_MARKETS_CONFIG = {
  // Celo Sepolia Testnet (New Developer Testnet)
  chainId: 11142220,
  network: "Celo Sepolia",
  rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
  explorerUrl: "https://celo-sepolia.blockscout.com",
  
  // Contracts (update after deployment)
  ammAddress: "", // TestnetMarketMaker address
  wethAddress: "", // WETH9 (Wrapped CELO) address
  
  // Token addresses (update after deployment)
  tokens: {
    // Africa
    SAFCOM: "",
    DANGOTE: "",
    SHOPRITE: "",
    // Latin America
    PETROBRAS: "",
    MELI: "",
    CEMEX: "",
    // Asia
    RELIANCE: "",
    GRAB: "",
    JOLLIBEE: "",
  },
  
  // Trading configuration
  baseToken: "CELO",
  feePercent: 0.3, // Same as Robinhood (0.3%)
  
  // Paper trading limits (optional, can be enforced in UI)
  maxTradeSize: 1000, // 1000 CELO max per trade
  minTradeSize: 0.01, // 0.01 CELO min per trade
};

/**
 * Get stocks by region
 */
export function getStocksByRegion(region: "africa" | "latam" | "asia") {
  return EMERGING_MARKET_STOCKS.filter(stock => stock.region === region);
}

/**
 * Get stock by symbol
 */
export function getEmergingMarketStock(symbol: string) {
  return EMERGING_MARKET_STOCKS.find(stock => stock.symbol === symbol);
}

/**
 * Check if symbol is an emerging market stock
 */
export function isEmergingMarketStock(symbol: string): boolean {
  return EMERGING_MARKET_STOCKS.some(stock => stock.symbol === symbol);
}

/**
 * Emerging Markets Paper Trading Configuration
 * 
 * Proxy tokens deployed on Celo Alfajores for educational paper trading
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
  tokenAddress?: string; // Deployed on Celo Alfajores
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
  // Celo Alfajores Testnet
  chainId: 44787,
  network: "Celo Alfajores",
  rpcUrl: "https://alfajores-forno.celo-testnet.org",
  explorerUrl: "https://alfajores.celoscan.io",
  
  // Contracts (to be deployed)
  ammAddress: "", // Simple AMM for paper trading
  oracleAddress: "", // Price oracle
  
  // Trading pairs (all paired with cUSD)
  baseCurrency: "cUSD",
  baseCurrencyAddress: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  
  // Price update frequency
  priceUpdateInterval: 86400, // 24 hours
  
  // Paper trading limits
  maxTradeSize: 1000, // 1000 cUSD max per trade
  minTradeSize: 1, // 1 cUSD min per trade
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

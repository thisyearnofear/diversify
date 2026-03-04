"use strict";
/**
 * Emerging Markets Configuration
 *
 * Two-tier system:
 * - REAL_STOCKS: Trackable real emerging market stocks (price data only)
 * - FICTIONAL_COMPANIES: Tradeable tokens on Celo Sepolia AMM (seeded pools)
 *
 * This mirrors the Robinhood testnet strategy: trade fictional, track real
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGION_METADATA = exports.EMERGING_MARKETS_CONFIG = exports.TRACKABLE_EMERGING_MARKET_SYMBOLS = exports.TRADEABLE_EMERGING_MARKET_SYMBOLS = exports.EMERGING_MARKET_COMPANIES = exports.EMERGING_MARKET_STOCKS = exports.FICTIONAL_EMERGING_MARKET_COMPANIES = exports.REAL_EMERGING_MARKET_STOCKS = void 0;
exports.getStocksByRegion = getStocksByRegion;
exports.getCompaniesByRegion = getCompaniesByRegion;
exports.getAllAssetsByRegion = getAllAssetsByRegion;
exports.getEmergingMarketStock = getEmergingMarketStock;
exports.getFictionalCompany = getFictionalCompany;
exports.getAssetBySymbol = getAssetBySymbol;
exports.isTradeableCompany = isTradeableCompany;
exports.isTrackableStock = isTrackableStock;
exports.getTradingTokenAddress = getTradingTokenAddress;
exports.getRealTicker = getRealTicker;
// ============================================
// REAL STOCKS - Track Only
// These are tracked for educational purposes
// ============================================
exports.REAL_EMERGING_MARKET_STOCKS = [
    // African Markets
    {
        symbol: "SAFCOM",
        name: "Safaricom",
        icon: "📱",
        market: "Kenya",
        region: "africa",
        realTicker: "SCOM.NR", // Nairobi Stock Exchange
        description: "Leading telecom and mobile money provider in East Africa",
        isTradeable: false,
    },
    {
        symbol: "DANGOTE",
        name: "Dangote Cement",
        icon: "🏗️",
        market: "Nigeria",
        region: "africa",
        realTicker: "DANGCEM.LG", // Lagos Stock Exchange
        description: "Africa's largest cement producer",
        isTradeable: false,
    },
    {
        symbol: "SHOPRITE",
        name: "Shoprite",
        icon: "🛒",
        market: "South Africa",
        region: "africa",
        realTicker: "SHP.JO", // Johannesburg Stock Exchange
        description: "Africa's largest food retailer",
        isTradeable: false,
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
        isTradeable: false,
    },
    {
        symbol: "MELI",
        name: "MercadoLibre",
        icon: "🛍️",
        market: "Argentina",
        region: "latam",
        realTicker: "MELI", // NASDAQ (also trades in LatAm)
        description: "Latin America's leading e-commerce platform",
        isTradeable: false,
    },
    {
        symbol: "CEMEX",
        name: "CEMEX",
        icon: "🏭",
        market: "Mexico",
        region: "latam",
        realTicker: "CEMEXCPO.MX", // Mexican Stock Exchange
        description: "Global building materials company",
        isTradeable: false,
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
        isTradeable: false,
    },
    {
        symbol: "GRAB",
        name: "Grab Holdings",
        icon: "🚗",
        market: "Singapore",
        region: "asia",
        realTicker: "GRAB", // NASDAQ
        description: "Southeast Asia's super-app for transport and delivery",
        isTradeable: false,
    },
    {
        symbol: "JOLLIBEE",
        name: "Jollibee Foods",
        icon: "🍔",
        market: "Philippines",
        region: "asia",
        realTicker: "JFC.PS", // Philippine Stock Exchange
        description: "Largest fast-food chain in the Philippines",
        isTradeable: false,
    },
];
// ============================================
// FICTIONAL COMPANIES - Tradeable
// These are deployed on Celo Sepolia AMM
// ============================================
exports.FICTIONAL_EMERGING_MARKET_COMPANIES = [
    // 🌍 Africa
    {
        symbol: "WAKANDA",
        name: "Wakanda Design Group",
        icon: "🦅",
        market: "Wakanda",
        region: "africa",
        description: "Advanced technology and vibranium innovation, inspired by Black Panther",
        tokenAddress: "0xe968d89E47c4e4Cd111dcde8d2E984703E7FeA8b", // Formerly SAFCOM
        isTradeable: true,
        inspiration: "Black Panther - Marvel Cinematic Universe",
    },
    {
        symbol: "DAKAR",
        name: "Dakar Nexus Energy",
        icon: "⚡",
        market: "Nigeria",
        region: "africa",
        description: "Near-future energy infrastructure in Lagos, inspired by Lagoon",
        tokenAddress: "0x47A55970913f3e67Da4A3066caD3266339126404", // Formerly DANGOTE
        isTradeable: true,
        inspiration: "Lagoon - Nnedi Okorafor",
    },
    {
        symbol: "SHADOW",
        name: "Shadow Market Syndicates",
        icon: "🔮",
        market: "Sahara",
        region: "africa",
        description: "Merchant networks trading mystical goods in post-apocalyptic Africa",
        tokenAddress: "0x32BEfC5B2834ccD19aFA81cC9762Aa3ec305B674", // Formerly SHOPRITE
        isTradeable: true,
        inspiration: "Who Fears Death - Nnedi Okorafor",
    },
    // 🌎 Latin America
    {
        symbol: "KUBERA",
        name: "Kubera's Treasury Guilds",
        icon: "🏛️",
        market: "India",
        region: "asia", // Hindu mythology origin but fits LatAm trading
        description: "Divine wealth networks and celestial trade routes from Hindu mythology",
        tokenAddress: "0x05334A4CCB4599755D6a7b84F0beF8C4C6380EBF", // Formerly PETROBRAS
        isTradeable: true,
        inspiration: "Hindu Mythology - Kubera, god of wealth",
    },
    {
        symbol: "SANTA",
        name: "Santa Prisca Silver Mining",
        icon: "⛏️",
        market: "Republic of Isthmus",
        region: "latam",
        description: "Cartel-front mining corporation blending power and corruption",
        tokenAddress: "0x1D939e6F21ef32f704e3ddBE7deC411F86b75D13", // Formerly MELI
        isTradeable: true,
        inspiration: "Licence to Kill - James Bond",
    },
    {
        symbol: "SHADALOO",
        name: "Shadaloo Corporation",
        icon: "🥋",
        market: "Southeast Asia",
        region: "asia",
        description: "Underground criminal syndicate functioning as a multinational cartel",
        tokenAddress: "0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3", // Formerly CEMEX
        isTradeable: true,
        inspiration: "Street Fighter - Capcom",
    },
    // 🌏 Asia Pacific
    {
        symbol: "MISHIMA",
        name: "Mishima Zaibatsu",
        icon: "⚔️",
        market: "Japan",
        region: "asia",
        description: "Global conglomerate empire controlling military, tech, and energy",
        tokenAddress: "0x020c58eCcc5372C3B02301F9cEAbB35557A3869B", // Formerly RELIANCE
        isTradeable: true,
        inspiration: "Tekken - Bandai Namco",
    },
    {
        symbol: "ARASAKA",
        name: "Arasaka Corporation",
        icon: "🤖",
        market: "Japan",
        region: "asia",
        description: "Dystopian mega-corporation in cybersecurity, military, and biotech",
        tokenAddress: "0xB1Dc9Bf314BA0c525FF48dA319872f9Ffc1d9291", // Formerly GRAB
        isTradeable: true,
        inspiration: "Cyberpunk 2077 - CD Projekt Red",
    },
    {
        symbol: "SURA",
        name: "Sura Corporation",
        icon: "🧬",
        market: "India",
        region: "asia",
        description: "Robotics and AI research corporation creating humanoid androids",
        tokenAddress: "0x303B0964B9AbB4AAb60F55a3FB2905BAfB6d30AC", // Formerly JOLLIBEE
        isTradeable: true,
        inspiration: "Enthiran (Robot) - Tamil sci-fi film",
    },
];
// ============================================
// Combined Lists for UI
// ============================================
/** All trackable real stocks */
exports.EMERGING_MARKET_STOCKS = exports.REAL_EMERGING_MARKET_STOCKS;
/** All tradeable fictional companies */
exports.EMERGING_MARKET_COMPANIES = exports.FICTIONAL_EMERGING_MARKET_COMPANIES;
/** All tradeable symbols (for token lists) */
exports.TRADEABLE_EMERGING_MARKET_SYMBOLS = exports.FICTIONAL_EMERGING_MARKET_COMPANIES.map(c => c.symbol);
/** All trackable symbols (for price tracking) */
exports.TRACKABLE_EMERGING_MARKET_SYMBOLS = exports.REAL_EMERGING_MARKET_STOCKS.map(s => s.symbol);
// ============================================
// Network Configuration
// ============================================
exports.EMERGING_MARKETS_CONFIG = {
    // Celo Sepolia Testnet
    chainId: 11142220,
    network: "Celo Sepolia",
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    explorerUrl: "https://celo-sepolia.blockscout.com",
    // Contracts
    ammAddress: "0x983b3a94C8266310192135d60D77B871549B9CfF", // TestnetMarketMaker
    wethAddress: "0x95fa0c32181d073FA9b07F0eC3961C845d00bE21", // Wrapped CELO
    // Trading configuration
    baseToken: "CELO",
    baseTokenName: "CELO",
    baseTokenIcon: "🌍",
    feePercent: 0.3,
    // Faucet
    faucetUrl: "https://faucet.celo.org",
    // UI Labels
    marketName: "Emerging Markets Exchange",
    marketDescription: "Trade fictional companies from emerging market fiction & mythology",
    educationalTag: "Paper Trading v2 - Emerging Markets",
};
// ============================================
// Helper Functions
// ============================================
/**
 * Get stocks by region
 */
function getStocksByRegion(region) {
    return exports.REAL_EMERGING_MARKET_STOCKS.filter(stock => stock.region === region);
}
/**
 * Get fictional companies by region
 */
function getCompaniesByRegion(region) {
    return exports.FICTIONAL_EMERGING_MARKET_COMPANIES.filter(company => company.region === region);
}
/**
 * Get all assets (stocks + companies) by region
 */
function getAllAssetsByRegion(region) {
    return [
        ...getStocksByRegion(region),
        ...getCompaniesByRegion(region),
    ];
}
/**
 * Get stock by symbol (real)
 */
function getEmergingMarketStock(symbol) {
    return exports.REAL_EMERGING_MARKET_STOCKS.find(stock => stock.symbol === symbol);
}
/**
 * Get company by symbol (fictional)
 */
function getFictionalCompany(symbol) {
    return exports.FICTIONAL_EMERGING_MARKET_COMPANIES.find(company => company.symbol === symbol);
}
/**
 * Get any asset by symbol
 */
function getAssetBySymbol(symbol) {
    return getEmergingMarketStock(symbol) || getFictionalCompany(symbol);
}
/**
 * Check if symbol is a tradeable fictional company
 */
function isTradeableCompany(symbol) {
    return exports.FICTIONAL_EMERGING_MARKET_COMPANIES.some(company => company.symbol === symbol);
}
/**
 * Check if symbol is a trackable real stock
 */
function isTrackableStock(symbol) {
    return exports.REAL_EMERGING_MARKET_STOCKS.some(stock => stock.symbol === symbol);
}
/**
 * Get token address for trading
 */
function getTradingTokenAddress(symbol) {
    const company = getFictionalCompany(symbol);
    return company?.tokenAddress;
}
/**
 * Get real ticker for price tracking
 */
function getRealTicker(symbol) {
    const stock = getEmergingMarketStock(symbol);
    return stock?.realTicker;
}
// ============================================
// Regional Metadata
// ============================================
exports.REGION_METADATA = {
    africa: {
        label: "Africa",
        icon: "🌍",
        color: "from-green-500 to-emerald-600",
        bgGradient: "from-green-50 to-emerald-50",
        darkBgGradient: "from-green-900/20 to-emerald-900/20",
        description: "East, West, and South African markets",
        countries: ["Kenya", "Nigeria", "South Africa", "Wakanda", "Sahara"],
    },
    latam: {
        label: "Latin America",
        icon: "🌎",
        color: "from-blue-500 to-cyan-600",
        bgGradient: "from-blue-50 to-cyan-50",
        darkBgGradient: "from-blue-900/20 to-cyan-900/20",
        description: "Brazil, Mexico, Argentina, and beyond",
        countries: ["Brazil", "Mexico", "Argentina", "Republic of Isthmus"],
    },
    asia: {
        label: "Asia Pacific",
        icon: "🌏",
        color: "from-orange-500 to-red-600",
        bgGradient: "from-orange-50 to-red-50",
        darkBgGradient: "from-orange-900/20 to-red-900/20",
        description: "India, Japan, Southeast Asia",
        countries: ["India", "Singapore", "Philippines", "Japan"],
    },
};
//# sourceMappingURL=emerging-markets.js.map
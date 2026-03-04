"use strict";
/**
 * Emerging Markets Price Service
 * Fetches real stock prices from multiple free APIs with intelligent caching
 * Supports both real emerging market stocks and fictional companies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emergingMarketsPriceService = exports.EmergingMarketsPriceService = void 0;
const emerging_markets_1 = require("@/config/emerging-markets");
// Cache configuration
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes for price data
const CACHE_TTL_VOLATILE = 1000 * 60 * 5; // 5 minutes during market hours
// API Rate limit tracking
class RateLimitTracker {
    calls = new Map();
    canMakeCall(source, limit, windowMs) {
        const now = Date.now();
        const calls = this.calls.get(source) || [];
        // Remove old calls outside the window
        const recentCalls = calls.filter(t => now - t < windowMs);
        this.calls.set(source, recentCalls);
        return recentCalls.length < limit;
    }
    recordCall(source) {
        const calls = this.calls.get(source) || [];
        calls.push(Date.now());
        this.calls.set(source, calls);
    }
}
class EmergingMarketsPriceService {
    cache = new Map();
    rateLimiter = new RateLimitTracker();
    // API Keys (should be env vars in production)
    alphaVantageKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || "";
    // Rate limits
    RATE_LIMITS = {
        YAHOO: { limit: 2000, window: 1000 * 60 * 60 }, // 2000/hour
        ALPHA_VANTAGE: { limit: 25, window: 1000 * 60 * 60 * 24 }, // 25/day
        FINNHUB: { limit: 60, window: 1000 * 60 }, // 60/minute
    };
    /**
     * Get cached price or fetch fresh data
     */
    async getPrice(symbol) {
        const cached = this.getCachedPrice(symbol);
        if (cached) {
            return cached;
        }
        return this.fetchAndCachePrice(symbol);
    }
    /**
     * Get prices for all emerging market stocks
     */
    async getAllPrices() {
        const results = {};
        // Fetch in parallel with staggered delays to avoid rate limits
        const fetchPromises = emerging_markets_1.EMERGING_MARKET_STOCKS.map((stock, index) => new Promise(resolve => {
            setTimeout(async () => {
                try {
                    const price = await this.getPrice(stock.symbol);
                    if (price) {
                        results[stock.symbol] = price;
                    }
                }
                catch (error) {
                    console.warn(`[PriceService] Failed to fetch ${stock.symbol}:`, error);
                }
                resolve();
            }, index * 100); // 100ms stagger
        }));
        await Promise.all(fetchPromises);
        return results;
    }
    /**
     * Check if cache is valid
     */
    getCachedPrice(symbol) {
        const cached = this.cache.get(symbol);
        if (!cached)
            return null;
        const isMarketHours = this.isMarketHours(symbol);
        const ttl = isMarketHours ? CACHE_TTL_VOLATILE : CACHE_TTL;
        if (Date.now() - cached.lastUpdated < ttl) {
            return cached;
        }
        return null;
    }
    /**
     * Fetch price with fallback chain
     */
    async fetchAndCachePrice(symbol) {
        const stock = emerging_markets_1.EMERGING_MARKET_STOCKS.find(s => s.symbol === symbol);
        if (!stock)
            return null;
        let result = null;
        // Try Yahoo Finance first (best coverage, high rate limit)
        if (this.rateLimiter.canMakeCall("YAHOO", this.RATE_LIMITS.YAHOO.limit, this.RATE_LIMITS.YAHOO.window)) {
            try {
                result = await this.fetchFromYahoo(stock);
                if (result)
                    this.rateLimiter.recordCall("YAHOO");
            }
            catch (error) {
                console.warn(`[PriceService] Yahoo Finance failed for ${symbol}:`, error);
            }
        }
        // Fallback to Alpha Vantage
        if (!result && this.alphaVantageKey &&
            this.rateLimiter.canMakeCall("ALPHA_VANTAGE", this.RATE_LIMITS.ALPHA_VANTAGE.limit, this.RATE_LIMITS.ALPHA_VANTAGE.window)) {
            try {
                result = await this.fetchFromAlphaVantage(stock);
                if (result)
                    this.rateLimiter.recordCall("ALPHA_VANTAGE");
            }
            catch (error) {
                console.warn(`[PriceService] Alpha Vantage failed for ${symbol}:`, error);
            }
        }
        // Fallback to Finnhub
        if (!result && process.env.NEXT_PUBLIC_FINNHUB_KEY &&
            this.rateLimiter.canMakeCall("FINNHUB", this.RATE_LIMITS.FINNHUB.limit, this.RATE_LIMITS.FINNHUB.window)) {
            try {
                result = await this.fetchFromFinnhub(stock);
                if (result)
                    this.rateLimiter.recordCall("FINNHUB");
            }
            catch (error) {
                console.warn(`[PriceService] Finnhub failed for ${symbol}:`, error);
            }
        }
        if (!result) {
            console.error(`[PriceService] All sources failed for ${symbol}`);
            return null;
        }
        const cacheEntry = {
            symbol,
            price: result.price,
            currency: result.currency,
            usdEquivalent: result.usdEquivalent,
            change24h: result.change24h ?? null,
            changePercent24h: result.changePercent24h ?? null,
            lastUpdated: Date.now(),
            source: result.source,
        };
        this.cache.set(symbol, cacheEntry);
        return cacheEntry;
    }
    /**
     * Yahoo Finance (unofficial but widely used)
     * Best for international exchanges
     */
    async fetchFromYahoo(stock) {
        // Yahoo uses different ticker formats
        const yahooTicker = this.toYahooTicker(stock.realTicker, stock.market);
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=2d`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!response.ok) {
                throw new Error(`Yahoo API error: ${response.status}`);
            }
            const data = await response.json();
            if (!data.chart?.result?.[0]) {
                throw new Error('Invalid Yahoo response structure');
            }
            const result = data.chart.result[0];
            const meta = result.meta;
            const prices = result.indicators?.quote?.[0]?.close || [];
            const currentPrice = meta.regularMarketPrice;
            const previousClose = meta.previousClose || prices[prices.length - 2];
            const change24h = previousClose ? currentPrice - previousClose : undefined;
            const changePercent24h = previousClose ? (change24h / previousClose) * 100 : undefined;
            // Get currency from meta
            const currency = meta.currency || this.inferCurrency(stock.market);
            // Calculate USD equivalent (simplified - in production use exchange rate API)
            const usdEquivalent = await this.convertToUsd(currentPrice, currency);
            return {
                price: currentPrice,
                currency,
                usdEquivalent,
                change24h,
                changePercent24h,
                source: "yahoo-finance",
            };
        }
        catch (error) {
            console.warn(`[PriceService] Yahoo fetch failed for ${stock.symbol}:`, error);
            return null;
        }
    }
    /**
     * Alpha Vantage API
     * Reliable but limited free tier
     */
    async fetchFromAlphaVantage(stock) {
        if (!this.alphaVantageKey)
            return null;
        try {
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock.realTicker}&apikey=${this.alphaVantageKey}`);
            if (!response.ok) {
                throw new Error(`Alpha Vantage API error: ${response.status}`);
            }
            const data = await response.json();
            const quote = data["Global Quote"];
            if (!quote || !quote["05. price"]) {
                throw new Error('Invalid Alpha Vantage response');
            }
            const price = parseFloat(quote["05. price"]);
            const changePercent24h = parseFloat(quote["10. change percent"]?.replace('%', '') || '0');
            const change24h = parseFloat(quote["09. change"] || '0');
            const currency = this.inferCurrency(stock.market);
            const usdEquivalent = await this.convertToUsd(price, currency);
            return {
                price,
                currency,
                usdEquivalent,
                change24h,
                changePercent24h,
                source: "alpha-vantage",
            };
        }
        catch (error) {
            console.warn(`[PriceService] Alpha Vantage fetch failed for ${stock.symbol}:`, error);
            return null;
        }
    }
    /**
     * Finnhub API
     * Good for real-time data
     */
    async fetchFromFinnhub(stock) {
        const apiKey = process.env.NEXT_PUBLIC_FINNHUB_KEY;
        if (!apiKey)
            return null;
        try {
            // Finnhub uses different ticker format
            const finnhubTicker = this.toFinnhubTicker(stock.realTicker);
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${finnhubTicker}&token=${apiKey}`);
            if (!response.ok) {
                throw new Error(`Finnhub API error: ${response.status}`);
            }
            const data = await response.json();
            if (!data.c) {
                throw new Error('Invalid Finnhub response');
            }
            const price = data.c; // Current price
            const previousClose = data.pc;
            const change24h = price - previousClose;
            const changePercent24h = (change24h / previousClose) * 100;
            const currency = this.inferCurrency(stock.market);
            const usdEquivalent = await this.convertToUsd(price, currency);
            return {
                price,
                currency,
                usdEquivalent,
                change24h,
                changePercent24h,
                source: "finnhub",
            };
        }
        catch (error) {
            console.warn(`[PriceService] Finnhub fetch failed for ${stock.symbol}:`, error);
            return null;
        }
    }
    /**
     * Convert ticker to Yahoo Finance format
     */
    toYahooTicker(realTicker, market) {
        // Yahoo uses suffixes for different exchanges
        const suffixMap = {
            "Nigeria": "LG", // Lagos
            "Kenya": "NR", // Nairobi
            "South Africa": "JO", // Johannesburg
            "Brazil": "SA", // Sao Paulo
            "Mexico": "MX", // Mexican
            "India": "NS", // NSE (also .BO for BSE)
            "Singapore": "SI",
            "Philippines": "PS",
        };
        const suffix = suffixMap[market];
        if (suffix && !realTicker.includes('.')) {
            return `${realTicker}.${suffix}`;
        }
        return realTicker;
    }
    /**
     * Convert ticker to Finnhub format
     */
    toFinnhubTicker(realTicker) {
        // Finnhub mostly uses standard tickers, but some exchanges need prefixes
        return realTicker.replace(/\..*$/, ''); // Remove exchange suffix
    }
    /**
     * Infer currency from market
     */
    inferCurrency(market) {
        const currencyMap = {
            "Kenya": "KES",
            "Nigeria": "NGN",
            "South Africa": "ZAR",
            "Brazil": "BRL",
            "Argentina": "ARS",
            "Mexico": "MXN",
            "India": "INR",
            "Singapore": "SGD",
            "Philippines": "PHP",
        };
        return currencyMap[market] || "USD";
    }
    /**
     * Convert local currency to USD
     * In production, use a proper exchange rate API
     */
    async convertToUsd(amount, currency) {
        if (currency === "USD")
            return amount;
        // Simplified exchange rates (should be fetched from API in production)
        const rates = {
            "KES": 0.0077, // Kenyan Shilling
            "NGN": 0.00062, // Nigerian Naira
            "ZAR": 0.055, // South African Rand
            "BRL": 0.18, // Brazilian Real
            "ARS": 0.001, // Argentine Peso (volatile)
            "MXN": 0.05, // Mexican Peso
            "INR": 0.012, // Indian Rupee
            "SGD": 0.74, // Singapore Dollar
            "PHP": 0.018, // Philippine Peso
        };
        const rate = rates[currency] || 1;
        return amount * rate;
    }
    /**
     * Check if market is currently open
     * Used to determine cache TTL
     */
    isMarketHours(symbol) {
        const stock = emerging_markets_1.EMERGING_MARKET_STOCKS.find(s => s.symbol === symbol);
        if (!stock)
            return false;
        const now = new Date();
        const utcHour = now.getUTCHours();
        const day = now.getUTCDay();
        // Weekend check
        if (day === 0 || day === 6)
            return false;
        // Simplified market hours (UTC)
        // Most markets open around 9-10am local time
        const marketHours = {
            "Kenya": { open: 7, close: 14 }, // EAT (UTC+3)
            "Nigeria": { open: 8, close: 15 }, // WAT (UTC+1)
            "South Africa": { open: 7, close: 15 }, // SAST (UTC+2)
            "Brazil": { open: 13, close: 20 }, // BRT (UTC-3)
            "Argentina": { open: 13, close: 20 }, // ART (UTC-3)
            "Mexico": { open: 14, close: 21 }, // CST (UTC-6)
            "India": { open: 3, close: 10 }, // IST (UTC+5:30)
            "Singapore": { open: 1, close: 9 }, // SGT (UTC+8)
            "Philippines": { open: 1, close: 9 }, // PHT (UTC+8)
        };
        const hours = marketHours[stock.market];
        if (!hours)
            return false;
        return utcHour >= hours.open && utcHour <= hours.close;
    }
    /**
     * Get service status for debugging
     */
    getStatus() {
        const status = {};
        for (const [source, limits] of Object.entries(this.RATE_LIMITS)) {
            const calls = this.rateLimiter.calls.get(source) || [];
            const now = Date.now();
            const recentCalls = calls.filter((t) => now - t < limits.window);
            const remaining = limits.limit - recentCalls.length;
            const resetIn = recentCalls.length > 0
                ? `${Math.ceil((limits.window - (now - recentCalls[0])) / 60000)}m`
                : "N/A";
            status[source] = { remaining, resetIn };
        }
        return {
            cacheSize: this.cache.size,
            rateLimits: status,
        };
    }
    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.EmergingMarketsPriceService = EmergingMarketsPriceService;
// Singleton instance
exports.emergingMarketsPriceService = new EmergingMarketsPriceService();
//# sourceMappingURL=emerging-markets-price.service.js.map
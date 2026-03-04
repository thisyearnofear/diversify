"use strict";
/**
 * Improved Data Services
 * Centralized services for inflation and exchange rate data
 * Uses IMF → World Bank → fallback (inflation) and Frankfurter → fallback (exchange rates)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeRateService = exports.inflationService = exports.ExchangeRateService = exports.ImprovedInflationService = void 0;
const unified_cache_service_1 = require("./unified-cache-service");
const circuit_breaker_service_1 = require("./circuit-breaker-service");
const inflation_1 = require("../constants/inflation");
class ImprovedInflationService {
    circuitBreaker = circuit_breaker_service_1.circuitBreakerManager.getCircuit('inflation-service', {
        failureThreshold: 3,
        timeout: 30000,
        successThreshold: 2
    });
    /**
     * Get inflation data via API proxy with caching
     */
    async getInflationData() {
        const cacheKey = 'inflation-all-regions';
        return this.circuitBreaker.callWithFallback(async () => {
            return unified_cache_service_1.unifiedCache.getOrFetch(cacheKey, () => this.fetchFromProxy(), 'moderate');
        }, () => this.getFallbackData());
    }
    /**
     * Fetch from API proxy (handles IMF/World Bank server-side)
     */
    async fetchFromProxy() {
        const response = await fetch('/api/inflation', {
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            throw new Error(`Inflation API error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.countries || data.countries.length === 0) {
            throw new Error('No inflation data returned');
        }
        console.log(`[Inflation] Fetched from ${data.source}: ${data.countries.length} countries`);
        return { data, source: data.source };
    }
    /**
     * Fallback when API is unavailable
     */
    getFallbackData() {
        console.warn('[Inflation] Using static fallback data');
        // Get the fallback data organized by region
        const fallbackByRegion = (0, inflation_1.getFallbackByRegion)();
        // Flatten the regional data into a single countries array
        const allCountries = Object.values(fallbackByRegion).flatMap(regionData => regionData.countries.map(country => ({
            country: country.country,
            countryCode: country.country, // Using country as countryCode for simplicity
            value: country.value,
            year: country.year,
            source: 'fallback'
        })));
        return {
            data: {
                countries: allCountries,
                source: 'fallback',
                lastUpdated: new Date().toISOString()
            },
            source: 'fallback'
        };
    }
}
exports.ImprovedInflationService = ImprovedInflationService;
class ExchangeRateService {
    circuitBreaker = circuit_breaker_service_1.circuitBreakerManager.getCircuit('exchange-rate-service', {
        failureThreshold: 3,
        timeout: 15000,
        successThreshold: 2
    });
    /**
     * Get current exchange rate between two currencies
     */
    async getExchangeRate(fromCurrency, toCurrency) {
        const cacheKey = `exchange-rate-${fromCurrency}-${toCurrency}`;
        return this.circuitBreaker.callWithFallback(async () => {
            return unified_cache_service_1.unifiedCache.getOrFetch(cacheKey, () => this.fetchCurrentRate(fromCurrency, toCurrency), 'volatile');
        }, () => this.getFallbackCurrentRate(fromCurrency, toCurrency));
    }
    /**
     * Get historical exchange rates (30 days)
     */
    async getHistoricalRates(fromCurrency, toCurrency) {
        const cacheKey = `exchange-rate-historical-${fromCurrency}-${toCurrency}`;
        return this.circuitBreaker.callWithFallback(async () => {
            return unified_cache_service_1.unifiedCache.getOrFetch(cacheKey, () => this.fetchHistoricalRates(fromCurrency, toCurrency), 'moderate');
        }, () => this.getFallbackHistoricalRates(fromCurrency, toCurrency));
    }
    /**
     * Fetch current rate from API proxy
     */
    async fetchCurrentRate(fromCurrency, toCurrency) {
        const response = await fetch(`/api/exchange-rates?from=${fromCurrency}&to=${toCurrency}`, {
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
            throw new Error(`Exchange rate API error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.rate) {
            throw new Error('No exchange rate returned');
        }
        console.log(`[Exchange Rate] Fetched ${fromCurrency}-${toCurrency} from ${data.source}`);
        return { data, source: data.source };
    }
    /**
     * Fetch historical rates from API proxy
     */
    async fetchHistoricalRates(fromCurrency, toCurrency) {
        const response = await fetch(`/api/exchange-rates?from=${fromCurrency}&to=${toCurrency}&historical=true`, {
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            throw new Error(`Historical exchange rate API error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.dates || !data.rates) {
            throw new Error('No historical exchange rate data returned');
        }
        console.log(`[Exchange Rate] Fetched historical ${fromCurrency}-${toCurrency} from ${data.source}: ${data.dates.length} days`);
        return { data, source: data.source };
    }
    /**
     * Fallback current rate
     */
    getFallbackCurrentRate(fromCurrency, toCurrency) {
        console.warn(`[Exchange Rate] Using fallback for ${fromCurrency}-${toCurrency}`);
        return {
            data: {
                rate: 1,
                date: new Date().toISOString().split('T')[0],
                source: 'fallback',
                from: fromCurrency,
                to: toCurrency
            },
            source: 'fallback'
        };
    }
    /**
     * Fallback historical rates
     */
    getFallbackHistoricalRates(fromCurrency, toCurrency) {
        console.warn(`[Exchange Rate] Using fallback historical data for ${fromCurrency}-${toCurrency}`);
        const dates = [];
        const rates = [];
        const today = new Date();
        for (let i = 30; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
            rates.push(1);
        }
        return {
            data: {
                dates,
                rates,
                source: 'fallback',
                from: fromCurrency,
                to: toCurrency
            },
            source: 'fallback'
        };
    }
}
exports.ExchangeRateService = ExchangeRateService;
exports.inflationService = new ImprovedInflationService();
exports.exchangeRateService = new ExchangeRateService();
//# sourceMappingURL=improved-data-services.js.map
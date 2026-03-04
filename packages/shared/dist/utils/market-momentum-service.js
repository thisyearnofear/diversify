"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketMomentumService = exports.MarketMomentumService = void 0;
const unified_cache_service_1 = require("./unified-cache-service");
const circuit_breaker_service_1 = require("./circuit-breaker-service");
class MarketMomentumService {
    circuitBreaker = circuit_breaker_service_1.circuitBreakerManager.getCircuit("momentum-service");
    /**
     * Get aggregated global momentum metrics
     */
    async getMomentum() {
        const result = await this.circuitBreaker.callWithFallback(async () => {
            return unified_cache_service_1.unifiedCache.getOrFetch("market-momentum", () => this.fetchAllMomentum(), "moderate" // Cache for 1 hour
            );
        }, () => ({ data: this.getFallbackMomentum().data, source: "fallback" }));
        return result.data;
    }
    async fetchAllMomentum() {
        try {
            // Fetch from our server-side proxy to avoid CSP issues and minimize client workload
            const response = await fetch("/api/finance/momentum", {
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) {
                throw new Error(`Proxy returned ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.warn("[Momentum] Fetch failed, using fallback:", error);
            throw error;
        }
    }
    getFallbackMomentum() {
        return {
            data: {
                globalStablecoinCap: 162400000000,
                stablecoin24hChange: 0.12,
                marketSentiment: 65,
                rwaGrowth7d: 0.8,
                lastUpdated: Date.now()
            },
            source: "fallback"
        };
    }
}
exports.MarketMomentumService = MarketMomentumService;
exports.marketMomentumService = new MarketMomentumService();
//# sourceMappingURL=market-momentum-service.js.map
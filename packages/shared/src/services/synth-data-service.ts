import axios from "axios";
import { unifiedCache } from "../utils/unified-cache-service";

export interface SynthForecast {
  current_price: number;
  forecast_future?: {
    average_volatility?: number;
    volatility?: number[];
    percentiles?: Record<string, number>;
  };
  forecast_past?: {
    average_volatility?: number;
    volatility?: number[];
    percentiles?: Record<string, number>;
  };
  realized?: {
    average_volatility?: number;
    volatility?: number[];
    percentiles?: Record<string, number>;
  };
  // Legacy format support (for fallback data)
  "1H"?: {
    average_volatility: number;
    percentiles: Record<string, number>;
  };
  "24H"?: {
    average_volatility: number;
    percentiles: Record<string, number>;
  };
}

export interface SynthVolatility {
  asset: string;
  realized_vol: number;
  forecast_vol: number;
}

export interface SynthOptionPricing {
  asset: string;
  implied_vol: number;
}

export interface SynthLiquidation {
  asset: string;
  risk_score: number;
}

const BASE_URL = "https://api.synthdata.co";
const API_KEY = process.env.SYNTH_API_KEY;
const DEFAULT_FALLBACK_FORECAST: SynthForecast = {
  current_price: 100,
  "1H": {
    average_volatility: 0.02,
    percentiles: { p5: 95, p25: 98, p50: 100, p75: 102, p95: 105 }
  },
  "24H": {
    average_volatility: 0.05,
    percentiles: { p5: 90, p25: 96, p50: 100, p75: 104, p95: 110 }
  },
  forecast_future: {
    average_volatility: 0.08,
    percentiles: { p5: 85, p25: 94, p50: 100, p75: 106, p95: 115 }
  },
  realized: {
    average_volatility: 0.04
  }
};

// Fallback data for when Synth API is unavailable
const FALLBACK_DATA: Record<string, { forecast: SynthForecast; volatility: SynthVolatility }> = {
  BTC: {
    forecast: {
      current_price: 67500,
      "1H": {
        average_volatility: 0.02,
        percentiles: { p5: 67000, p25: 67200, p50: 67500, p75: 67800, p95: 68200 }
      },
      "24H": {
        average_volatility: 0.05,
        percentiles: { p5: 66000, p25: 66800, p50: 67500, p75: 68200, p95: 69000 }
      },
      forecast_future: {
        average_volatility: 0.08,
        percentiles: { p5: 65000, p25: 66500, p50: 67500, p75: 68500, p95: 70000 }
      },
      realized: {
        average_volatility: 0.04
      }
    },
    volatility: {
      asset: "BTC",
      realized_vol: 0.04,
      forecast_vol: 0.06
    }
  },
  ETH: {
    forecast: {
      current_price: 4200,
      "1H": {
        average_volatility: 0.025,
        percentiles: { p5: 4150, p25: 4180, p50: 4200, p75: 4220, p95: 4250 }
      },
      "24H": {
        average_volatility: 0.06,
        percentiles: { p5: 4050, p25: 4150, p50: 4200, p75: 4250, p95: 4350 }
      },
      forecast_future: {
        average_volatility: 0.09,
        percentiles: { p5: 3950, p25: 4100, p50: 4200, p75: 4300, p95: 4450 }
      },
      realized: {
        average_volatility: 0.05
      }
    },
    volatility: {
      asset: "ETH",
      realized_vol: 0.05,
      forecast_vol: 0.07
    }
  },
  NVDAX: {
    forecast: {
      current_price: 180,
      "1H": {
        average_volatility: 0.015,
        percentiles: { p5: 178, p25: 179, p50: 180, p75: 181, p95: 182 }
      },
      "24H": {
        average_volatility: 0.035,
        percentiles: { p5: 175, p25: 178, p50: 180, p75: 182, p95: 185 }
      },
      forecast_future: {
        average_volatility: 0.055,
        percentiles: { p5: 170, p25: 176, p50: 180, p75: 184, p95: 190 }
      },
      realized: {
        average_volatility: 0.03
      }
    },
    volatility: {
      asset: "NVDAX",
      realized_vol: 0.03,
      forecast_vol: 0.05
    }
  },
  TSLAX: {
    forecast: {
      current_price: 280,
      "1H": {
        average_volatility: 0.018,
        percentiles: { p5: 275, p25: 278, p50: 280, p75: 282, p95: 285 }
      },
      "24H": {
        average_volatility: 0.04,
        percentiles: { p5: 270, p25: 276, p50: 280, p75: 284, p95: 290 }
      },
      forecast_future: {
        average_volatility: 0.065,
        percentiles: { p5: 260, p25: 274, p50: 280, p75: 286, p95: 295 }
      },
      realized: {
        average_volatility: 0.035
      }
    },
    volatility: {
      asset: "TSLAX",
      realized_vol: 0.035,
      forecast_vol: 0.055
    }
  },
  SPYX: {
    forecast: {
      current_price: 600,
      "1H": {
        average_volatility: 0.01,
        percentiles: { p5: 598, p25: 599, p50: 600, p75: 601, p95: 602 }
      },
      "24H": {
        average_volatility: 0.025,
        percentiles: { p5: 595, p25: 598, p50: 600, p75: 602, p95: 605 }
      },
      forecast_future: {
        average_volatility: 0.04,
        percentiles: { p5: 590, p25: 596, p50: 600, p75: 604, p95: 610 }
      },
      realized: {
        average_volatility: 0.02
      }
    },
    volatility: {
      asset: "SPYX",
      realized_vol: 0.02,
      forecast_vol: 0.035
    }
  },
  AAPLX: {
    forecast: {
      current_price: 220,
      "1H": {
        average_volatility: 0.012,
        percentiles: { p5: 218, p25: 219, p50: 220, p75: 221, p95: 222 }
      },
      "24H": {
        average_volatility: 0.03,
        percentiles: { p5: 215, p25: 218, p50: 220, p75: 222, p95: 225 }
      },
      forecast_future: {
        average_volatility: 0.045,
        percentiles: { p5: 210, p25: 216, p50: 220, p75: 224, p95: 230 }
      },
      realized: {
        average_volatility: 0.025
      }
    },
    volatility: {
      asset: "AAPLX",
      realized_vol: 0.025,
      forecast_vol: 0.04
    }
  }
};

/**
 * Service for interacting with Synth API (docs.synthdata.co)
 * Provides probabilistic price forecasts and volatility metrics.
 * 
 * Uses unified-cache-service for:
 * - Request coalescing (deduplicates concurrent requests)
 * - Stale-while-revalidate fallback on errors
 * - Smart TTL management (30min for price data)
 */
export class SynthDataService {
  private static readonly SUPPORTED_SYNTH_ASSETS = new Set(Object.keys(FALLBACK_DATA));

  /**
   * Fetches prediction data for a specific asset with unified caching and fallbacks.
   * @param asset The asset symbol (e.g., BTC, ETH, NVDAX)
   * @param horizon Optional: "1h" for short-term or "24h" for longer-term forecasts
   */
  static async getPredictions(asset: string, horizon: "1h" | "24h" = "24h"): Promise<SynthForecast | null> {
    try {
      const cacheKey = horizon === "1h" ? `synth:predictions:${asset}:1h` : `synth:predictions:${asset}`;
      const result = await unifiedCache.getOrFetch<SynthForecast>(
        cacheKey,
        async () => {
          const data = await this.makeApiRequest<any>(
            `${BASE_URL}/insights/prediction-percentiles`,
            { asset }
          );
          if (!data) throw new Error('No data from API');
          const normalizedData = this.normalizeForecast(data, asset);
          if (!normalizedData) throw new Error('Invalid Synth forecast schema');

          return { data: normalizedData, source: 'synth-api' };
        },
        'volatile', // 30min TTL for price forecasts
        false
      );
      return result.data;
    } catch (error) {
      console.error(`[Synth API][${this.classifyError(error)}] Failed to fetch predictions for ${asset}:`, error);
      // Return fallback on any error (unified cache already tried stale data)
      return this.getFallbackForecast(asset);
    }
  }

  /**
   * Fetches volatility insights for a specific asset with unified caching and fallbacks.
   * @param asset The asset symbol
   * @param horizon Optional: "1h" for short-term or "24h" for longer-term volatility
   */
  static async getVolatility(asset: string, horizon: "1h" | "24h" = "24h"): Promise<SynthVolatility | null> {
    try {
      const cacheKey = horizon === "1h" ? `synth:volatility:${asset}:1h` : `synth:volatility:${asset}`;
      const result = await unifiedCache.getOrFetch<SynthVolatility>(
        cacheKey,
        async () => {
          const data = await this.makeApiRequest<any>(
            `${BASE_URL}/insights/volatility`,
            { asset }
          );
          if (!data) throw new Error('No data from API');

          // The API returns realized and forecast_future with volatility arrays
          const mappedData = this.normalizeVolatility(data, asset);
          if (!mappedData) throw new Error('Invalid Synth volatility schema');

          return { data: mappedData, source: 'synth-api' };
        },
        'volatile', // 30min TTL for volatility data
        false
      );
      return result.data;
    } catch (error) {
      console.error(`[Synth API][${this.classifyError(error)}] Failed to fetch volatility for ${asset}:`, error);
      // Return fallback on any error (unified cache already tried stale data)
      return this.getFallbackVolatility(asset);
    }
  }

  /**
   * Fetches option pricing insights for a specific asset.
   */
  static async getOptionPricing(asset: string): Promise<SynthOptionPricing | null> {
    try {
      const result = await unifiedCache.getOrFetch<SynthOptionPricing>(
        `synth:options:${asset}`,
        async () => {
          const data = await this.makeApiRequest<any>(
            `${BASE_URL}/insights/option-pricing`,
            { asset }
          );
          if (!data) throw new Error('No data from API');

          const normalizedData = this.normalizeOptionPricing(data, asset);
          if (!normalizedData) throw new Error('Invalid Synth option pricing schema');

          return { data: normalizedData, source: 'synth-api' };
        },
        'volatile',
        false
      );
      return result.data;
    } catch (error) {
      console.error(`[Synth API][${this.classifyError(error)}] Failed to fetch option pricing for ${asset}:`, error);
      return this.getFallbackOptionPricing(asset);
    }
  }

  /**
   * Fetches liquidation probabilities for a specific asset.
   */
  static async getLiquidation(asset: string): Promise<SynthLiquidation | null> {
    try {
      const result = await unifiedCache.getOrFetch<SynthLiquidation>(
        `synth:liquidation:${asset}`,
        async () => {
          const data = await this.makeApiRequest<any>(
            `${BASE_URL}/insights/liquidation`,
            { asset }
          );
          if (!data) throw new Error('No data from API');

          const normalizedData = this.normalizeLiquidation(data, asset);
          if (!normalizedData) throw new Error('Invalid Synth liquidation schema');

          return { data: normalizedData, source: 'synth-api' };
        },
        'volatile',
        false
      );
      return result.data;
    } catch (error) {
      console.error(`[Synth API][${this.classifyError(error)}] Failed to fetch liquidation for ${asset}:`, error);
      return this.getFallbackLiquidation(asset);
    }
  }

  /**
   * Makes an API request with retry logic and proper error handling.
   */
  private static async makeApiRequest<T>(
    url: string,
    params: Record<string, any>
  ): Promise<T | null> {
    const headers: Record<string, string> = {};
    if (API_KEY) {
      headers["Authorization"] = `Apikey ${API_KEY}`;
    } else {
      console.warn("[Synth API] No API key configured, using unauthenticated access");
    }

    const maxRetries = 2;
    const baseDelay = 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          params,
          headers,
          timeout: 10000, // 10 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        });

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.data;
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[Synth API] Attempt ${attempt + 1} failed for ${params.asset}, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return null;
  }

  /**
   * Gets fallback forecast data for an asset.
   */
  private static getFallbackForecast(asset: string): SynthForecast | null {
    const fallback = FALLBACK_DATA[asset];
    if (fallback) {
      console.warn(`[Synth API] Using deterministic fallback forecast data for supported asset: ${asset}`);
      return this.normalizeForecast(fallback.forecast, asset);
    }

    console.warn(`[Synth API] Asset ${asset} is not in supported fallback coverage map; using default deterministic fallback.`);
    return this.normalizeForecast(DEFAULT_FALLBACK_FORECAST, asset);
  }

  /**
   * Gets fallback volatility data for an asset.
   */
  private static getFallbackVolatility(asset: string): SynthVolatility | null {
    const fallback = FALLBACK_DATA[asset];
    if (fallback) {
      return fallback.volatility;
    }

    // Default fallback for unknown assets
    return {
      asset,
      realized_vol: 0.04,
      forecast_vol: 0.06
    };
  }

  /**
   * Gets fallback option pricing data for an asset.
   */
  private static getFallbackOptionPricing(asset: string): SynthOptionPricing {
    return {
      asset,
      implied_vol: 0.5
    };
  }

  /**
   * Gets fallback liquidation data for an asset.
   */
  private static getFallbackLiquidation(asset: string): SynthLiquidation {
    return {
      asset,
      risk_score: 50
    };
  }

  private static normalizePercentiles(input: any): Record<string, number> | undefined {
    if (!input || typeof input !== 'object') return undefined;

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(input)) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        normalized[key] = num;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private static normalizeForecastSection(input: any): {
    average_volatility?: number;
    volatility?: number[];
    percentiles?: Record<string, number>;
  } | undefined {
    if (!input || typeof input !== 'object') return undefined;

    const avg = Number(input.average_volatility);
    const volatility = Array.isArray(input.volatility)
      ? input.volatility.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined;
    const percentiles = this.normalizePercentiles(input.percentiles);

    const section = {
      average_volatility: Number.isFinite(avg) ? avg : undefined,
      volatility: volatility && volatility.length > 0 ? volatility : undefined,
      percentiles
    };

    if (!section.average_volatility && !section.volatility && !section.percentiles) {
      return undefined;
    }

    return section;
  }

  private static normalizeForecast(data: any, asset: string): SynthForecast | null {
    if (!data || typeof data !== 'object') return null;

    const fallbackCurrentPrice = FALLBACK_DATA[asset]?.forecast.current_price ?? DEFAULT_FALLBACK_FORECAST.current_price;
    const currentPrice = Number(data.current_price ?? data.currentPrice ?? fallbackCurrentPrice);

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return null;
    }

    const oneHour = this.normalizeForecastSection(data["1H"] ?? data.forecast_past ?? data.past);
    const twentyFourHour = this.normalizeForecastSection(data["24H"] ?? data.forecast_future ?? data.future);
    const forecastFuture = this.normalizeForecastSection(data.forecast_future ?? data["24H"]);
    const forecastPast = this.normalizeForecastSection(data.forecast_past ?? data["1H"]);
    const realized = this.normalizeForecastSection(data.realized);

    return {
      current_price: currentPrice,
      ...(forecastFuture ? { forecast_future: forecastFuture } : {}),
      ...(forecastPast ? { forecast_past: forecastPast } : {}),
      ...(realized ? { realized } : {}),
      ...(oneHour?.average_volatility && oneHour.percentiles
        ? { "1H": { average_volatility: oneHour.average_volatility, percentiles: oneHour.percentiles } }
        : {}),
      ...(twentyFourHour?.average_volatility && twentyFourHour.percentiles
        ? { "24H": { average_volatility: twentyFourHour.average_volatility, percentiles: twentyFourHour.percentiles } }
        : {}),
    };
  }

  private static normalizeVolatility(data: any, asset: string): SynthVolatility | null {
    if (!data || typeof data !== 'object') return null;

    const realizedVol = Number(data.realized_vol ?? data.realized?.average_volatility ?? data.realized?.volatility?.[0]);
    const forecastVol = Number(data.forecast_vol ?? data.forecast_future?.average_volatility ?? data.forecast_future?.volatility?.[0]);

    return {
      asset,
      realized_vol: Number.isFinite(realizedVol) ? realizedVol : 0,
      forecast_vol: Number.isFinite(forecastVol) ? forecastVol : 0,
    };
  }

  private static normalizeOptionPricing(data: any, asset: string): SynthOptionPricing | null {
    if (!data || typeof data !== 'object') return null;

    const impliedVol = Number(data.implied_vol ?? data.impliedVol ?? data.iv);
    if (!Number.isFinite(impliedVol)) {
      return null;
    }

    return {
      asset,
      implied_vol: impliedVol,
    };
  }

  private static normalizeLiquidation(data: any, asset: string): SynthLiquidation | null {
    if (!data || typeof data !== 'object') return null;

    const riskScore = Number(data.risk_score ?? data.riskScore ?? data.probability);
    if (!Number.isFinite(riskScore)) {
      return null;
    }

    return {
      asset,
      risk_score: Math.max(0, Math.min(100, riskScore)),
    };
  }

  private static classifyError(error: any): 'auth' | 'rate-limit' | 'provider' | 'schema' | 'unknown' {
    const message = String(error?.message || '').toLowerCase();

    if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('apikey')) {
      return 'auth';
    }

    if (message.includes('429') || message.includes('rate')) {
      return 'rate-limit';
    }

    if (message.includes('invalid synth') || message.includes('schema')) {
      return 'schema';
    }

    if (message.includes('http') || message.includes('timeout') || message.includes('network')) {
      return 'provider';
    }

    return 'unknown';
  }

  /**
   * Maps app stocks to Synth API assets.
   * Synth API uses 'X' suffix for some equity proxies on Bittensor SN50.
   */
  static mapStockToSynthAsset(stock: string): string {
    const mapping: Record<string, string> = {
      // Fictional stocks → real asset proxies
      ACME: "SPYX", // ACME as S&P 500 proxy
      SPACELY: "TSLAX", // Spacely as Tech/Tesla proxy
      WAYNE: "NVDAX", // Wayne as AI/Nvidia proxy
      OSCORP: "AAPL", // Oscorp as Apple proxy
      STARK: "BTC", // Stark as Crypto/High-Beta proxy
      // Real stocks → direct Synth API assets
      NVDA: "NVDAX",
      GOOGL: "GOOGLX",
      TSLA: "TSLAX",
      AAPL: "AAPLX",
      // Crypto
      BTC: "BTC",
      ETH: "ETH",
    };
    return mapping[stock] || "BTC";
  }

  static isSynthAssetCovered(asset: string): boolean {
    return this.SUPPORTED_SYNTH_ASSETS.has(asset);
  }
}

import axios from "axios";

export interface SynthForecast {
  current_price: number;
  "1H": {
    average_volatility: number;
    percentiles: Record<string, number>;
  };
  "24H": {
    average_volatility: number;
    percentiles: Record<string, number>;
  };
  forecast_future?: {
    average_volatility: number;
    percentiles: Record<string, number>;
  };
  realized?: {
    average_volatility: number;
  };
}

export interface SynthVolatility {
  asset: string;
  realized_vol: number;
  forecast_vol: number;
}

const BASE_URL = "https://api.synthdata.co";
const CACHE_TTL = 30000; // 30 seconds
const API_KEY = process.env.SYNTH_API_KEY;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Service for interacting with Synth API (docs.synthdata.co)
 * Provides probabilistic price forecasts and volatility metrics.
 */
export class SynthDataService {
  private static predictionsCache: Record<string, CacheEntry<SynthForecast>> = {};
  private static volatilityCache: Record<string, CacheEntry<SynthVolatility>> = {};

  /**
   * Fetches prediction data for a specific asset.
   * @param asset The asset symbol (e.g., BTC, ETH, NVDAX)
   */
  static async getPredictions(asset: string): Promise<SynthForecast | null> {
    const cached = this.predictionsCache[asset];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const headers: Record<string, string> = {};
      if (API_KEY) {
        headers["Authorization"] = `Apikey ${API_KEY}`;
      }

      const response = await axios.get(`${BASE_URL}/insights/prediction-percentiles`, {
        params: { asset },
        headers,
      });
      
      this.predictionsCache[asset] = {
        data: response.data,
        timestamp: Date.now(),
      };
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching Synth predictions for ${asset}:`, error);
      return null;
    }
  }

  /**
   * Fetches volatility insights for a specific asset.
   * @param asset The asset symbol
   */
  static async getVolatility(asset: string): Promise<SynthVolatility | null> {
    const cached = this.volatilityCache[asset];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const headers: Record<string, string> = {};
      if (API_KEY) {
        headers["Authorization"] = `Apikey ${API_KEY}`;
      }

      const response = await axios.get(`${BASE_URL}/insights/volatility`, {
        params: { asset },
        headers,
      });
      
      const mappedData: SynthVolatility = {
        asset: response.data.asset,
        realized_vol: response.data.realized?.average_volatility || 0,
        forecast_vol: response.data.forecast_future?.average_volatility || 0,
      };

      this.volatilityCache[asset] = {
        data: mappedData,
        timestamp: Date.now(),
      };

      return mappedData;
    } catch (error) {
      console.error(`Error fetching Synth volatility for ${asset}:`, error);
      return null;
    }
  }

  /**
   * Maps app stocks to Synth API assets.
   * Synth API uses 'X' suffix for some equity proxies on Bittensor SN50.
   */
  static mapStockToSynthAsset(stock: string): string {
    const mapping: Record<string, string> = {
      ACME: "SPYX", // ACME as S&P 500 proxy
      SPACELY: "TSLAX", // Spacely as Tech/Tesla proxy
      WAYNE: "NVDAX", // Wayne as AI/Nvidia proxy
      OSCORP: "AAPL", // Oscorp as Apple proxy
      STARK: "BTC", // Stark as Crypto/High-Beta proxy
    };
    return mapping[stock] || "BTC";
  }
}

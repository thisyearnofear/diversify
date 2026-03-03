import { SynthDataService } from "../services/synth-data-service";
import { MacroEconomicService } from "./macro-economic-service";
import type { IntelligenceItem } from "../components/trade/TradeIntelligence";

const macroService = new MacroEconomicService();

export interface MarketPulse {
  sentiment: number;
  btcPrice: number;
  btcChange24h: number;
  goldPrice: number;
  goldChange24h: number;
  warRisk: number;
  aiMomentum: number;
  defenseSpending: number;
  lastUpdated: number;
  source: string; // "api" | "fallback" | "mixed"
}

export interface StockTrigger {
  stock: string;
  signal: "BUY" | "SELL" | "HOLD";
  strength: number;
  reason: string;
  source: string;
}

const FICTIONAL_TO_REAL: Record<string, {
  proxy: string;
  drivers: string[];
  sentimentWeight: number;
}> = {
  STARK: {
    proxy: "BTC",
    drivers: ["war_risk", "defense_spending", "crypto_volatility"],
    sentimentWeight: 0.8,
  },
  WAYNE: {
    proxy: "NVDAX",
    drivers: ["ai_momentum", "tech_sentiment"],
    sentimentWeight: 0.9,
  },
  OSCORP: {
    proxy: "AAPLX",
    drivers: ["consumer_tech", "earnings"],
    sentimentWeight: 0.6,
  },
  SPACELY: {
    proxy: "TSLAX",
    drivers: ["energy_policy", "ev_adoption", "crypto_correlation"],
    sentimentWeight: 0.5,
  },
  ACME: {
    proxy: "SPYX",
    drivers: ["general_market", "sentiment", "macro"],
    sentimentWeight: 0.4,
  },
};

export class MarketPulseService {
  private static cache: { data: MarketPulse; timestamp: number } | null = null;
  private static readonly CACHE_TTL = 60000;
  private static serviceStatus = {
    synthWorking: true,
    macroWorking: true,
    lastSynthError: 0,
    lastMacroError: 0
  };

  static async getMarketPulse(): Promise<MarketPulse> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    // Fetch data with error handling
    const [synthBTC, synthVol, macroData] = await Promise.allSettled([
      SynthDataService.getPredictions("BTC"),
      SynthDataService.getVolatility("BTC"),
      macroService.getMacroData(),
    ]);

    // Determine data sources
    const synthSuccess = synthBTC.status === 'fulfilled' && synthBTC.value !== null;
    const volSuccess = synthVol.status === 'fulfilled' && synthVol.value !== null;
    const macroSuccess = macroData.status === 'fulfilled' && macroData.value.data && Object.keys(macroData.value.data).length > 0;

    // Update service status
    if (!synthSuccess) {
      this.serviceStatus.synthWorking = false;
      this.serviceStatus.lastSynthError = Date.now();
      console.warn("[Market Pulse] Synth API failed, using fallback data");
    }
    if (!macroSuccess) {
      this.serviceStatus.macroWorking = false;
      this.serviceStatus.lastMacroError = Date.now();
      console.warn("[Market Pulse] Macro API failed, using fallback data");
    }

    // Extract data with fallbacks
    const btcData = synthSuccess ? synthBTC.value : null;
    const volData = volSuccess ? synthVol.value : null;
    const macroResult = macroSuccess ? macroData.value : { data: {}, source: "fallback" };

    // Calculate metrics with fallback logic
    const btcPrice = btcData?.current_price || this.generateFallbackPrice();
    const btcChange24h = btcData?.["24H"]?.percentiles?.p50 || this.generateFallbackChange();
    const sentiment = volData?.forecast_vol ? 50 + (volData.forecast_vol * 100) : this.generateFallbackSentiment();
    
    const warRisk = this.calculateWarRisk(macroResult.data);
    const aiMomentum = this.calculateAIMomentum(btcData, volData);
    const defenseSpending = this.calculateDefenseSpending(warRisk);
    const goldPrice = 2650;
    const goldChange24h = 0.3;

    // Determine source
    let source: string;
    if (synthSuccess && macroSuccess) {
      source = "api";
    } else if (!synthSuccess && !macroSuccess) {
      source = "fallback";
    } else {
      source = "mixed";
    }

    const pulse: MarketPulse = {
      sentiment: Math.min(100, Math.max(0, sentiment)),
      btcPrice,
      btcChange24h,
      goldPrice,
      goldChange24h,
      warRisk,
      aiMomentum,
      defenseSpending,
      lastUpdated: Date.now(),
      source,
    };

    this.cache = { data: pulse, timestamp: Date.now() };
    return pulse;
  }

  /**
   * Generate fallback BTC price with some randomness
   */
  private static generateFallbackPrice(): number {
    const basePrice = 67500;
    const randomFactor = 0.95 + Math.random() * 0.1;
    return Math.round(basePrice * randomFactor);
  }

  /**
   * Generate fallback 24h change with some randomness
   */
  private static generateFallbackChange(): number {
    // Random change between -5% and +5%
    return (Math.random() - 0.5) * 10;
  }

  /**
   * Generate fallback sentiment score
   */
  private static generateFallbackSentiment(): number {
    // Random sentiment between 40 and 60 (neutral range)
    return 40 + Math.random() * 20;
  }

  private static calculateWarRisk(data: Record<string, any>): number {
    const regions = Object.values(data) as any[];
    if (regions.length === 0) return 30;

    const stabilityScores = regions
      .map(r => r.politicalStability || 50)
      .filter(s => s !== null);

    if (stabilityScores.length === 0) return 30;

    const avgStability = stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length;
    return Math.max(0, Math.min(100, 100 - avgStability));
  }

  private static calculateAIMomentum(btc: any, vol: any): number {
    if (!btc || !vol) return 50;

    const volScore = vol.forecast_vol > vol.realized_vol ? 60 : 45;
    const priceMomentum = btc["24H"]?.percentiles?.p50 || 0;

    return Math.min(100, Math.max(0, 50 + priceMomentum * 10 + volScore - 50));
  }

  private static calculateDefenseSpending(warRisk: number): number {
    return 20 + (warRisk * 0.6);
  }

  static generateTriggers(pulse: MarketPulse): StockTrigger[] {
    const triggers: StockTrigger[] = [];

    if (pulse.warRisk > 50) {
      triggers.push({
        stock: "STARK",
        signal: "BUY",
        strength: Math.min(1, (pulse.warRisk - 50) / 50),
        reason: `Elevated global instability (${Math.round(pulse.warRisk)}%) increases defense sector outlook`,
        source: "Macro Analysis",
      });
    }

    if (pulse.btcChange24h < -3) {
      triggers.push({
        stock: "STARK",
        signal: "SELL",
        strength: Math.min(1, Math.abs(pulse.btcChange24h) / 10),
        reason: "Crypto market crash correlates with risk-off sentiment",
        source: "Crypto Sentiment",
      });
    }

    if (pulse.aiMomentum > 65) {
      triggers.push({
        stock: "WAYNE",
        signal: "BUY",
        strength: Math.min(1, (pulse.aiMomentum - 65) / 35),
        reason: `AI sector momentum at ${Math.round(pulse.aiMomentum)}% - tech leaders expected to outperform`,
        source: "SN50 Prediction",
      });
    }

    if (pulse.btcChange24h > 5) {
      triggers.push({
        stock: "SPACELY",
        signal: "BUY",
        strength: Math.min(1, pulse.btcChange24h / 15),
        reason: "Crypto rally typically correlates with EV/ttech growth",
        source: "Correlation Analysis",
      });
    }

    if (pulse.sentiment > 70) {
      triggers.push({
        stock: "ACME",
        signal: "BUY",
        strength: Math.min(1, (pulse.sentiment - 70) / 30),
        reason: "Bullish market sentiment favors broad market exposure",
        source: "Fear & Greed Index",
      });
      triggers.push({
        stock: "OSCORP",
        signal: "BUY",
        strength: Math.min(1, (pulse.sentiment - 70) / 40),
        reason: "Consumer tech benefits from positive risk appetite",
        source: "Fear & Greed Index",
      });
    }

    if (pulse.sentiment < 30) {
      triggers.push({
        stock: "STARK",
        signal: "BUY",
        strength: Math.min(1, (30 - pulse.sentiment) / 30),
        reason: "Fear-driven markets historically favor defensive sectors",
        source: "Fear & Greed Index",
      });
    }

    return triggers;
  }

  static async generateIntelligenceItems(): Promise<IntelligenceItem[]> {
    const pulse = await this.getMarketPulse();
    const triggers = this.generateTriggers(pulse);

    const items: IntelligenceItem[] = [];

    for (const trigger of triggers) {
      const intensity = Math.round(trigger.strength * 100);
      items.push({
        id: `pulse-${trigger.stock}-${Date.now()}`,
        type: "impact",
        title: `${trigger.stock} ${trigger.signal === "BUY" ? "↑" : trigger.signal === "SELL" ? "↓" : "→"} ${trigger.signal}`,
        description: trigger.reason,
        impact: trigger.signal === "BUY" ? "positive" : trigger.signal === "SELL" ? "negative" : "neutral",
        impactAsset: trigger.stock,
        timestamp: "Live",
      });
    }

    if (pulse.warRisk > 60) {
      items.push({
        id: `alert-war-${Date.now()}`,
        type: "alert",
        title: "⚠️ Geopolitical Tension Elevated",
        description: `Global instability index at ${Math.round(pulse.warRisk)}%. Defense and safe-haven assets may outperform.`,
        impact: "neutral",
        timestamp: "Live",
      });
    }

    if (pulse.btcChange24h > 3 || pulse.btcChange24h < -3) {
      items.push({
        id: `alert-btc-${Date.now()}`,
        type: "news",
        title: `₿ Bitcoin ${pulse.btcChange24h > 0 ? " Surges " : " Plunges "}${Math.abs(pulse.btcChange24h).toFixed(1)}%`,
        description: `Crypto market ${pulse.btcChange24h > 0 ? "bull run" : "correction"} may impact correlated assets.`,
        impact: pulse.btcChange24h > 0 ? "positive" : "negative",
        timestamp: "Live",
      });
    }

    return items.sort((a, b) => {
      const priority = { alert: 0, news: 1, impact: 2 };
      return (priority[a.type] || 3) - (priority[b.type] || 3);
    });
  }
}

export const marketPulseService = MarketPulseService;

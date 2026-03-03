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

  static async getMarketPulse(): Promise<MarketPulse> {
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    const [synthBTC, synthVol, macroData] = await Promise.all([
      SynthDataService.getPredictions("BTC"),
      SynthDataService.getVolatility("BTC"),
      macroService.getMacroData(),
    ]);

    const btcPrice = synthBTC?.current_price || 67500;
    const btcChange24h = synthBTC?.["24H"]?.percentiles?.p50 || 0;
    const sentiment = synthVol?.forecast_vol ? 50 + (synthVol.forecast_vol * 100) : 50;

    const warRisk = this.calculateWarRisk(macroData.data);
    const aiMomentum = this.calculateAIMomentum(synthBTC, synthVol);
    const defenseSpending = this.calculateDefenseSpending(warRisk);
    const goldPrice = 2650;
    const goldChange24h = 0.3;

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
    };

    this.cache = { data: pulse, timestamp: Date.now() };
    return pulse;
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

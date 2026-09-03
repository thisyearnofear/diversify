/**
 * Learn-tab purchasing-power math.
 *
 * Cash erodes at the visitor's local inflation. The protected line is a
 * mix of tokens, each eroded at the inflation of its peg — except gold
 * (PAXG), which holds real purchasing power (0%). This is not a yield
 * model: USDY/USDC follow USD inflation, not a fabricated APY.
 */

import { STRATEGY_ALLOCATIONS, type AllocationSlice } from "@/components/protection-cards/plan-preview";

export interface MixSlice {
  token: string;
  percent: number;
}

export interface InflationRates {
  local: number;
  usd: number;
  eur: number;
  africa: number;
  latam: number;
  asia: number;
  europe: number;
}

export interface YearPoint {
  year: number;
  cash: number;
  protected: number;
}

const GOLD = new Set(["PAXG", "XAU", "GOLD"]);
const USD = new Set(["USDC", "USDT", "CUSD", "USDY", "SYRUPUSDC", "USDM"]);
const EUR = new Set(["EURC", "EURM", "CEUR"]);
const AFRICA = new Set(["KESM", "GHSM", "NGNM", "ZARM", "XOFM", "CXOF", "EXOF"]);
const LATAM = new Set(["BRLM", "COPM", "MXNB", "CREAL"]);
const ASIA = new Set(["PHPM", "AUDM", "JPYM"]);
const EUROPE_FX = new Set(["GBPM", "CHFM"]);

export const GOLD_MIX: MixSlice[] = [{ token: "PAXG", percent: 100 }];

export function inflationForToken(token: string, rates: InflationRates): number {
  const t = token.toUpperCase();
  if (GOLD.has(t)) return 0;
  if (USD.has(t)) return rates.usd;
  if (EUR.has(t)) return rates.eur;
  if (AFRICA.has(t)) return rates.africa;
  if (LATAM.has(t)) return rates.latam;
  if (ASIA.has(t)) return rates.asia;
  if (EUROPE_FX.has(t)) return rates.europe;
  return rates.local;
}

export function projectPurchasingPower(
  amount: number,
  annualInflationPct: number,
  years: number,
): number {
  if (amount <= 0) return 0;
  return amount * Math.pow(1 - annualInflationPct / 100, years);
}

export function projectMix(
  amount: number,
  slices: MixSlice[],
  rates: InflationRates,
  years: number,
): number {
  if (slices.length === 0) return projectPurchasingPower(amount, 0, years);
  return slices.reduce((sum, slice) => {
    const sliceAmount = amount * (slice.percent / 100);
    return sum + projectPurchasingPower(sliceAmount, inflationForToken(slice.token, rates), years);
  }, 0);
}

export function seriesFor(
  amount: number,
  slices: MixSlice[],
  rates: InflationRates,
  years: number,
): YearPoint[] {
  return Array.from({ length: years + 1 }, (_, year) => ({
    year,
    cash: projectPurchasingPower(amount, rates.local, year),
    protected: projectMix(amount, slices, rates, year),
  }));
}

export function mixForPhilosophy(philosophy: string | null | undefined): MixSlice[] {
  if (!philosophy) return GOLD_MIX;
  const direct = STRATEGY_ALLOCATIONS[philosophy] as AllocationSlice[] | undefined;
  if (direct && direct.length > 0) {
    return direct.map((s) => ({ token: s.token, percent: s.percent }));
  }
  return GOLD_MIX;
}

export function mixLabelFor(
  philosophy: string | null | undefined,
  mix: MixSlice[],
  strategyName?: string | null,
): string {
  const goldOnly = mix.length === 1 && mix[0].token === "PAXG" && mix[0].percent === 100;
  if (goldOnly || !philosophy) return "Gold";
  return strategyName?.trim() || "Your mix";
}

/** Regional inflation lookup. Caribbean has no dedicated series — imported inflation tracks LatAm, then USA. */
export function localInflationRate(
  region: string,
  ratesByRegion: Record<string, number>,
): number {
  const direct = ratesByRegion[region];
  if (typeof direct === "number") return direct;
  if (region === "Caribbean") {
    return ratesByRegion.LatAm ?? ratesByRegion.USA ?? 5;
  }
  return ratesByRegion.USA ?? 5;
}

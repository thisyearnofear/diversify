import type { Exposure } from './exposures';

export type SlicePreference = 'yield' | 'liquid';
export interface PlanSlice {
  exposure: Exposure;
  target: number;
  region: string;
  why: string;
  prefer?: SlicePreference;
}
export interface PlanRules { excludeYield?: boolean }
export interface ExposurePlan { slices: PlanSlice[]; rules: PlanRules }

/** Saved strategy baselines. Shield risk adjustments remain explicit overrides. */
export const STRATEGY_PLANS: Record<string, ExposurePlan> = {
  africapitalism: { rules: {}, slices: [
    { exposure: 'KES', target: 60, region: 'Kenya', why: 'Kenyan-shilling exposure — the regional leg of this plan' },
    { exposure: 'USD', target: 25, region: 'US', why: 'Dollar floor for the plan' },
    { exposure: 'EUR', target: 15, region: 'EU', why: 'Euro leg — a second anchor' },
  ] },
  buen_vivir: { rules: {}, slices: [
    { exposure: 'BRL', target: 45, region: 'Brazil', why: "Brazil's real — the LatAm anchor" },
    { exposure: 'COP', target: 35, region: 'Colombia', why: 'Colombian peso — the second LatAm leg' },
    { exposure: 'USD', target: 20, region: 'US', why: 'Dollar floor for the plan' },
  ] },
  pan_caribbean: { rules: {}, slices: [
    { exposure: 'USD', target: 50, region: 'US', why: 'USD-pegged core against imported inflation' },
    { exposure: 'XAU', target: 30, region: 'Global', why: 'Gold — hedge for food and fuel shocks' },
    { exposure: 'EUR', target: 20, region: 'EU', why: 'Euro leg — a second anchor' },
  ] },
  confucian: { rules: {}, slices: [
    { exposure: 'USD', target: 70, region: 'Savings core', why: 'Liquid dollar savings core' },
    { exposure: 'USD', target: 30, region: 'Treasury yield', why: 'Treasury yield, low volatility', prefer: 'yield' },
  ] },
  gotong_royong: { rules: {}, slices: [
    { exposure: 'USD', target: 50, region: 'Savings core', why: 'Liquid dollar savings core' },
    { exposure: 'PHP', target: 30, region: 'Philippines', why: 'Philippine peso — local leg' },
    { exposure: 'USD', target: 20, region: 'Treasury yield', why: 'Treasury yield, shared upside', prefer: 'yield' },
  ] },
  global: { rules: {}, slices: [
    { exposure: 'USD', target: 25, region: 'Global', why: 'Global liquid core' },
    { exposure: 'EUR', target: 20, region: 'EU', why: 'Europe' },
    { exposure: 'KES', target: 20, region: 'Kenya', why: 'Africa' },
    { exposure: 'BRL', target: 15, region: 'Brazil', why: 'Latin America' },
    { exposure: 'COP', target: 10, region: 'Colombia', why: 'Latin America — second leg' },
    { exposure: 'PHP', target: 10, region: 'Philippines', why: 'Asia' },
  ] },
  islamic: { rules: { excludeYield: true }, slices: [
    { exposure: 'XAU', target: 50, region: 'Global', why: 'Gold — asset-backed, no riba' },
    { exposure: 'USD', target: 50, region: 'US', why: 'Dollar floor, no interest' },
  ] },
};

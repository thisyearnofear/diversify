/**
 * Currency Risk Dataset — Curated multi-benchmark depreciation data.
 *
 * This is the single source of truth for the "aha" risk comparison shown
 * to first-time visitors. It provides historical depreciation of ~20
 * high-risk currencies against three benchmarks: USD (global reserve),
 * EUR (European benchmark), and XAU (gold — a common hard-asset benchmark;
 * Sharia compliance depends on asset structure and holding method).
 *
 * Three benchmarks because different protection philosophies value
 * different reference points:
 *   - Pan-Caribbean / Global Diversification → USD primary
 *   - Islamic Finance → XAU (PAXG is Sharia-compliant)
 *   - Africapitalism → shows the cost of keeping wealth local
 *   - Confucian → multi-generational stability vs all three
 *
 * This dataset is intentionally NON-PRESCRIPTIVE. It does not recommend
 * a shield percentage or a specific asset. The philosophy system
 * (StrategyService + StrategyContext) handles allocation guidance.
 *
 * Figures are approximate, based on publicly available historical FX
 * data (central bank rates, IMF, World Bank) as of mid-2025. They are
 * directionally accurate — sufficient to make the risk visceral — and
 * should be refreshed periodically from a live API.
 */

/** When this curated dataset was last reviewed — show in UX for transparency. */
export const CURRENCY_RISK_DATA_AS_OF = '2025-07-01';

export const CURRENCY_RISK_DATA_DISCLAIMER =
  'Directionally accurate curated historical data. Not live FX. Not investment advice.';

export interface RiskEvent {
  year: number;
  event: string;
  impact: string;
}

export interface CurrencyRiskEntry {
  code: string;
  countryName: string;
  iso2: string;
  iso3: string;
  flag: string;
  /** Depreciation % vs benchmark over the period. Negative = currency weakened. */
  depreciation: {
    vsUSD: { '1yr': number; '3yr': number; '5yr': number };
    vsEUR: { '1yr': number; '3yr': number; '5yr': number };
    vsXAU: { '1yr': number; '3yr': number; '5yr': number };
  };
  riskEvents: RiskEvent[];
}

/**
 * Curated dataset. Ordered roughly by 5-year depreciation severity
 * (most severe first) so iteration produces a descending risk gradient.
 */
export const CURRENCY_RISK_DATA: CurrencyRiskEntry[] = [
  {
    code: 'ARS',
    countryName: 'Argentina',
    iso2: 'AR',
    iso3: 'ARG',
    flag: '🇦🇷',
    depreciation: {
      vsUSD: { '1yr': -27, '3yr': -65, '5yr': -78 },
      vsEUR: { '1yr': -25, '3yr': -62, '5yr': -76 },
      vsXAU: { '1yr': -40, '3yr': -75, '5yr': -85 },
    },
    riskEvents: [
      { year: 2023, event: 'Emergency devaluation', impact: 'ARS dropped 54% in a single week after central bank relaxed controls' },
      { year: 2024, event: 'Milei shock therapy', impact: 'Peso devalued 50% on day one of new administration' },
    ],
  },
  {
    code: 'TRY',
    countryName: 'Turkey',
    iso2: 'TR',
    iso3: 'TUR',
    flag: '🇹🇷',
    depreciation: {
      vsUSD: { '1yr': -18, '3yr': -55, '5yr': -80 },
      vsEUR: { '1yr': -15, '3yr': -52, '5yr': -78 },
      vsXAU: { '1yr': -32, '3yr': -67, '5yr': -86 },
    },
    riskEvents: [
      { year: 2021, event: 'Erdogan rate cuts', impact: 'TRY lost 44% in a month after unorthodox rate cuts during inflation' },
      { year: 2023, event: 'Post-election volatility', impact: 'TRY hit record lows after Erdogan retained power' },
    ],
  },
  {
    code: 'EGP',
    countryName: 'Egypt',
    iso2: 'EG',
    iso3: 'EGY',
    flag: '🇪🇬',
    depreciation: {
      vsUSD: { '1yr': -10, '3yr': -50, '5yr': -68 },
      vsEUR: { '1yr': -8, '3yr': -47, '5yr': -66 },
      vsXAU: { '1yr': -25, '3yr': -63, '5yr': -78 },
    },
    riskEvents: [
      { year: 2022, event: 'IMF devaluation', impact: 'EGP devalued 15% overnight as part of IMF rescue package' },
      { year: 2024, event: 'Second devaluation', impact: 'Pound fell another 40% as FX reserves depleted' },
    ],
  },
  {
    code: 'NGN',
    countryName: 'Nigeria',
    iso2: 'NG',
    iso3: 'NGA',
    flag: '🇳🇬',
    depreciation: {
      vsUSD: { '1yr': -40, '3yr': -55, '5yr': -60 },
      vsEUR: { '1yr': -38, '3yr': -53, '5yr': -58 },
      vsXAU: { '1yr': -50, '3yr': -65, '5yr': -72 },
    },
    riskEvents: [
      { year: 2023, event: 'Tinubu unification', impact: 'Naira devalued 40% as new president floated the currency' },
      { year: 2024, event: 'Multiple FX windows', impact: 'Continued gap between official and parallel market rates' },
    ],
  },
  {
    code: 'GHS',
    countryName: 'Ghana',
    iso2: 'GH',
    iso3: 'GHA',
    flag: '🇬🇭',
    depreciation: {
      vsUSD: { '1yr': -5, '3yr': -45, '5yr': -63 },
      vsEUR: { '1yr': -3, '3yr': -42, '5yr': -61 },
      vsXAU: { '1yr': -20, '3yr': -58, '5yr': -73 },
    },
    riskEvents: [
      { year: 2022, event: 'Cedi crisis', impact: 'GHS lost 50% vs USD as inflation hit 54% — worst performer globally' },
      { year: 2022, event: 'Domestic debt exchange', impact: 'Debt restructuring wiped out bondholders while cedi continued sliding' },
    ],
  },
  {
    code: 'PKR',
    countryName: 'Pakistan',
    iso2: 'PK',
    iso3: 'PAK',
    flag: '🇵🇰',
    depreciation: {
      vsUSD: { '1yr': -3, '3yr': -35, '5yr': -46 },
      vsEUR: { '1yr': -1, '3yr': -32, '5yr': -44 },
      vsXAU: { '1yr': -18, '3yr': -50, '5yr': -60 },
    },
    riskEvents: [
      { year: 2022, event: 'Political crisis + IMF', impact: 'Rupee hit record lows as government struggled to secure IMF bailout' },
      { year: 2023, event: 'IMF bailout conditions', impact: 'Currency floated under IMF pressure, losing 20% in weeks' },
    ],
  },
  {
    code: 'LKR',
    countryName: 'Sri Lanka',
    iso2: 'LK',
    iso3: 'LKA',
    flag: '🇱🇰',
    depreciation: {
      vsUSD: { '1yr': -5, '3yr': -40, '5yr': -45 },
      vsEUR: { '1yr': -3, '3yr': -37, '5yr': -43 },
      vsXAU: { '1yr': -20, '3yr': -55, '5yr': -60 },
    },
    riskEvents: [
      { year: 2022, event: 'Sovereign default', impact: 'Sri Lanka defaulted on external debt; LKR collapsed 80% before stabilizing' },
      { year: 2022, event: 'Political collapse', impact: 'President fled the country as economy imploded' },
    ],
  },
  {
    code: 'KES',
    countryName: 'Kenya',
    iso2: 'KE',
    iso3: 'KEN',
    flag: '🇰🇪',
    depreciation: {
      vsUSD: { '1yr': -8, '3yr': -22, '5yr': -28 },
      vsEUR: { '1yr': -6, '3yr': -20, '5yr': -25 },
      vsXAU: { '1yr': -22, '3yr': -42, '5yr': -50 },
    },
    riskEvents: [
      { year: 2022, event: 'General Election', impact: 'KES dropped 6.8% in the 3 months around the election cycle' },
      { year: 2023, event: 'Eurobond maturity pressure', impact: 'KES hit record low as $2B Eurobond repayment loomed' },
      { year: 2024, event: 'Anti-government protests', impact: 'Currency volatility spiked during Gen Z protests over finance bill' },
    ],
  },
  {
    code: 'ZAR',
    countryName: 'South Africa',
    iso2: 'ZA',
    iso3: 'ZAF',
    flag: '🇿🇦',
    depreciation: {
      vsUSD: { '1yr': -4, '3yr': -15, '5yr': -22 },
      vsEUR: { '1yr': -2, '3yr': -13, '5yr': -20 },
      vsXAU: { '1yr': -18, '3yr': -35, '5yr': -45 },
    },
    riskEvents: [
      { year: 2023, event: 'Load-shedding crisis', impact: 'Record power cuts dragged ZAR to weakest level as GDP contracted' },
      { year: 2024, event: 'Election uncertainty', impact: 'ANC lost majority for first time, coalition talks weakened rand' },
    ],
  },
  {
    code: 'RUB',
    countryName: 'Russia',
    iso2: 'RU',
    iso3: 'RUS',
    flag: '🇷🇺',
    depreciation: {
      vsUSD: { '1yr': -5, '3yr': -25, '5yr': -28 },
      vsEUR: { '1yr': -3, '3yr': -22, '5yr': -25 },
      vsXAU: { '1yr': -19, '3yr': -40, '5yr': -48 },
    },
    riskEvents: [
      { year: 2022, event: 'Sanctions invasion', impact: 'RUB crashed 40% overnight after Ukraine invasion; capital controls imposed' },
      { year: 2023, event: 'Oil price cap', impact: 'Continued pressure as G7 oil price cap reduced FX inflows' },
    ],
  },
  {
    code: 'BRL',
    countryName: 'Brazil',
    iso2: 'BR',
    iso3: 'BRA',
    flag: '🇧🇷',
    depreciation: {
      vsUSD: { '1yr': -7, '3yr': -18, '5yr': -27 },
      vsEUR: { '1yr': -5, '3yr': -15, '5yr': -24 },
      vsXAU: { '1yr': -21, '3yr': -35, '5yr': -49 },
    },
    riskEvents: [
      { year: 2022, event: 'Lula vs Bolsonaro election', impact: 'BRL volatility spiked during polarized presidential race' },
      { year: 2023, event: 'Fiscal concerns', impact: "Real weakened as new government's spending plans spooked markets" },
    ],
  },
  {
    code: 'COP',
    countryName: 'Colombia',
    iso2: 'CO',
    iso3: 'COL',
    flag: '🇨🇴',
    depreciation: {
      vsUSD: { '1yr': -2, '3yr': -15, '5yr': -17 },
      vsEUR: { '1yr': 0, '3yr': -12, '5yr': -14 },
      vsXAU: { '1yr': -16, '3yr': -33, '5yr': -41 },
    },
    riskEvents: [
      { year: 2022, event: 'Petro election', impact: 'COP fell 10% as first leftist president promised tax reform' },
    ],
  },
  {
    code: 'THB',
    countryName: 'Thailand',
    iso2: 'TH',
    iso3: 'THA',
    flag: '🇹🇭',
    depreciation: {
      vsUSD: { '1yr': -4, '3yr': -12, '5yr': -17 },
      vsEUR: { '1yr': -2, '3yr': -10, '5yr': -14 },
      vsXAU: { '1yr': -18, '3yr': -30, '5yr': -41 },
    },
    riskEvents: [
      { year: 2023, event: 'Government formation deadlock', impact: 'THB weakened during months of political deadlock after election' },
    ],
  },
  {
    code: 'INR',
    countryName: 'India',
    iso2: 'IN',
    iso3: 'IND',
    flag: '🇮🇳',
    depreciation: {
      vsUSD: { '1yr': -1, '3yr': -7, '5yr': -14 },
      vsEUR: { '1yr': 1, '3yr': -5, '5yr': -11 },
      vsXAU: { '1yr': -15, '3yr': -26, '5yr': -38 },
    },
    riskEvents: [
      { year: 2022, event: 'Crude oil spike', impact: 'INR hit record low as energy import bill surged during Russia-Ukraine war' },
    ],
  },
  {
    code: 'IDR',
    countryName: 'Indonesia',
    iso2: 'ID',
    iso3: 'IDN',
    flag: '🇮🇩',
    depreciation: {
      vsUSD: { '1yr': -2, '3yr': -8, '5yr': -12 },
      vsEUR: { '1yr': 0, '3yr': -6, '5yr': -9 },
      vsXAU: { '1yr': -16, '3yr': -27, '5yr': -36 },
    },
    riskEvents: [
      { year: 2023, event: 'Rate hikes', impact: 'BI raised rates to defend IDR as global dollar strength pressured EM currencies' },
    ],
  },
  {
    code: 'PHP',
    countryName: 'Philippines',
    iso2: 'PH',
    iso3: 'PHL',
    flag: '🇵🇭',
    depreciation: {
      vsUSD: { '1yr': -2, '3yr': -8, '5yr': -11 },
      vsEUR: { '1yr': 0, '3yr': -6, '5yr': -8 },
      vsXAU: { '1yr': -16, '3yr': -26, '5yr': -35 },
    },
    riskEvents: [
      { year: 2022, event: 'Trade deficit widening', impact: 'PHP hit record low as imports outpaced exports and remittances slowed' },
    ],
  },
  {
    code: 'TZS',
    countryName: 'Tanzania',
    iso2: 'TZ',
    iso3: 'TZA',
    flag: '🇹🇿',
    depreciation: {
      vsUSD: { '1yr': -3, '3yr': -9, '5yr': -12 },
      vsEUR: { '1yr': -1, '3yr': -7, '5yr': -9 },
      vsXAU: { '1yr': -17, '3yr': -28, '5yr': -36 },
    },
    riskEvents: [
      { year: 2023, event: 'IMF program review', impact: 'Tanzanian shilling under pressure as IMF reviewed program targets' },
    ],
  },
  {
    code: 'VND',
    countryName: 'Vietnam',
    iso2: 'VN',
    iso3: 'VNM',
    flag: '🇻🇳',
    depreciation: {
      vsUSD: { '1yr': -2, '3yr': -5, '5yr': -8 },
      vsEUR: { '1yr': 0, '3yr': -3, '5yr': -5 },
      vsXAU: { '1yr': -16, '3yr': -23, '5yr': -32 },
    },
    riskEvents: [
      { year: 2022, event: 'SBV rate hikes', impact: 'State Bank of Vietnam raised rates 100bps to defend dong against USD strength' },
    ],
  },
  {
    code: 'MXN',
    countryName: 'Mexico',
    iso2: 'MX',
    iso3: 'MEX',
    flag: '🇲🇽',
    depreciation: {
      vsUSD: { '1yr': 2, '3yr': -5, '5yr': -5 },
      vsEUR: { '1yr': 4, '3yr': -3, '5yr': -2 },
      vsXAU: { '1yr': -12, '3yr': -22, '5yr': -30 },
    },
    riskEvents: [
      { year: 2024, event: 'Sheinbaum election', impact: 'MXN weakened 7% on election day as markets assessed nearshoring continuity' },
    ],
  },
  {
    code: 'UGX',
    countryName: 'Uganda',
    iso2: 'UG',
    iso3: 'UGA',
    flag: '🇺🇬',
    depreciation: {
      vsUSD: { '1yr': -1, '3yr': -4, '5yr': -3 },
      vsEUR: { '1yr': 1, '3yr': -2, '5yr': 0 },
      vsXAU: { '1yr': -15, '3yr': -21, '5yr': -28 },
    },
    riskEvents: [
      { year: 2023, event: 'Coffee export decline', impact: "UGX pressured as Uganda's largest export earner fell on global price dip" },
    ],
  },
  // ── Benchmark currencies ──────────────────────────────────────────
  // "Stable" currencies are not risk-free. Gold has outperformed all of
  // them, inflation erodes purchasing power, and political/concentration
  // risk exists everywhere. These entries ensure US/EU/UK visitors also
  // get a risk "aha" moment — the risk is just a different shape.
  {
    code: 'GBP',
    countryName: 'United Kingdom',
    iso2: 'GB',
    iso3: 'GBR',
    flag: '🇬🇧',
    depreciation: {
      vsUSD: { '1yr': -2, '3yr': -8, '5yr': -12 },
      vsEUR: { '1yr': 0, '3yr': -6, '5yr': -10 },
      vsXAU: { '1yr': -17, '3yr': -30, '5yr': -41 },
    },
    riskEvents: [
      { year: 2022, event: 'Mini-budget crisis', impact: 'GBP crashed to parity with USD after unfunded tax cuts; Bank of England intervened' },
      { year: 2024, event: 'Election + fiscal uncertainty', impact: "Pound volatility as new government's spending plans drew scrutiny" },
    ],
  },
  {
    code: 'EUR',
    countryName: 'Eurozone',
    iso2: 'DE',
    iso3: 'DEU',
    flag: '🇪🇺',
    depreciation: {
      vsUSD: { '1yr': -3, '3yr': -10, '5yr': -8 },
      vsEUR: { '1yr': 0, '3yr': 0, '5yr': 0 },
      vsXAU: { '1yr': -18, '3yr': -32, '5yr': -38 },
    },
    riskEvents: [
      { year: 2022, event: 'Energy crisis', impact: 'EUR dropped to parity with USD as energy import costs surged after Russia-Ukraine war' },
      { year: 2023, event: 'Inflation peak 9.2%', impact: 'Eurozone inflation hit record highs, eroding purchasing power across the bloc' },
    ],
  },
  {
    code: 'USD',
    countryName: 'United States',
    iso2: 'US',
    iso3: 'USA',
    flag: '🇺🇸',
    depreciation: {
      vsUSD: { '1yr': 0, '3yr': 0, '5yr': 0 },
      vsEUR: { '1yr': 3, '3yr': 10, '5yr': 8 },
      vsXAU: { '1yr': -15, '3yr': -28, '5yr': -37 },
    },
    riskEvents: [
      { year: 2022, event: 'Inflation crisis', impact: 'USD inflation hit 8% — the highest in 40 years. Purchasing power eroded significantly' },
      { year: 2023, event: 'Debt ceiling standoff', impact: 'US nearly defaulted on sovereign debt; credit rating downgraded by Fitch' },
      { year: 2024, event: 'Election volatility', impact: 'Political polarization drove uncertainty about dollar stability and fiscal policy' },
    ],
  },
];

/** Lookup by ISO2 country code (most common — from IP geolocation). */
export const CURRENCY_BY_ISO2: Record<string, CurrencyRiskEntry> = Object.fromEntries(
  CURRENCY_RISK_DATA.map((c) => [c.iso2, c]),
);

/** Lookup by ISO3 country code (used in existing inflation constants). */
export const CURRENCY_BY_ISO3: Record<string, CurrencyRiskEntry> = Object.fromEntries(
  CURRENCY_RISK_DATA.map((c) => [c.iso3, c]),
);

/** Lookup by currency code (e.g., 'KES'). */
export const CURRENCY_BY_CODE: Record<string, CurrencyRiskEntry> = Object.fromEntries(
  CURRENCY_RISK_DATA.map((c) => [c.code, c]),
);

/**
 * Get currency risk data for a country.
 * Accepts ISO2 (from IP geolocation), ISO3 (from existing constants),
 * or currency code. Returns null only if the country is not in the
 * dataset at all (e.g., a small country we don't have data for).
 *
 * Benchmark currencies (USD, EUR, GBP) ARE included — they have risk
 * in the form of gold depreciation, inflation, and political events.
 */
export function getCurrencyRisk(countryCode: string): CurrencyRiskEntry | null {
  return (
    CURRENCY_BY_ISO2[countryCode.toUpperCase()] ??
    CURRENCY_BY_ISO3[countryCode.toUpperCase()] ??
    CURRENCY_BY_CODE[countryCode.toUpperCase()] ??
    null
  );
}

/** Benchmark labels for display. */
export const BENCHMARKS = {
  USD: { code: 'USD', label: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  XAU: { code: 'XAU', label: 'Gold', symbol: '🥇', flag: '🏅' },
} as const;

export type Benchmark = keyof typeof BENCHMARKS;
export const BENCHMARK_KEYS = Object.keys(BENCHMARKS) as Benchmark[];

/** Time horizon labels for display. */
export const HORIZONS = {
  '1yr': { label: '1 year', short: '1Y' },
  '3yr': { label: '3 years', short: '3Y' },
  '5yr': { label: '5 years', short: '5Y' },
} as const;

export type Horizon = keyof typeof HORIZONS;
export const HORIZON_KEYS = Object.keys(HORIZONS) as Horizon[];

/**
 * Calculate the "preserved value" counterfactual.
 *
 * "If you had put X% into [benchmark] Y years ago, you would have
 * preserved $Z of your $principal."
 *
 * The shielded portion (shieldPercentage) is what was protected.
 * If that portion had stayed in the depreciating currency, it would
 * have lost `depreciation`% of its value. By putting it in a stable
 * benchmark instead, the user preserved that amount.
 *
 * This is a neutral calculation — it shows what *could* have been
 * preserved, without prescribing that the user should have done so.
 * The philosophy system determines the actual recommended allocation.
 */
export function calculatePreservedValue(
  principal: number,
  shieldPercentage: number,
  depreciation: number,
  horizon: Horizon,
): number {
  const shieldAmount = principal * (shieldPercentage / 100);
  const depreciationRate = Math.abs(depreciation) / 100;

  // The shielded portion would have lost this much if it had stayed
  // in the depreciating currency. By shielding it, the user preserved it.
  return shieldAmount * depreciationRate;
}

/**
 * Rounded local-currency example savings ≈ $10,000, so risk-moment
 * counterfactuals read in the visitor's own money instead of forcing
 * mental FX ("KES 1,500,000" rather than "$10,000"). Example amounts,
 * not conversions — roundness matters more than precision.
 * Generated from mid rates on 2026-07-11 (fawazahmed0 open dataset).
 */
export const EXAMPLE_SAVINGS_LOCAL: Record<string, number> = {
  ARS: 15_000_000,
  TRY: 450_000,
  EGP: 500_000,
  NGN: 15_000_000,
  GHS: 100_000,
  PKR: 3_000_000,
  LKR: 3_500_000,
  KES: 1_500_000,
  ZAR: 150_000,
  RUB: 750_000,
  BRL: 50_000,
  COP: 35_000_000,
  THB: 350_000,
  INR: 950_000,
  IDR: 200_000_000,
  PHP: 600_000,
  TZS: 25_000_000,
  VND: 250_000_000,
  MXN: 200_000,
  UGX: 35_000_000,
  GBP: 7_500,
  EUR: 8_500,
  USD: 10_000,
};

export function exampleSavingsFor(code: string): number {
  return EXAMPLE_SAVINGS_LOCAL[code] ?? 10_000;
}

/**
 * Get a summary risk label for a currency.
 * Used for color-coding and quick visual scan.
 */
export function getRiskLevel(
  entry: CurrencyRiskEntry,
  horizon: Horizon = '5yr',
): 'critical' | 'high' | 'moderate' | 'low' {
  const dep = Math.abs(entry.depreciation.vsUSD[horizon]);
  if (dep >= 50) return 'critical';
  if (dep >= 25) return 'high';
  if (dep >= 10) return 'moderate';
  return 'low';
}

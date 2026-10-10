/**
 * Sovereign debt — the meme-scale dataset behind the planned /debt/[code]
 * corridor pages: defaults, restructurings, bailouts and the dates that
 * made them stories.
 *
 * Curated and dated by hand — same discipline as token-provenance:
 * never generated at runtime, a plausible-but-wrong line is worse than
 * no line, a country with no entry renders nothing. Facts are phrased
 * as events with dates ("defaulted on a $42.5m coupon"), never as
 * verdicts or forecasts. Re-verify each entry by its `asOf` + 90 days.
 *
 * Sources are named with dates, not linked — verify and attach urls
 * before any surface ships (the counsel-gated thesis pages depend on
 * this staying defensible).
 */

export interface SovereignDebtEvent {
  /** ISO date (YYYY-MM-DD) or bare year — always shown to the user. */
  date: string;
  kind:
    | 'default' // missed payment / declared moratorium
    | 'restructuring' // bond/domestic exchange agreed or completed
    | 'program' // IMF or equivalent facility
    | 'relief' // write-down / buyback / aid
    | 'signal'; // a dated moment the corridor talks about
  /** One factual sentence — the stamp line on a /debt card. */
  text: string;
  /** Named publication/body + publication window. No fabricated urls. */
  source: { name: string; url?: string };
}

export interface SovereignDebtEntry {
  /** ISO-2 country code — the /debt/[code] key. */
  code: string;
  country: string;
  flag: string;
  /** One-line state of play, dated by `asOf`. */
  status: string;
  events: SovereignDebtEvent[];
  /** Date this entry was last verified against sources (YYYY-MM-DD). */
  asOf: string;
}

export const SOVEREIGN_DEBT: Record<string, SovereignDebtEntry> = {
  GH: {
    code: 'GH',
    country: 'Ghana',
    flag: '🇬🇭',
    status:
      'Restructured: external commercial debt exchanged, IMF programme running',
    events: [
      {
        date: '2022-12',
        kind: 'default',
        text: 'Ghana suspended payments on most external debt — the cedi crisis became a sovereign default.',
        source: { name: 'Reuters / Ministry of Finance statement', url: undefined },
      },
      {
        date: '2023-05',
        kind: 'program',
        text: 'IMF approved a $3bn Extended Credit Facility after the Domestic Debt Exchange completed.',
        source: { name: 'IMF press release' },
      },
      {
        date: '2024-10',
        kind: 'restructuring',
        text: 'Ghana completed its ~$13bn Eurobond exchange — the restructuring that ended the default.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  ZM: {
    code: 'ZM',
    country: 'Zambia',
    flag: '🇿🇲',
    status:
      'First pandemic-era African default — restructuring completed 2024',
    events: [
      {
        date: '2020-11',
        kind: 'default',
        text: 'Zambia missed a $42.5m Eurobond coupon — Africa’s first pandemic-era sovereign default.',
        source: { name: 'Reuters' },
      },
      {
        date: '2023-10',
        kind: 'restructuring',
        text: 'Bondholders agreed terms on ~$3bn of Eurobonds after three years of talks.',
        source: { name: 'Reuters' },
      },
      {
        date: '2024-06',
        kind: 'restructuring',
        text: 'The ~$13.3bn external restructuring closed — bonds exchanged, arrears cleared.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  LK: {
    code: 'LK',
    country: 'Sri Lanka',
    flag: '🇱🇰',
    status: 'First-ever default in 2022 — bond restructuring completed 2024',
    events: [
      {
        date: '2022-04',
        kind: 'default',
        text: 'Sri Lanka announced it could not service foreign debt — its first sovereign default.',
        source: { name: 'Reuters' },
      },
      {
        date: '2023-03',
        kind: 'program',
        text: 'IMF approved a ~$3bn programme to anchor the recovery.',
        source: { name: 'IMF press release' },
      },
      {
        date: '2024-09',
        kind: 'restructuring',
        text: 'Sri Lanka completed the ~$12.6bn sovereign bond restructuring.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  AR: {
    code: 'AR',
    country: 'Argentina',
    flag: '🇦🇷',
    status: 'Nine defaults since independence — restructuring cadence is the story',
    events: [
      {
        date: '2020-05',
        kind: 'default',
        text: 'Argentina defaulted for the ninth time — ~$500m of interest missed on foreign-law bonds.',
        source: { name: 'Reuters' },
      },
      {
        date: '2020-08',
        kind: 'restructuring',
        text: 'Creditors accepted a restructuring of ~$65bn of foreign bonds.',
        source: { name: 'Reuters' },
      },
      {
        date: '2022-03',
        kind: 'program',
        text: 'IMF approved a ~$44bn Extended Fund Facility — the fund’s largest programme.',
        source: { name: 'IMF press release' },
      },
    ],
    asOf: '2026-10-10',
  },
  LB: {
    code: 'LB',
    country: 'Lebanon',
    flag: '🇱🇧',
    status: 'Defaulted 2020 — still unresolved',
    events: [
      {
        date: '2020-03',
        kind: 'default',
        text: 'Lebanon defaulted on a $1.2bn Eurobond — the state announced it could no longer pay.',
        source: { name: 'Reuters' },
      },
      {
        date: '2022-04',
        kind: 'program',
        text: 'IMF staff-level agreement on ~$3bn reached — Board approval still pending, the default unresolved years on.',
        source: { name: 'IMF press release' },
      },
    ],
    asOf: '2026-10-10',
  },
  NG: {
    code: 'NG',
    country: 'Nigeria',
    flag: '🇳🇬',
    status: 'No default — the strain metric is debt service vs revenue',
    events: [
      {
        date: '2023',
        kind: 'signal',
        text: 'Debt service consumed roughly all of federal revenue in 2022 — the statistic that frames Nigeria’s fiscal story.',
        source: { name: 'BudgIT analysis of federal accounts' },
      },
      {
        date: '2024-09',
        kind: 'signal',
        text: 'Nigeria’s first Eurobond in two years priced oversubscribed — markets reopened post-reform.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  EG: {
    code: 'EG',
    country: 'Egypt',
    flag: '🇪🇬',
    status: 'Rescued by record-scale bilateral support + expanded IMF programme',
    events: [
      {
        date: '2024-02',
        kind: 'relief',
        text: 'The UAE’s ~$35bn Ras El-Hekma deal — the largest inward investment Egypt has recorded.',
        source: { name: 'Reuters' },
      },
      {
        date: '2024-03',
        kind: 'program',
        text: 'IMF expanded Egypt’s programme to ~$8bn alongside a looser currency.',
        source: { name: 'IMF press release' },
      },
    ],
    asOf: '2026-10-10',
  },
  KE: {
    code: 'KE',
    country: 'Kenya',
    flag: '🇰🇪',
    status: 'No default — buybacks and protest politics around each Eurobond wall',
    events: [
      {
        date: '2024-02',
        kind: 'relief',
        text: 'Kenya bought back most of its June-2024 Eurobond with a new issue — the maturity wall that had markets watching passed.',
        source: { name: 'Reuters' },
      },
      {
        date: '2024-06',
        kind: 'signal',
        text: 'The Finance Bill was withdrawn after street protests — tax-versus-debt-service politics went live.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  SV: {
    code: 'SV',
    country: 'El Salvador',
    flag: '🇸🇻',
    status: 'Buybacks + IMF programme — the bitcoin experiment got priced',
    events: [
      {
        date: '2021-09',
        kind: 'signal',
        text: 'El Salvador made bitcoin legal tender — the sovereign that put a currency bet on-chain.',
        source: { name: 'Reuters' },
      },
      {
        date: '2025-01',
        kind: 'program',
        text: 'IMF agreed a ~$1.4bn programme that scaled back the state’s bitcoin role — the experiment met the fund.',
        source: { name: 'IMF press release' },
      },
    ],
    asOf: '2026-10-10',
  },
  PK: {
    code: 'PK',
    country: 'Pakistan',
    flag: '🇵🇰',
    status: 'Serial IMF programmes — near-default averted 2023',
    events: [
      {
        date: '2023-06',
        kind: 'program',
        text: 'IMF approved a ~$3bn stand-by arrangement days before reserves ran out.',
        source: { name: 'IMF press release' },
      },
      {
        date: '2024-09',
        kind: 'program',
        text: 'A ~$7bn Extended Fund Facility followed — the 24th IMF programme in Pakistan’s history.',
        source: { name: 'IMF press release' },
      },
    ],
    asOf: '2026-10-10',
  },
  ET: {
    code: 'ET',
    country: 'Ethiopia',
    flag: '🇪🇹',
    status: 'Defaulted 2023 — restructuring in progress',
    events: [
      {
        date: '2023-12',
        kind: 'default',
        text: 'Ethiopia missed a ~$33m Eurobond coupon — default after a two-year grace period expired.',
        source: { name: 'Reuters' },
      },
      {
        date: '2025-01',
        kind: 'restructuring',
        text: 'Bondholders reached an agreement-in-principle on the ~$1bn Eurobond restructuring.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
  SR: {
    code: 'SR',
    country: 'Suriname',
    flag: '🇸🇷',
    status: 'Defaulted 2020 — restructured with oil-linked recovery bonds',
    events: [
      {
        date: '2020-12',
        kind: 'default',
        text: 'Suriname missed payments and entered default — the fourth in its post-independence history.',
        source: { name: 'Reuters' },
      },
      {
        date: '2023-05',
        kind: 'restructuring',
        text: 'Creditors accepted a restructuring that pays more if offshore oil delivers — debt terms tied to a discovery.',
        source: { name: 'Reuters' },
      },
    ],
    asOf: '2026-10-10',
  },
};

/** The curated debt story for a /debt/[code] key — null renders nothing. */
export function sovereignDebtFor(
  code: string | null | undefined,
): SovereignDebtEntry | null {
  if (!code) return null;
  return SOVEREIGN_DEBT[code.toUpperCase()] ?? null;
}

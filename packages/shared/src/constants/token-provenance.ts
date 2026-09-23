/**
 * Token provenance — where a token's money comes from and who holds the keys.
 *
 * Curated, sourced and dated by hand. Never generated at runtime: these are
 * claims about issuers, reserves and governance, and a plausible-but-wrong
 * line is worse than no line. A token without an entry renders nothing.
 *
 * Every entry answers the same three questions so the grammar is learned once:
 *   origin  — the place and the authority behind the underlying money
 *   backing — what holds the token's value, and who issues it
 *   keys    — who can change the rules or stop a transfer
 * Facts, not verdicts. Re-verify each entry by its `asOf` + 90 days.
 */

export interface TokenProvenance {
  symbol: string;
  /** Short noun phrase for the ticket sentence: "from {phrase} to {phrase}". */
  phrase: string;
  origin: {
    flag: string;
    place: string;
    authority: string;
    regime: string;
  };
  issuer: string;
  backing: string;
  keys: string;
  /** One dated beat from the place's monetary story. */
  moment?: { year: number; text: string };
  sources: Array<{ label: string; url: string }>;
  /** Date the entry was last checked against its sources (YYYY-MM-DD). */
  asOf: string;
}

const MENTO_RESERVE_BACKING =
  'Mento Reserve on Celo: a diversified on-chain reserve, over-collateralised at 1.42× on 2026-09-23';
const MENTO_CDP_BACKING =
  'Minted as a loan against USDm deposits in Mento\u2019s CDP system, over-collateralised at about 2\u00d7 on 2026-09-23';
const MENTO_KEYS =
  'No address freeze in the token contract; MENTO token holders govern the contracts by vote';
const MENTO_SOURCES = [
  { label: 'Mento Reserve', url: 'https://reserve.mento.org/' },
  { label: 'CGP-156: Mento governance handover', url: 'https://mondo.celo.org/governance/cgp-156' },
  {
    label: 'StableTokenV2 source',
    url: 'https://github.com/mento-protocol/mento-core/blob/develop/contracts/tokens/StableTokenV2.sol',
  },
];

export const TOKEN_PROVENANCE: TokenProvenance[] = [
  {
    symbol: 'KESm',
    phrase: "Kenya's floating shilling",
    origin: {
      flag: '🇰🇪',
      place: 'Kenya',
      authority: 'Central Bank of Kenya',
      regime: 'Floating shilling, priced in the interbank market',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2024,
      text: 'The shilling hit a record low near KSh 161 per dollar in January, then rallied about 20% after a Eurobond buyback',
    },
    sources: [
      ...MENTO_SOURCES,
      {
        label: 'Business Daily: how CBK pulled the shilling back',
        url: 'https://www.businessdailyafrica.com/bd/economy/kamau-thugge-how-we-pulled-the-shilling-back-from-the-brink--4668682',
      },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'XOFm',
    phrase: 'the euro-pegged CFA franc',
    origin: {
      flag: '🌍',
      place: 'West African Monetary Union (8 countries)',
      authority: 'BCEAO, the Central Bank of West African States',
      regime: 'Pegged at €1 = 655.957 CFA francs; France guarantees convertibility',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2019,
      text: 'A reform ended the rule to hold reserves at the French Treasury and withdrew French representatives from BCEAO bodies; the euro peg and guarantee stayed',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'BCEAO: CFA franc reform communiqué', url: 'https://bceao.int/fr/communique-presse/communique-de-presse-reforme-du-franc-cfa' },
      { label: 'Banque de France: Africa-France partnerships', url: 'https://www.banque-france.fr/en/banque-de-france/africa-france-partnerships' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'BRLm',
    phrase: "Brazil's floating real",
    origin: {
      flag: '🇧🇷',
      place: 'Brazil',
      authority: 'Banco Central do Brasil',
      regime: 'Floating real; the National Monetary Council sets the inflation target',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2021,
      text: 'Complementary Law 179 made the central bank formally autonomous, with fixed terms for its board',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'Complementary Law 179/2021', url: 'https://www.bcb.gov.br/content/about/legislation_norms_docs/complementary_law_179_24february2021.pdf' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'GHSm',
    phrase: "Ghana's cedi",
    origin: {
      flag: '🇬🇭',
      place: 'Ghana',
      authority: 'Bank of Ghana',
      regime: 'Operational independence under inflation targeting (8% ± 2)',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2025,
      text: 'The cedi appreciated about 24% against the dollar by May after the 2022 debt crisis drove record depreciation and 54% inflation',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'BoG Monetary Policy Report, Nov 2022', url: 'https://www.bog.gov.gh/wp-content/uploads/2022/12/Monetary-Policy-Report-November-2022.pdf' },
      { label: 'BoG governor on the 2025 appreciation', url: 'https://www.adomonline.com/bank-of-ghana-has-no-target-rate-for-cedi-appreciation-governor-asiama/' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'COPm',
    phrase: "Colombia's floating peso",
    origin: {
      flag: '🇨🇴',
      place: 'Colombia',
      authority: 'Banco de la República',
      regime: 'Floating peso with inflation targeting since 1999; occasional FX interventions',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2022,
      text: 'The peso depreciated sharply between late 2021 and early 2023 as volatility and the sovereign risk premium rose',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'Banco de la República: FX intervention history', url: 'https://www.banrep.gov.co/en/publicaciones-investigaciones/espe/impact-foreign-exchange-intervention-and-duration' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'PHPm',
    phrase: "the Philippines' floating peso",
    origin: {
      flag: '🇵🇭',
      place: 'Philippines',
      authority: 'Bangko Sentral ng Pilipinas',
      regime: 'Floating peso; the government sets the inflation target, BSP runs policy (3% ± 1 for 2025–28)',
    },
    issuer: 'Mento',
    backing: MENTO_RESERVE_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 1993,
      text: 'The New Central Bank Act created an independent BSP with price stability as its primary objective',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'RA 7653, the New Central Bank Act', url: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/2027' },
      { label: 'BSP Monetary Policy Report, Aug 2025', url: 'https://www.bsp.gov.ph/Price%20Stability/MonetaryPolicyReport/FullReport_August2025.pdf' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'EURm',
    phrase: 'the euro',
    origin: {
      flag: '🇪🇺',
      place: 'Euro area (20 countries)',
      authority: 'European Central Bank',
      regime: 'Treaty-level independence (TFEU 130); a 2% inflation target',
    },
    issuer: 'Mento',
    backing: 'Mento Reserve on Celo, holding euro stablecoins such as EUROC',
    keys: MENTO_KEYS,
    moment: {
      year: 1999,
      text: 'The euro launched as a single currency with the ECB\u2019s independence written into the treaty',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'TFEU Article 130 (ECB independence)', url: 'https://eur-lex.europa.eu/eli/treaty/tfeu_2008/art_130/oj/eng' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'GBPm',
    phrase: "Britain's pound",
    origin: {
      flag: '🇬🇧',
      place: 'United Kingdom',
      authority: 'Bank of England',
      regime: 'Operationally independent since 1997; the government sets the 2% inflation target',
    },
    issuer: 'Mento',
    backing: MENTO_CDP_BACKING,
    keys: MENTO_KEYS,
    moment: {
      year: 2022,
      text: 'The Bank of England stepped in with up to £65bn of gilt purchases after the mini-budget, days after the pound hit a 31-year low',
    },
    sources: [
      ...MENTO_SOURCES,
      { label: 'BoE: how the Bank is independent', url: 'https://www.bankofengland.co.uk/explainers/how-is-the-bank-of-england-independent-of-the-government' },
      { label: 'BoE letter on the gilt intervention', url: 'https://www.the-independent.com/independentpremium/uk-news/bank-of-england-pension-budget-kwarteng-b2198075.html' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'USDm',
    phrase: "Mento's reserve-backed dollar",
    origin: {
      flag: '🇺🇸',
      place: 'United States',
      authority: 'US Federal Reserve',
      regime: 'Floating world reserve currency',
    },
    issuer: 'Mento',
    backing: 'Mento Reserve on Celo, holding dollar stablecoins such as USDC, USDT and USDS',
    keys: MENTO_KEYS,
    sources: [
      ...MENTO_SOURCES,
      { label: 'Mento docs: the Reserve', url: 'https://docs.mento.org/mento-v3/dive-deeper/the-reserve.md' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'USDC',
    phrase: "Circle's cash-and-Treasuries dollar",
    origin: {
      flag: '🇺🇸',
      place: 'United States',
      authority: 'US Federal Reserve',
      regime: 'Floating world reserve currency',
    },
    issuer: 'Circle',
    backing: 'Cash and short-dated US Treasuries, mostly in a BlackRock-managed money market fund; monthly Big Four assurance',
    keys: 'Circle can freeze addresses',
    sources: [{ label: 'Circle transparency', url: 'https://www.circle.com/transparency' }],
    asOf: '2026-09-23',
  },
  {
    symbol: 'USDY',
    phrase: "Ondo's Treasury-backed note",
    origin: {
      flag: '🇺🇸',
      place: 'United States',
      authority: 'US Federal Reserve',
      regime: 'Floating world reserve currency',
    },
    issuer: 'Ondo Global Markets (BVI)',
    backing: 'Short-term US Treasuries, Treasury ETF shares or bank deposits; yield accrues daily',
    keys: 'Non-US persons only; Ondo controls the transfer allowlist',
    sources: [
      { label: 'Ondo docs: USDY basics', url: 'https://docs.ondo.finance/general-access-products/usdy/basics' },
      { label: 'Ondo docs: important notes', url: 'https://docs.ondo.finance/general-access-products/usdy/important-notes' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'SYRUPUSDC',
    phrase: "Maple's institutional-loan dollar",
    origin: {
      flag: '🇺🇸',
      place: 'United States dollar',
      authority: 'Maple Finance',
      regime: 'DeFi credit, not fiat; yield comes from borrower interest',
    },
    issuer: 'Maple Finance',
    backing: 'A share of Maple\u2019s pool of fixed-rate, overcollateralised loans to crypto institutions; yield accrues into the token',
    keys: 'Staked SYRUP holders vote on Maple Improvement Proposals; loans carry credit risk and Circle does not guarantee the token',
    moment: {
      year: 2024,
      text: 'Maple expanded syrupUSDC from its institutional pools into general DeFi with dedicated segregated portfolios',
    },
    sources: [
      { label: 'Maple docs: syrupUSDC for lenders', url: 'https://docs.maple.finance/syrupusdc-usdt-usdg-for-lenders/introduction' },
      { label: 'Maple docs: FAQ', url: 'https://docs.maple.finance/syrupusdc-usdt-usdg-for-lenders/faq' },
    ],
    asOf: '2026-09-23',
  },
  {
    symbol: 'PAXG',
    phrase: 'allocated gold in a London vault',
    origin: {
      flag: '🥇',
      place: 'London',
      authority: 'LBMA Good Delivery standard',
      regime: 'Priced at the gold market, no central bank',
    },
    issuer: 'Paxos Trust Company',
    backing: 'One fine troy ounce of London Good Delivery gold per token, in LBMA-approved vaults; monthly attestation',
    keys: 'Paxos can freeze addresses; redeemable through Paxos for bars or dollars',
    sources: [
      { label: 'Paxos docs: PAXG overview', url: 'https://docs.paxos.com/guides/stablecoin/paxg' },
      { label: 'PAXG attestations', url: 'https://www.paxos.com/paxg-transparency' },
    ],
    asOf: '2026-09-23',
  },
];

const BY_SYMBOL = new Map(TOKEN_PROVENANCE.map((p) => [p.symbol.toLowerCase(), p]));

/** Case-insensitive lookup; null when the token has no curated entry. */
export function provenanceFor(symbol: string | null | undefined): TokenProvenance | null {
  if (!symbol) return null;
  return BY_SYMBOL.get(symbol.toLowerCase()) ?? null;
}

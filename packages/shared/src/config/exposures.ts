/**
 * Exposure registry — what a token's value is tied to, independent of
 * ticker or chain.
 *
 * Derived from TOKEN_METADATA + NETWORK_TOKENS: one Instrument per
 * (symbol, chain). USDC on Arbitrum and USDm on Celo are both `USD`; PAXG is
 * `XAU` and executable, Hyperliquid GOLD is `XAU` but tracked-only (a
 * synthetic perp — counted if held, never recommended).
 *
 * Pure static data, no network calls. docs/exposure-plans.md § Model.
 */
import { NETWORK_TOKENS, NETWORKS, TOKEN_METADATA, isTestnetChain } from './index';
import { getSwapExecutableChainIds } from './chain-capabilities';

export type Exposure =
  | 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'JPY'
  | 'KES' | 'GHS' | 'NGN' | 'ZAR' | 'XOF'
  | 'BRL' | 'COP' | 'MXN' | 'PHP'
  | 'XAU' | 'XAG' | 'US_EQUITY';

export const EXPOSURE_LABELS: Record<Exposure, string> = {
  USD: 'Dollar',
  EUR: 'Euro',
  GBP: 'Pound',
  CHF: 'Swiss franc',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
  JPY: 'Yen',
  KES: 'Shilling',
  GHS: 'Cedi',
  NGN: 'Naira',
  ZAR: 'Rand',
  XOF: 'CFA franc',
  BRL: 'Real',
  COP: 'Colombian peso',
  MXN: 'Mexican peso',
  PHP: 'Philippine peso',
  XAU: 'Gold',
  XAG: 'Silver',
  US_EQUITY: 'US stocks',
};

const FIAT_CODES = new Set<Exposure>([
  'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'KES', 'GHS', 'NGN', 'ZAR', 'XOF',
  'BRL', 'COP', 'MXN', 'PHP',
]);

/** Legacy / wallet-facing Mento names → config ticker. */
const LEGACY_SYMBOLS: Record<string, string> = {
  cUSD: 'USDm',
  cEUR: 'EURm',
  cREAL: 'BRLm',
  cKES: 'KESm',
  cCOP: 'COPm',
  cPHP: 'PHPm',
};

const EXPLICIT_EXPOSURE: Record<string, Exposure> = {
  USDC: 'USD',
  USDT: 'USD',
  USDG: 'USD',
  USDY: 'USD',
  SYRUPUSDC: 'USD',
  SGOV: 'USD',
  EURC: 'EUR',
  MXNB: 'MXN',
  PAXG: 'XAU',
  GOLD: 'XAU',
  SILVER: 'XAG',
  SLV: 'XAG',
  AAPL: 'US_EQUITY',
  AMD: 'US_EQUITY',
  AMZN: 'US_EQUITY',
  COIN: 'US_EQUITY',
  GOOGL: 'US_EQUITY',
  META: 'US_EQUITY',
  MSFT: 'US_EQUITY',
  NVDA: 'US_EQUITY',
  TSLA: 'US_EQUITY',
  QQQ: 'US_EQUITY',
  SPY: 'US_EQUITY',
};

const ISSUERS: Record<string, string> = {
  USDC: 'Circle',
  EURC: 'Circle',
  USDT: 'Tether',
  USDG: 'Paxos (Global Dollar)',
  PAXG: 'Paxos',
  USDY: 'Ondo',
  SYRUPUSDC: 'Maple',
  MXNB: 'Bitso',
  GOLD: 'Hyperliquid perp',
  SILVER: 'Hyperliquid perp',
};

const SYMBOL_BY_LOWER: Record<string, string> = Object.fromEntries(
  [...Object.keys(TOKEN_METADATA), ...Object.keys(LEGACY_SYMBOLS)].map((s) => [s.toLowerCase(), s]),
);

function configSymbol(symbol: string): string {
  const known = SYMBOL_BY_LOWER[symbol.toLowerCase()] ?? symbol;
  return LEGACY_SYMBOLS[known] ?? known;
}

/** Exposure of a token symbol (any alias, any case), or null when it isn't a currency/metal/equity. */
export function exposureOf(symbol: string | null | undefined): Exposure | null {
  if (!symbol) return null;
  const s = configSymbol(symbol);
  const explicit = EXPLICIT_EXPOSURE[s];
  if (explicit) return explicit;
  const mento = /^([A-Z]{3})m$/.exec(s);
  if (mento && FIAT_CODES.has(mento[1] as Exposure)) return mento[1] as Exposure;
  return null;
}

/** Earns yield by construction (TOKEN_METADATA apy > 0). */
export function isYieldBearing(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  return (TOKEN_METADATA[configSymbol(symbol)]?.apy ?? 0) > 0;
}

export function exposureLabel(exposure: Exposure): string {
  return EXPOSURE_LABELS[exposure];
}

export interface Instrument {
  symbol: string;
  exposure: Exposure;
  chainId: number;
  testnet: boolean;
  /** The in-app swap rail can buy it here (mainnet executable chain). */
  executable: boolean;
  /** Counted when held, never recommended. */
  trackedOnly: boolean;
  yieldBearing: boolean;
  issuer?: string;
}

const HYPERLIQUID = NETWORKS.HYPERLIQUID.chainId;

function buildInstruments(): Instrument[] {
  const executableChains = new Set(getSwapExecutableChainIds());
  const out: Instrument[] = [];
  for (const [chainKey, symbols] of Object.entries(NETWORK_TOKENS)) {
    const chainId = Number(chainKey);
    const testnet = isTestnetChain(chainId);
    for (const symbol of symbols) {
      const exposure = exposureOf(symbol);
      if (!exposure) continue;
      const executable = !testnet && chainId !== HYPERLIQUID && executableChains.has(chainId);
      out.push({
        symbol,
        exposure,
        chainId,
        testnet,
        executable,
        trackedOnly: !executable,
        yieldBearing: isYieldBearing(symbol),
        ...(ISSUERS[symbol] ? { issuer: ISSUERS[symbol] } : {}),
      });
    }
  }
  return out;
}

export const INSTRUMENTS: readonly Instrument[] = buildInstruments();

/** Instruments carrying an exposure, optionally executable-only. */
export function instrumentsFor(
  exposure: Exposure,
  opts: { executableOnly?: boolean } = {},
): Instrument[] {
  return INSTRUMENTS.filter(
    (i) => i.exposure === exposure && (!opts.executableOnly || i.executable),
  );
}

/** Registry entry for a symbol on a chain, if listed. */
export function instrumentOn(symbol: string, chainId: number): Instrument | undefined {
  const s = configSymbol(symbol);
  return INSTRUMENTS.find((i) => i.chainId === chainId && i.symbol === s);
}

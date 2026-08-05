/**
 * FX Netting — Intent types for the multi-region FX coordination layer.
 *
 * A participant posts an FX intent: "I need to convert BBD → JMD" (Caribbean)
 * or "GHS → NGN" (Africa). The matching engine (./matching-engine.ts) finds
 * opposing or complementary intents — a counterparty who needs the inverse —
 * and nets them so the pair settles directly, without routing through USD
 * as a bridge currency. This is graph-based clearing (cf. Keynes's bancor,
 * Slovenia's TETRIS, Sardex's mutual credit): cycles of obligation are
 * extinguished at mid-market, leaving only residuals for external settlement.
 *
 * This mirrors the existing PurchaseCycle model (working-capital payment
 * intent) and the fx-drag/calc.ts convention: pure data types here, pure
 * functions + injected rate provider in the engine, I/O in the API route.
 *
 * Design note: for regions without a native onchain stabletoken (Caribbean,
 * most of Africa), settlement happens in USD-pegged stablecoins (cUSD/USDC on
 * Celo), and net obligations are denominated in the settlement currency, not
 * the original local currencies. The matching itself is currency-agnostic —
 * any pair with a mid-market rate can be matched and netted.
 */

/** ISO 4217 currency code (e.g. 'BBD', 'JMD'). */
export type CurrencyCode = string;

/**
 * A single participant's declared FX need. Two intents "match" when one
 * sells what the other buys (BBD→JMD meets JMD→BBD). Partial matches are
 * allowed — the engine matches the overlapping amount and leaves residuals
 * open for the next cycle or fallback to external rails.
 */
export interface FxIntent {
  /** Stable unique id (caller-assigned — the API uses a ULID/cuid). */
  intentId: string;
  /** Wallet address of the participant (Self-verified for KYC provenance). */
  participantId: string;
  /** Currency the participant is selling (has, wants to convert away). */
  sellCurrency: CurrencyCode;
  /** Amount of sellCurrency, in major units (e.g. 20000 = 20,000 BBD). */
  sellAmount: number;
  /** Currency the participant wants to receive. */
  buyCurrency: CurrencyCode;
  /** Minimum acceptable buyAmount; null = accept mid-market. */
  buyAmountMin: number | null;
  /** Epoch-ms deadline; 0 = no expiry. The engine ignores expired intents. */
  deadline: number;
  /** What's left to match — mutated by the engine as partial matches fill. */
  remainingSell: number;
  status: IntentStatus;
  createdAt: number;
}

export type IntentStatus = 'open' | 'matched' | 'partially_matched' | 'settled' | 'expired' | 'cancelled';

/**
 * A pairwise match between two opposing intents. The settled rate is
 * mid-market (no spread) — the entire value proposition vs traditional
 * corridors that charge 7–9%.
 */
export interface FxMatch {
  matchId: string;
  /** The intent selling buyCurrency / buying sellCurrency. */
  intentA: FxIntent;
  /** The intent selling sellCurrency / buying buyCurrency. */
  intentB: FxIntent;
  /** Amount of intentA's sellCurrency that was matched. */
  matchedAmount: number;
  /** Mid-market rate: units of intentB.buyCurrency per 1 intentA.sellCurrency. */
  rate: number;
  /** What this match saved vs the traditional bank corridor (basis points). */
  savingsBps: number;
  /** USD notional of the matched amount (for reporting). */
  notionalUsd: number;
}

/**
 * A net obligation between two participants after netting all matched flows.
 * Denominated in the settlement currency (USD-pegged stablecoin) because no
 * native Caribbean stabletoken exists — both sides' local-currency amounts
 * are converted to cUSD/USDC at the matched mid-market rate.
 */
export interface NetObligation {
  fromParticipant: string;
  toParticipant: string;
  /** Settlement currency (e.g. 'cUSD', 'USDC'). */
  settlementCurrency: string;
  /** Net amount in settlement currency, major units. */
  netAmount: number;
  /** The matches that collapsed into this net obligation (for audit). */
  sourceMatchIds: string[];
}

/**
 * Rate quote: how many units of `quote` per 1 unit of `base`.
 * Injected by the caller (the API route uses the same rate provider as
 * fx-drag — rates-serverless.ts — so both systems agree on mid-market).
 */
export type MidRateFn = (base: CurrencyCode, quote: CurrencyCode) => number;

/** Traditional corridor cost (spread + fees) in basis points, for savings calc. */
export const DEFAULT_CORRIDOR_COST_BPS = 700; // 7% — Caribbean remittance/FX avg

/** A result bundle from running the full matching + netting pipeline. */
export interface NettingResult {
  matches: FxMatch[];
  netObligations: NetObligation[];
  unmatchedIntents: FxIntent[];
  totalMatchedUsd: number;
  totalSavingsUsd: number;
}

/**
 * Representative Stellar payloads for Developer A's tests and the marked
 * developer preview. Public and demo builds use the real adapter or show
 * unavailable. These objects are not a simulated receipt.
 *
 * Field names are the contract. Do not invent values the fixture omits.
 */

import {
  STELLAR_TESTNET,
  STELLAR_TESTNET_USDC_ISSUER,
  stellarNativeAsset,
  stellarTestnetUsdc,
  type PreparedStellarTransaction,
  type StellarAccountState,
  type StellarCapabilities,
  type StellarQuote,
  type StellarSettlement,
} from "@diversifi/shared/src/types/stellar";

export const FIXTURE_ACCOUNT = "GBJ52E7FRWATGDIDBMVUBSMKU7PXXPR65KR62TRSLUHSCYR5RBK7B6ML";
export const FIXTURE_RECIPIENT = "GDUU33Q5TYYKF3O2YELQS4LKQDGI6WWVD5V4TN2XK3235NE5C2OAQCCP";
export const FIXTURE_TX_HASH = "ab".repeat(32);

const observedAt = "2026-10-25T18:00:00.000Z";
const expiresAt = "2026-10-25T18:01:00.000Z";

export const notConnected: StellarCapabilities = {
  network: STELLAR_TESTNET,
  wallet: "freighter",
  accountKind: "classic",
  enabled: true,
  canQuote: false,
  canSign: false,
  canSubmit: false,
  autonomy: false,
  reasoningEvidence: "none",
};

export const disabled: StellarCapabilities = { ...notConnected, enabled: false };

/** Funded classic account with a USDC trustline. 10 XLM total, 3 XLM reserved, 100 stroops held for the fee. */
export const readyAccount: StellarAccountState = {
  network: STELLAR_TESTNET,
  account: FIXTURE_ACCOUNT,
  accountKind: "classic",
  exists: true,
  subentryCount: 1,
  reserveStroops: "30000000",
  balances: [
    {
      asset: stellarNativeAsset(),
      balanceUnits: "100000000",
      spendableUnits: "69999900",
      authorized: true,
    },
    {
      asset: stellarTestnetUsdc(),
      balanceUnits: "0",
      spendableUnits: "0",
      authorized: true,
    },
  ],
  issues: [],
  observedLedger: 1,
  observedAt,
};

export const trustlineRequired: StellarAccountState = {
  ...readyAccount,
  subentryCount: 0,
  reserveStroops: "20000000",
  balances: [readyAccount.balances[0]],
  issues: ["trustline_required"],
};

export const quote: StellarQuote = {
  id: "quote-fixture-1",
  revision: 1,
  network: STELLAR_TESTNET,
  account: FIXTURE_ACCOUNT,
  kind: "path-payment-strict-send",
  destination: FIXTURE_ACCOUNT,
  source: stellarNativeAsset(),
  destinationAsset: stellarTestnetUsdc(),
  amountInUnits: "100000000",
  expectedOutUnits: "87094750",
  minimumOutUnits: "86223802",
  slippageBps: 100,
  priceImpactBps: 0,
  feeMaxStroops: "100",
  path: [],
  observedAt,
  expiresAt,
};

export const paymentQuote: StellarQuote = {
  id: "payment-fixture-1",
  revision: 1,
  network: STELLAR_TESTNET,
  account: FIXTURE_ACCOUNT,
  kind: "payment",
  destination: FIXTURE_RECIPIENT,
  source: stellarTestnetUsdc(),
  destinationAsset: stellarTestnetUsdc(),
  amountInUnits: "10000000",
  expectedOutUnits: "10000000",
  minimumOutUnits: "10000000",
  slippageBps: 0,
  priceImpactBps: 0,
  feeMaxStroops: "100",
  path: [],
  observedAt,
  expiresAt,
};

export const prepared: PreparedStellarTransaction = {
  proposalId: quote.id,
  quote,
  unsignedXdr: "AAAA",
  transactionHash: FIXTURE_TX_HASH,
  sequence: "1",
  expiresAt: "2026-10-25T18:05:00.000Z",
};

export const rejected: StellarSettlement = {
  status: "failed",
  proposalId: quote.id,
  code: "cancelled",
  retry: "none",
};

export const pending: StellarSettlement = {
  status: "pending",
  proposalId: quote.id,
  txHash: FIXTURE_TX_HASH,
};

export const confirmed: StellarSettlement = {
  status: "confirmed",
  proposalId: quote.id,
  txHash: FIXTURE_TX_HASH,
  network: STELLAR_TESTNET,
  ledger: 12345,
  confirmedAt: "2026-10-25T18:02:00.000Z",
  amountInUnits: quote.amountInUnits,
  actualOutUnits: "86900000",
  feeChargedStroops: "100",
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${FIXTURE_TX_HASH}`,
  reasoningEvidence: "none",
};

export const fixtureIssuer = STELLAR_TESTNET_USDC_ISSUER;

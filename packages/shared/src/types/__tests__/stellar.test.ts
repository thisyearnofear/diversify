import { describe, expect, it } from "vitest";
import {
  STELLAR_TESTNET_USDC_ISSUER,
  formatAmountUnits,
  assetsEqual,
  isAllowlistedAsset,
  minimumOutUnits,
  parseAmountUnits,
  parsePreparedStellarAction,
  parseStellarQuote,
  parseStellarSettlement,
  spendableNativeStroops,
  stellarNativeAsset,
  stellarTestnetUsdc,
} from "../stellar";

const ACCOUNT = "GBJ52E7FRWATGDIDBMVUBSMKU7PXXPR65KR62TRSLUHSCYR5RBK7B6ML";
const OTHER = "GDUU33Q5TYYKF3O2YELQS4LKQDGI6WWVD5V4TN2XK3235NE5C2OAQCCP";

describe("Stellar amount and reserve arithmetic", () => {
  it("parses 7-decimal amounts and rejects exponent, sign, and extra precision", () => {
    expect(parseAmountUnits("10", 7)).toBe("100000000");
    expect(parseAmountUnits("8.7094750", 7)).toBe("87094750");
    expect(parseAmountUnits("1e-7", 7)).toBeNull();
    expect(parseAmountUnits("-1", 7)).toBeNull();
    expect(parseAmountUnits("1.00000001", 7)).toBeNull();
    expect(parseAmountUnits("0", 7)).toBeNull();
  });

  it("does not treat a 6-decimal USDC amount as 7-decimal units", () => {
    expect(parseAmountUnits("1.000000", 6)).toBe("1000000");
    expect(parseAmountUnits("1", 7)).not.toBe(parseAmountUnits("1", 6));
  });

  it("subtracts the base reserve, subentry reserves, liabilities, and fee", () => {
    const spendable = spendableNativeStroops({
      balanceStroops: 100_000_000n,
      subentryCount: 1,
      baseReserveStroops: 5_000_000n,
      sellingLiabilitiesStroops: 0n,
      feeStroops: 100n,
    });
    expect(spendable).toBe(84_999_900n);
  });

  it("adds sponsoring subentries and subtracts sponsored ones", () => {
    const spendable = spendableNativeStroops({
      balanceStroops: 100_000_000n,
      subentryCount: 1,
      baseReserveStroops: 5_000_000n,
      numSponsoring: 2,
      numSponsored: 1,
      sellingLiabilitiesStroops: 0n,
      feeStroops: 100n,
    });
    expect(spendable).toBe(100_000_000n - 20_000_000n - 100n);
  });

  it("refuses amounts above the signed int64 maximum", () => {
    expect(parseAmountUnits("922337203685.4775807", 7)).toBe("9223372036854775807");
    expect(parseAmountUnits("922337203685.4775808", 7)).toBeNull();
  });

  it("formats zero-decimal units without a dangling point", () => {
    expect(formatAmountUnits("42", 0)).toBe("42");
    expect(formatAmountUnits("86900000", 7)).toBe("8.6900000");
  });

  it("rounds the minimum down and refuses more than 100 bps", () => {
    expect(minimumOutUnits("87094750", 100)).toBe("86223802");
    expect(minimumOutUnits("87094750", 101)).toBeNull();
  });

  it("rejects the same code with a different issuer", () => {
    const issued = stellarTestnetUsdc();
    if (issued.kind !== "issued") throw new Error("testnet USDC must be an issued asset");
    const imitation = { ...issued, issuer: OTHER };
    expect(isAllowlistedAsset(imitation)).toBe(false);
    expect(assetsEqual(issued, imitation)).toBe(false);
    expect(issued.issuer).toBe(STELLAR_TESTNET_USDC_ISSUER);
    expect(stellarTestnetUsdc().decimals).toBe(7);
    expect(stellarNativeAsset().code).toBe("XLM");
  });
});

describe("Stellar quote validation", () => {
  const quote = {
    id: "q",
    revision: 1,
    network: "stellar:testnet",
    account: ACCOUNT,
    kind: "path-payment-strict-send",
    destination: ACCOUNT,
    source: stellarNativeAsset(),
    destinationAsset: stellarTestnetUsdc(),
    amountInUnits: "100000000",
    expectedOutUnits: "87094750",
    minimumOutUnits: "86223802",
    slippageBps: 100,
    priceImpactBps: null,
    feeMaxStroops: "100",
    path: [],
    observedAt: "2026-10-25T18:00:00.000Z",
    expiresAt: "2026-10-25T18:01:00.000Z",
  };

  it("accepts a bound conversion and rejects a payment wearing its kind", () => {
    expect(parseStellarQuote(quote)?.kind).toBe("path-payment-strict-send");
    expect(parseStellarQuote({ ...quote, kind: "payment" })).toBeNull();
    expect(parseStellarQuote({ ...quote, xdr: "AAAA" })).toBeNull();
  });

  it("requires a payment to keep the amount and name a different destination", () => {
    const payment = {
      ...quote,
      kind: "payment",
      destination: OTHER,
      source: stellarTestnetUsdc(),
      destinationAsset: stellarTestnetUsdc(),
      expectedOutUnits: "100000000",
      minimumOutUnits: "100000000",
      slippageBps: 0,
      priceImpactBps: 0,
    };
    expect(parseStellarQuote(payment)?.kind).toBe("payment");
    expect(parseStellarQuote({ ...payment, destination: ACCOUNT })).toBeNull();
    expect(parseStellarQuote({ ...payment, minimumOutUnits: "1", slippageBps: 99 })).toBeNull();
  });

  it("refuses a confirmed receipt whose explorer URL was not built from the hash", () => {
    const hash = "ab".repeat(32);
    const receipt = {
      status: "confirmed",
      proposalId: "q",
      txHash: hash,
      network: "stellar:testnet",
      ledger: 10,
      confirmedAt: "2026-10-25T18:02:00.000Z",
      amountInUnits: "100000000",
      actualOutUnits: "86900000",
      feeChargedStroops: "100",
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}`,
      reasoningEvidence: "none",
    };
    expect(parseStellarSettlement(receipt)?.status).toBe("confirmed");
    expect(parseStellarSettlement({ ...receipt, reasoningEvidence: "mirrored" })).toBeNull();
    expect(parseStellarSettlement({ ...receipt, explorerUrl: "https://evil.example/tx" })).toBeNull();
  });

  it("requires the exact XLM -> USDC direction and a null price impact for conversions", () => {
    expect(parseStellarQuote({ ...quote, source: stellarTestnetUsdc(), destinationAsset: stellarNativeAsset() })).toBeNull();
    expect(parseStellarQuote({ ...quote, priceImpactBps: 0 })).toBeNull();
    expect(parseStellarQuote({ ...quote, expiresAt: quote.observedAt })).toBeNull();
    expect(parseStellarQuote({ ...quote, amountInUnits: "9223372036854775808" })).toBeNull();
  });

  it("validates a prepared action field by field and rejects extras", () => {
    const prepared = {
      kind: "transaction",
      proposalId: quote.id,
      quote,
      unsignedXdr: "AAAA",
      transactionHash: "ab".repeat(32),
      sequence: "6",
      expiresAt: "2026-10-25T18:05:00.000Z",
    };
    expect(parsePreparedStellarAction(prepared)?.transactionHash).toBe("ab".repeat(32));
    expect(parsePreparedStellarAction({ ...prepared, signedXdr: "BBBB" })).toBeNull();
    expect(parsePreparedStellarAction({ ...prepared, transactionHash: "zz" })).toBeNull();
    const trustline = {
      kind: "trustline",
      proposalId: "tl-1",
      network: "stellar:testnet",
      account: ACCOUNT,
      asset: stellarTestnetUsdc(),
      limit: "9223372036854775807",
      reserveIncreaseStroops: "5000000",
      feeMaxStroops: "100",
      unsignedXdr: "AAAA",
      transactionHash: "cd".repeat(32),
      sequence: "7",
      expiresAt: "2026-10-25T18:05:00.000Z",
    };
    expect(parsePreparedStellarAction(trustline)?.kind).toBe("trustline");
    expect(parsePreparedStellarAction({ ...trustline, limit: "0" })).toBeNull();
    expect(parsePreparedStellarAction({ ...trustline, asset: stellarNativeAsset() })).toBeNull();
  });
});

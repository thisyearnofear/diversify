import { describe, expect, it } from "vitest";
import {
  arcArrivalRoute,
  formatUsd,
  fromSubunits,
  interpretIris,
  maxFeeFor,
  maxSendable,
  toSubunits,
} from "../arc-arrival";
import { computeMaxFee, usdcToSubunits } from "@diversifi/shared/src/services/cctp-service";

describe("arcArrivalRoute", () => {
  it("is off in production and tests unless explicitly enabled", () => {
    expect(arcArrivalRoute(undefined, "production")).toBeNull();
    expect(arcArrivalRoute(undefined, "test")).toBeNull();
    expect(arcArrivalRoute("off", "development")).toBeNull();
  });
  it("defaults to the testnet pair in development", () => {
    expect(arcArrivalRoute(undefined, "development")?.destinationKey).toBe("arbitrum-sepolia");
  });
  it("mainnet routes Arc (domain 26) to Arbitrum One — never Celo", () => {
    const r = arcArrivalRoute("mainnet", "production");
    expect(r?.sourceChainId).toBe(5042);
    expect(r?.destinationChainId).toBe(42161);
    expect(r?.sourceDomain).toBe(26);
  });
});

describe("USDC units", () => {
  it("parses and prints 6-decimal amounts exactly", () => {
    expect(toSubunits("12.4")).toBe(12_400_000n);
    expect(toSubunits("0.0000019")).toBe(1n); // truncates past 6 dp
    expect(toSubunits("abc")).toBeNull();
    expect(toSubunits("")).toBeNull();
    expect(fromSubunits(12_400_000n)).toBe("12.4");
    expect(fromSubunits(5_000_000n)).toBe("5");
  });
  it("formats cents and never shows a fake $0.00 for dust", () => {
    expect(formatUsd(12_400_000n)).toBe("$12.40");
    expect(formatUsd(1_234_567_890n)).toBe("$1,234.57");
    expect(formatUsd(3_000n)).toBe("<$0.01");
    expect(formatUsd(0n)).toBe("$0.00");
  });
});

describe("fees and max", () => {
  const entry = { finalityThreshold: 2000, minimumFee: 1.3, forwardFee: { low: 10, med: 50_000, high: 90_000 } };
  it("matches cctp-service.computeMaxFee exactly", () => {
    for (const amt of ["1", "12.4", "999.999999"]) {
      const ours = maxFeeFor(toSubunits(amt)!, entry, true);
      const theirs = computeMaxFee(usdcToSubunits(amt), entry, true);
      expect(ours.toString()).toBe(theirs.toString());
    }
  });
  it("max leaves the Arc gas reserve and the fee, and never goes negative", () => {
    expect(maxSendable(10_000_000n, 60_000n)).toBe(10_000_000n - 50_000n - 60_000n);
    expect(maxSendable(40_000n, 60_000n)).toBe(0n);
  });
});

describe("interpretIris", () => {
  it("reads pending, attested, failed-forward and delivered", () => {
    expect(interpretIris({})).toEqual({ state: "pending" });
    expect(interpretIris({ messages: [{ status: "pending_confirmations" }] })).toEqual({ state: "pending" });
    expect(
      interpretIris({ messages: [{ status: "complete", message: "0xm", attestation: "0xa" }] }),
    ).toEqual({ state: "attested", message: "0xm", attestation: "0xa", forwardFailed: false });
    expect(
      interpretIris({
        messages: [{ status: "complete", message: "0xm", attestation: "0xa", forwardState: "FAILED" }],
      }),
    ).toMatchObject({ state: "attested", forwardFailed: true });
    expect(interpretIris({ messages: [{ status: "complete", forwardTxHash: "0xf" }] })).toEqual({
      state: "delivered",
      forwardTxHash: "0xf",
    });
  });
});

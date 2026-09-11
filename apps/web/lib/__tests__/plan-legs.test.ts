import { describe, expect, it, vi } from "vitest";
import { isLegFillable, pickBiggestFillableGap } from "../plan-legs";
import { NETWORKS } from "@/config";

// No real chain map carries a zero address today; chain 999 models one so
// the placeholder branch is exercised.
vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    getTokenAddresses: (chainId: number) =>
      chainId === 999
        ? { KESm: "0x0000000000000000000000000000000000000000" }
        : actual.getTokenAddresses(chainId),
  };
});

const CELO = NETWORKS.CELO_MAINNET.chainId;
const ARBITRUM = NETWORKS.ARBITRUM_ONE.chainId;

describe("isLegFillable", () => {
  it("knows a token that exists on the chain", () => {
    expect(isLegFillable("cUSD", CELO)).toBe(true);
    expect(isLegFillable("USDC", ARBITRUM)).toBe(true);
  });

  it("rejects a token absent from the chain's address map", () => {
    // Mento regionals live on Celo only.
    expect(isLegFillable("KESm", ARBITRUM)).toBe(false);
  });

  it("rejects a zero address placeholder", () => {
    expect(isLegFillable("KESm", 999)).toBe(false);
  });

  it("treats an unknown chain as fillable — never claims what it can't check", () => {
    expect(isLegFillable("KESm", null)).toBe(true);
    expect(isLegFillable("KESm", undefined)).toBe(true);
  });
});

describe("pickBiggestFillableGap", () => {
  const legs = [
    { token: "KESm", gap: 40 },
    { token: "USDC", gap: 10 },
  ];

  it("prefers the largest fillable gap", () => {
    // Arbitrum can't hold KESm — the fillable gap wins even though smaller.
    expect(pickBiggestFillableGap(legs, ARBITRUM)?.token).toBe("USDC");
    expect(pickBiggestFillableGap(legs, CELO)?.token).toBe("KESm");
  });

  it("falls back to the largest gap overall when nothing is fillable", () => {
    const onlyUnfillable = [{ token: "KESm", gap: 40 }, { token: "COPm", gap: 20 }];
    expect(pickBiggestFillableGap(onlyUnfillable, ARBITRUM)?.token).toBe("KESm");
  });

  it("returns null when no gap exceeds 2", () => {
    expect(pickBiggestFillableGap([{ token: "KESm", gap: 2 }], CELO)).toBeNull();
    expect(pickBiggestFillableGap([], CELO)).toBeNull();
  });
});

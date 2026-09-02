import { describe, expect, it } from "vitest";
import { walletNeedsFunds } from "../wallet-nudge";

describe("walletNeedsFunds", () => {
  it("is silent until the first balance snapshot arrives", () => {
    expect(
      walletNeedsFunds({ lastUpdated: null, totalValue: 0 }),
    ).toBe(false);
  });

  it("is true only for a known-empty live wallet", () => {
    expect(
      walletNeedsFunds({ lastUpdated: 1, totalValue: 0 }),
    ).toBe(true);
    expect(
      walletNeedsFunds({ lastUpdated: 1, totalValue: 12 }),
    ).toBe(false);
  });

  it("does not nudge during demo", () => {
    expect(
      walletNeedsFunds({ lastUpdated: 1, totalValue: 0, isDemo: true }),
    ).toBe(false);
  });
});

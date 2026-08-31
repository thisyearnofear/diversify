import { describe, expect, it } from "vitest";
import { deriveShieldShape } from "../shield-shape";

describe("deriveShieldShape", () => {
  it("is a picker when no philosophy is chosen", () => {
    expect(
      deriveShieldShape({
        hasPlan: false,
        hasFunds: false,
        alignmentScore: 0,
        guardianMonitoring: false,
      }),
    ).toBe("picker");
  });

  it("is fund when a plan exists but the wallet is empty", () => {
    expect(
      deriveShieldShape({
        hasPlan: true,
        hasFunds: false,
        alignmentScore: 90,
        guardianMonitoring: true,
      }),
    ).toBe("fund");
  });

  it("is gap when holdings are off the plan", () => {
    expect(
      deriveShieldShape({
        hasPlan: true,
        hasFunds: true,
        alignmentScore: 40,
        guardianMonitoring: false,
      }),
    ).toBe("gap");
  });

  it("is quiet when aligned and Guardian is monitoring", () => {
    expect(
      deriveShieldShape({
        hasPlan: true,
        hasFunds: true,
        alignmentScore: 88,
        guardianMonitoring: true,
      }),
    ).toBe("quiet");
  });
});

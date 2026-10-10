import { describe, it, expect } from "vitest";
import { SOVEREIGN_DEBT, sovereignDebtFor } from "../sovereign-debt";

describe("sovereign-debt dataset", () => {
  it("looks up case-insensitively and returns null for uncovered codes", () => {
    expect(sovereignDebtFor("gh")?.country).toBe("Ghana");
    expect(sovereignDebtFor("GH")?.flag).toBe("🇬🇭");
    expect(sovereignDebtFor("XX")).toBeNull();
    expect(sovereignDebtFor(null)).toBeNull();
    expect(sovereignDebtFor(undefined)).toBeNull();
  });

  it("every event is dated, factual and sourced", () => {
    for (const entry of Object.values(SOVEREIGN_DEBT)) {
      expect(entry.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.events.length).toBeGreaterThan(0);
      for (const ev of entry.events) {
        expect(ev.date.length).toBeGreaterThanOrEqual(4);
        expect(ev.text.length).toBeGreaterThan(10);
        expect(ev.source.name.length).toBeGreaterThan(0);
        // No fabricated URLs — sources are named until surfaces ship
        // and each is re-verified by hand.
      }
    }
  });
});

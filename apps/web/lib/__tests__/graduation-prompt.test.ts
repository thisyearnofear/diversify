import { describe, expect, it } from "vitest";
import { graduationPromptLine, leadGraduationSignal } from "../graduation-prompt";

const none = { cyclical: false, corridor: false, largerBalance: false, hasSavedCycle: false };

describe("graduation prompt copy", () => {
  it("a saved cycle leads — it's the strongest evidence", () => {
    const s = { ...none, hasSavedCycle: true, corridor: true };
    expect(leadGraduationSignal(s)).toBe("hasSavedCycle");
    expect(graduationPromptLine(s)).toMatch(/saved payment cycle/);
  });

  it("corridor and cyclical each name the observed pattern as a question", () => {
    expect(graduationPromptLine({ ...none, corridor: true })).toMatch(/^Moving local savings into dollars often\?/);
    expect(graduationPromptLine({ ...none, cyclical: true })).toMatch(/^Saving toward regular payments\?/);
  });

  it("the noisy balance proxy alone says nothing", () => {
    expect(graduationPromptLine({ ...none, largerBalance: true })).toBeNull();
    expect(graduationPromptLine(none)).toBeNull();
  });

  it("never asserts a loss or labels the user", () => {
    for (const s of [{ ...none, corridor: true }, { ...none, cyclical: true }, { ...none, hasSavedCycle: true }]) {
      const line = graduationPromptLine(s)!;
      expect(line).not.toMatch(/you lost|losing|you are a business|your business is/i);
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});

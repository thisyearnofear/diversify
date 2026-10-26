import { describe, expect, it } from "vitest";
import { matchVoiceVerb, philosophyFromText } from "../voice-verbs";
import { SLEEVE_ID } from "@/components/tabs/protect/ring-ids";

describe("matchVoiceVerb — protect", () => {
  it("maps compare synonyms to toggleCompare", () => {
    for (const phrase of ["compare", "compare philosophies", "compare plans", "show other plans"]) {
      expect(matchVoiceVerb(phrase, "protect")).toEqual({
        kind: "shield",
        action: { type: "toggleCompare" },
      });
    }
  });

  it("maps exit phrases to exitCompare", () => {
    expect(matchVoiceVerb("back to my plan", "protect")).toEqual({
      kind: "shield",
      action: { type: "exitCompare" },
    });
  });

  it("previews a philosophy by alias", () => {
    expect(matchVoiceVerb("show me islamic finance", "protect")).toEqual({
      kind: "shield",
      action: { type: "focusPhilosophy", id: "islamic" },
    });
  });

  it("previews a philosophy by name", () => {
    expect(matchVoiceVerb("preview Buen Vivir", "protect")).toEqual({
      kind: "shield",
      action: { type: "focusPhilosophy", id: "buen_vivir" },
    });
  });

  it("sets a named reserve level", () => {
    expect(matchVoiceVerb("set the reserve conservative", "protect")).toEqual({
      kind: "shield",
      action: { type: "previewFloor", risk: "Conservative" },
    });
  });

  it("maps bigger/smaller reserve to the floor directions", () => {
    expect(matchVoiceVerb("bigger reserve", "protect")).toEqual({
      kind: "shield",
      action: { type: "previewFloor", risk: "Conservative" },
    });
    expect(matchVoiceVerb("lower reserve", "protect")).toEqual({
      kind: "shield",
      action: { type: "previewFloor", risk: "Aggressive" },
    });
  });

  it("emits a fuzzy slice query for token asks", () => {
    expect(matchVoiceVerb("show my kesm slice", "protect")).toEqual({
      kind: "slice",
      query: "kesm",
    });
    expect(matchVoiceVerb("what's in dollars", "protect")).toEqual({
      kind: "slice",
      query: "dollars",
    });
  });

  it("routes the sleeve ask to the sleeve slice", () => {
    expect(matchVoiceVerb("show tokenized assets", "protect")).toEqual({
      kind: "shield",
      action: { type: "selectSlice", token: SLEEVE_ID },
    });
  });

  it("maps the gap ask to the biggest_gap verb", () => {
    expect(matchVoiceVerb("close the biggest gap", "protect")).toEqual({
      kind: "biggest_gap",
    });
  });

  it("maps bail-outs to reset", () => {
    for (const phrase of ["cancel", "never mind", "go back"]) {
      expect(matchVoiceVerb(phrase, "protect")).toEqual({
        kind: "shield",
        action: { type: "reset" },
      });
    }
  });

  it("returns null for a miss", () => {
    expect(matchVoiceVerb("what is the weather in Nairobi", "protect")).toBeNull();
  });
});

describe("matchVoiceVerb — exchange", () => {
  it("parses a swap prefill", () => {
    expect(matchVoiceVerb("swap 50 kesm to usdm", "exchange")).toEqual({
      kind: "prefill",
      amount: "50",
      from: "kesm",
      to: "usdm",
    });
  });

  it("returns null for non-swap text", () => {
    expect(matchVoiceVerb("compare plans", "exchange")).toBeNull();
  });
});

describe("philosophyFromText", () => {
  it("resolves ids, names, and aliases", () => {
    expect(philosophyFromText("islamic")).toBe("islamic");
    expect(philosophyFromText("halal")).toBe("islamic");
    expect(philosophyFromText("caribbean")).toBe("pan_caribbean");
    expect(philosophyFromText("Global Diversification")).toBe("global");
  });

  it("returns null for unknown text", () => {
    expect(philosophyFromText("banana split")).toBeNull();
  });
});

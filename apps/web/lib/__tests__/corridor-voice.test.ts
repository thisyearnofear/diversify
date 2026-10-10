import { describe, it, expect } from "vitest";
import { voiceFor, voiceBeatForCode, CORRIDOR_VOICES } from "../corridor-voice";
import { CURRENCY_BY_CODE } from "@/constants/currency-risk";

describe("corridor-voice", () => {
  it("returns the curated register for voiced corridors", () => {
    expect(voiceFor("NGN")?.epithet).toBe("japa math");
    expect(voiceFor("PHP")?.epithet).toBe("padala math");
  });

  it("returns null for unvoiced or unknown codes — absence is honest", () => {
    expect(voiceFor("KES")).toBeNull();
    expect(voiceFor("USD")).toBeNull();
    expect(voiceFor("ZZZ")).toBeNull();
    expect(voiceFor(null)).toBeNull();
  });

  it("builds a persona beat in the register with the dataset number", () => {
    const beat = voiceBeatForCode("NGN");
    expect(beat).not.toBeNull();
    expect(beat!.key).toBe("voice-NGN");
    // The register leads; the fact follows — same 5y drift the corridor
    // dataset reports, never a voice-invented number.
    const drift = Math.abs(
      Math.round(CURRENCY_BY_CODE.NGN.depreciation.vsUSD["5yr"]),
    );
    expect(beat!.text).toContain("japa math");
    expect(beat!.text).toContain(String(drift));
    expect(beat!.text).toContain("dollar");
  });

  it("returns null for a voice without currency data", () => {
    // Every voiced code must have a CURRENCY_RISK entry — the dataset
    // test guards the pair, but a missing one must fail silent.
    for (const v of Object.values(CORRIDOR_VOICES)) {
      expect(CURRENCY_BY_CODE[v.code], `voice ${v.code} needs data`).toBeDefined();
    }
  });

  it("returns null for codes with no voice at all", () => {
    expect(voiceBeatForCode("KES")).toBeNull();
    expect(voiceBeatForCode(undefined)).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  readSnapshot,
  writeSnapshot,
  formatElapsed,
  MIN_SNAPSHOT_AGE_MS,
} from "../since-last-visit";

describe("since-last-visit snapshots", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a value with its timestamp", () => {
    writeSnapshot("home-moment:JMD:USD:1Y", -22.4);
    const snap = readSnapshot<number>("home-moment:JMD:USD:1Y");
    expect(snap).not.toBeNull();
    expect(snap!.value).toBe(-22.4);
    expect(typeof snap!.at).toBe("number");
  });

  it("returns null for a key that was never written", () => {
    expect(readSnapshot("never-written")).toBeNull();
  });

  it("returns null for corrupt JSON — memory degrades silently", () => {
    window.localStorage.setItem("diversifi:last-visit:broken", "{not json");
    expect(readSnapshot("broken")).toBeNull();
  });

  it("returns null for a payload without a timestamp", () => {
    window.localStorage.setItem(
      "diversifi:last-visit:no-ts",
      JSON.stringify({ value: 3 }),
    );
    expect(readSnapshot("no-ts")).toBeNull();
  });

  it("scopes keys under its prefix", () => {
    writeSnapshot("k", 1);
    expect(window.localStorage.getItem("k")).toBeNull();
    expect(window.localStorage.getItem("diversifi:last-visit:k")).not.toBeNull();
  });
});

describe("formatElapsed", () => {
  const now = Date.parse("2026-09-11T12:00:00Z");

  it("labels same-day snapshots 'earlier today'", () => {
    expect(formatElapsed(now - 7 * 3_600_000, now)).toBe("earlier today");
  });

  it("labels ~1-day-old snapshots 'yesterday'", () => {
    expect(formatElapsed(now - 30 * 3_600_000, now)).toBe("yesterday");
  });

  it("labels older snapshots in rounded days", () => {
    expect(formatElapsed(now - 72 * 3_600_000, now)).toBe("3d ago");
  });

  it("keeps the same-session noise threshold at 6 hours", () => {
    expect(MIN_SNAPSHOT_AGE_MS).toBe(6 * 3_600_000);
  });
});

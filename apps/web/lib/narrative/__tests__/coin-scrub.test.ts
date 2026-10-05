import { describe, it, expect } from "vitest";
import {
  coinWear,
  eventForDate,
  isScrubbableSeries,
  monthStep,
  monthsBackLabel,
  readingAt,
} from "../coin-scrub";

const series = {
  dates: ["2025-10-01", "2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"],
  values: [100, 90, 80, 70, 50],
};

describe("coin scrub", () => {
  it("rejects malformed series", () => {
    expect(isScrubbableSeries(null)).toBe(false);
    expect(isScrubbableSeries({ dates: ["2026-01-01"], values: [100] })).toBe(false);
    expect(isScrubbableSeries({ dates: ["2026-02-01", "2026-01-01"], values: [1, 2] })).toBe(false);
    expect(isScrubbableSeries({ dates: ["2026-01-01", "2026-02-01"], values: [1, 0] })).toBe(false);
    expect(isScrubbableSeries(series)).toBe(true);
  });

  it("reads real ratios between sampled points", () => {
    const start = readingAt(series, 0);
    expect(start.changeToToday).toBeCloseTo(-50);
    expect(start.changeFromStart).toBe(0);
    expect(start.ratioToToday).toBe(2);
    const today = readingAt(series, 99);
    expect(today.index).toBe(4);
    expect(today.changeToToday).toBe(0);
    expect(today.changeFromStart).toBeCloseTo(-50);
  });

  it("steps about one month per key press", () => {
    expect(monthStep(series)).toBe(1);
    const daily = {
      dates: Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2025, 9, 1) + i * 86_400_000).toISOString()),
      values: Array.from({ length: 366 }, () => 100),
    };
    expect(monthStep(daily)).toBe(30);
  });

  it("pins year-only events by UTC year, honest by omission", () => {
    const events = [{ year: 2025, event: "a" }, { year: 2026, event: "b" }];
    expect(eventForDate(events, "2026-04-01")?.event).toBe("b");
    expect(eventForDate(events, "2024-04-01")).toBeNull();
  });

  it("only a loss wears the coin", () => {
    expect(coinWear(-72)).toBeCloseTo(0.72);
    expect(coinWear(13)).toBe(0);
    expect(coinWear(-150)).toBe(1);
  });

  it("labels the scrubbed window in months, never blank", () => {
    expect(monthsBackLabel("2025-10-01", "2026-10-01")).toBe("12 mo");
    expect(monthsBackLabel("2026-09-25", "2026-10-01")).toBe("<1 mo");
  });
});

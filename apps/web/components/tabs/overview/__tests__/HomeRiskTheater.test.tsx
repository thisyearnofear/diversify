// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { HomeRiskTheater } from "../HomeRiskTheater";
import { BENCHMARK_KEYS, HORIZON_KEYS } from "@/constants/currency-risk";
import type { NarrativeMoment } from "@/lib/narrative/currency-moment";

const MOMENT: NarrativeMoment = {
  currencyCode: "JMD",
  countryName: "Jamaica",
  iso2: "JM",
  flag: "🇯🇲",
  benchmark: "USD",
  benchmarkLabel: "US Dollar",
  horizon: "1yr",
  delta: -8.4,
  savingsAmount: 1000,
  personalImpact: 84,
  retainedRatio: 0.916,
  state: "watch",
  isLive: false,
  dataAsOf: "2026-09-11",
  goods: null,
};

const REGIONS = [
  { region: "Africa", value: 600, color: "#0ea5e9" },
  { region: "LatAm", value: 400, color: "#22c55e" },
];

function renderTheater(overrides: Partial<React.ComponentProps<typeof HomeRiskTheater>> = {}) {
  return render(
    <HomeRiskTheater
      moment={MOMENT}
      inflationMoment={null}
      benchmarks={BENCHMARK_KEYS}
      horizons={HORIZON_KEYS}
      onSelectBenchmark={() => {}}
      onSelectHorizon={() => {}}
      onAmountChange={() => {}}
      onProtect={() => {}}
      frame={null}
      regionData={REGIONS}
      totalValue={1000}
      focusedRegion={null}
      onSelectRegion={() => {}}
      {...overrides}
    />,
  );
}

describe("HomeRiskTheater — holdings strip draw-in", () => {
  it("renders one tappable segment per region, sized by share", () => {
    renderTheater();
    const strip = screen.getByTestId("holdings-strip");
    expect(strip).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Africa 60%/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /LatAm 40%/ })).toBeInTheDocument();
  });

  it("renders no strip when there are no holdings", () => {
    renderTheater({ regionData: [], totalValue: 0 });
    expect(screen.queryByTestId("holdings-strip")).not.toBeInTheDocument();
  });
});

describe("HomeRiskTheater — since you were here (quiet memory)", () => {
  const KEY = "diversifi:last-visit:home-moment:JMD:USD:1yr";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the delta line when last visit's snapshot is old enough and the value moved", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: -9.1, at: Date.now() - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    const line = await screen.findByTestId("since-last-visit");
    expect(line.textContent).toContain("JMD moved +0.7 pts vs USD");
    expect(line.textContent).toContain("3d ago");
  });

  it("says 'steady' when the value has not moved", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: -8.4, at: Date.now() - 2 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    const line = await screen.findByTestId("since-last-visit");
    expect(line.textContent).toContain("steady vs USD");
  });

  it("stays silent on the first visit (no snapshot)", () => {
    renderTheater();
    expect(screen.queryByTestId("since-last-visit")).not.toBeInTheDocument();
  });

  it("stays silent for same-session snapshots (younger than 6h)", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: -9.1, at: Date.now() - 30 * 60 * 1000 }),
    );
    renderTheater();
    expect(screen.queryByTestId("since-last-visit")).not.toBeInTheDocument();
  });

  it("writes the current delta back for the next visit", async () => {
    renderTheater();
    await screen.findByTestId("holdings-strip");
    const snap = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    expect(snap).not.toBeNull();
    expect(snap.value).toBe(-8.4);
  });
});

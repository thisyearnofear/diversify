// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { HomeRiskTheater } from "../HomeRiskTheater";
import { BENCHMARK_KEYS, HORIZON_KEYS } from "@/constants/currency-risk";
import type { InflationMoment, NarrativeMoment } from "@/lib/narrative/currency-moment";

const mocks = vi.hoisted(() => ({
  visibility: "quiet" as "quiet" | "informed",
  navigateToGuardian: vi.fn(),
  sessionInfo: null as unknown as Record<string, unknown> | null,
  reduced: false,
}));

vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return { ...mod, useReducedMotion: () => mocks.reduced };
});

vi.mock("@/context/app/GuardianVisibilityContext", () => ({
  useGuardianVisibility: () => ({
    visibility: mocks.visibility,
    origin: "persona",
    setVisibility: () => {},
  }),
}));
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({ navigateToGuardian: mocks.navigateToGuardian }),
}));
vi.mock("@/hooks/use-guardian-session-info", () => ({
  useGuardianSessionInfo: (enabled: boolean) => (enabled ? mocks.sessionInfo : null),
}));

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

describe("HomeRiskTheater — purchasing-power horizon", () => {
  it("the currency moment needs no separate horizon baseplate — the reading already names pair and delta", async () => {
    renderTheater();
    expect(screen.queryByTestId("home-horizon-baseplate")).not.toBeInTheDocument();
    expect(await screen.findByText(/Over 1 year against US Dollar/)).toBeInTheDocument();
  });

  it("the inflation moment renders without a baseplate too", () => {
    const inflationMoment: InflationMoment = {
      kind: "inflation",
      countryName: "Jamaica",
      countryCode: "JM",
      flag: "🇯🇲",
      region: "Caribbean",
      inflationRate: 5.2,
      savingsAmount: 1000,
      annualImpact: 52,
      dataAsOf: "2026-09-11",
      isLive: true,
    };
    renderTheater({ moment: null, inflationMoment });
    expect(screen.queryByTestId("home-horizon-baseplate")).not.toBeInTheDocument();
    expect(screen.getByText("5.2%")).toBeInTheDocument();
  });
});

describe("HomeRiskTheater — holdings coin row", () => {
  it("renders one tappable coin per region, sized by share", () => {
    renderTheater();
    const strip = screen.getByTestId("holdings-strip");
    expect(strip).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Africa 60%" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "LatAm 40%" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking an unfocused coin selects it; clicking the focused one clears", () => {
    const onSelectRegion = vi.fn();
    renderTheater({ onSelectRegion });
    fireEvent.click(screen.getByRole("button", { name: "Africa 60%" }));
    expect(onSelectRegion).toHaveBeenCalledWith("Africa");

    cleanup();
    onSelectRegion.mockClear();
    renderTheater({ onSelectRegion, focusedRegion: "Africa" });
    expect(screen.getByRole("button", { name: "Africa 60%" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Africa 60%" }));
    expect(onSelectRegion).toHaveBeenCalledWith(null);
  });

  it("renders no strip when there are no holdings", () => {
    renderTheater({ regionData: [], totalValue: 0 });
    expect(screen.queryByTestId("holdings-strip")).not.toBeInTheDocument();
  });

  it("has no holdings-stack flip and no tap hints", () => {
    renderTheater();
    expect(screen.queryByRole("button", { name: "Show holdings stack" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show currency stage" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap (the|a) /)).not.toBeInTheDocument();
  });
});

describe("HomeRiskTheater — since you were here (quiet memory)", () => {
  const KEY = "diversifi:last-visit:home-reading:v1:JM:JMD:USD:1yr:curated";
  const NOW = Date.parse("2026-09-22T12:00:00Z");
  const READING = { key: "JM:JMD:USD:1yr", delta: -9.1, dataAsOf: "2026-09-10", source: "curated" };

  beforeEach(() => {
    window.localStorage.clear();
    mocks.reduced = false;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mocks.reduced = false;
  });

  it("renders the visit review when last visit's snapshot is old enough and the reading moved", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: READING, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    const review = await screen.findByTestId("currency-visit-review");
    expect(within(review).getByRole("heading").textContent).toMatch(/0\.7 pts higher than/);
    expect(review.textContent).not.toContain("Since you last checked");
    expect(within(review).getByText("Now")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Home view" })).toBeInTheDocument();
  });

  it("stays on the longer view when the source date has not advanced", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: { ...READING, delta: -8.4, dataAsOf: "2026-09-11" }, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    expect(await screen.findByLabelText("Example amount")).toBeInTheDocument();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Home view" })).not.toBeInTheDocument();
  });

  it("stays on the historical view on the first visit (no snapshot, no toggle)", () => {
    renderTheater();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Home view" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Example amount")).toBeInTheDocument();
  });

  it("stays silent for same-session snapshots (younger than 6h)", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: READING, at: NOW - 30 * 60 * 1000 }),
    );
    renderTheater();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
  });

  it("ignores legacy scalar snapshots that carry no provenance", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: -9.1, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
  });

  it("writes the current reading (not a scalar) back for the next visit", async () => {
    renderTheater();
    await screen.findByTestId("holdings-strip");
    const snap = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    expect(snap).not.toBeNull();
    expect(snap.value).toEqual({
      key: "JM:JMD:USD:1yr",
      delta: -8.4,
      dataAsOf: "2026-09-11",
      source: "curated",
    });
    expect(snap.at).toBe(NOW);
  });

  it("the visit/history toggle never swaps out the stage controls", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: READING, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    await screen.findByTestId("currency-visit-review");

    fireEvent.click(screen.getByRole("button", { name: "Longer view" }));
    expect(screen.getByRole("button", { name: "3Y" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Last visit" }));
    await screen.findByTestId("currency-visit-review");
    fireEvent.click(screen.getByRole("button", { name: "Longer view" }));
    expect(screen.getByRole("button", { name: "3Y" })).toBeInTheDocument();
  });

  it("writes no visit memory while inactive, then compares once active", async () => {
    const baselineJson = JSON.stringify({ value: READING, at: NOW - 3 * 24 * 3600 * 1000 });
    window.localStorage.setItem(KEY, baselineJson);
    const { rerender } = renderTheater({ isActive: false });
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBe(baselineJson);

    rerender(
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
        isActive={true}
      />,
    );
    const review = await screen.findByTestId("currency-visit-review");
    expect(review.textContent).toMatch(/0\.7 pts higher than/);
  });

  it("never reads or writes visit memory in demo mode", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: READING, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    setItem.mockClear();
    renderTheater({ isDemo: true });
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Home view" })).not.toBeInTheDocument();
    expect(setItem.mock.calls.some(([k]) => String(k).includes("home-reading"))).toBe(false);
  });
});

describe("HomeRiskTheater — Guardian activity moved off the resting surface", () => {
  const ACTIVITY_KEY = "diversifi:last-visit:guardian-activity";

  beforeEach(() => {
    window.localStorage.clear();
    mocks.visibility = "informed";
    mocks.sessionInfo = {
      activityStats: { week: "2026-W39", evaluated: 15, executed: 3, declined: 2 },
      decisionLog: [],
    };
    mocks.navigateToGuardian.mockReset();
  });

  it("renders no Guardian activity reporting at rest", async () => {
    renderTheater();
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("guardian-since-visit")).not.toBeInTheDocument();
    expect(screen.queryByText(/Guardian ran/)).not.toBeInTheDocument();
  });

  it("never reads or writes the guardian-activity visit key", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      renderTheater();
      await screen.findByTestId("holdings-strip");
      const touched = (calls: unknown[][]) =>
        calls.some(([k]) => String(k).includes(ACTIVITY_KEY));
      expect(touched(getItem.mock.calls)).toBe(false);
      expect(touched(setItem.mock.calls)).toBe(false);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("HomeRiskTheater — the settled-move seal", () => {
  it("marks the sealed region's coin with a persistent ✓", () => {
    renderTheater({ sealedRegion: "Africa" });
    expect(screen.getByTestId("region-coin-sealed")).toHaveTextContent("✓");
  });

  it("seals only the named region — the other coin stays bare", () => {
    renderTheater({ sealedRegion: "Africa" });
    expect(screen.getAllByTestId("region-coin-sealed")).toHaveLength(1);
    cleanup();
    renderTheater({ sealedRegion: "LatAm" });
    expect(screen.getByTestId("region-coin-sealed")).toBeInTheDocument();
  });

  it("reduced motion shows the ✓ without the pulse ring", () => {
    mocks.reduced = true;
    try {
      renderTheater({ sealedRegion: "Africa" });
      expect(screen.getByTestId("region-coin-sealed")).toHaveTextContent("✓");
      expect(document.querySelector(".border-emerald-500")).toBeNull();
    } finally {
      mocks.reduced = false;
    }
  });
});

const CONCENTRATED = [
  { region: "Africa", value: 700, color: "#0ea5e9" },
  { region: "LatAm", value: 300, color: "#22c55e" },
];

describe("HomeRiskTheater — inline inspection replaces the stage", () => {
  it("has no concentration lens branch", () => {
    renderTheater({ regionData: CONCENTRATED });
    const theater = screen.getByTestId("home-risk-theater");
    expect(theater).not.toHaveAttribute("data-lens");
    expect(screen.queryByTestId("home-lens-back")).not.toBeInTheDocument();
  });

  it("keeps the comparison mounted but hidden and unreachable while a region is selected", () => {
    renderTheater({ focusedRegion: "Africa" });
    const comparison = screen.getByTestId("home-comparison");
    expect(comparison).not.toBeVisible();
    expect(comparison).toHaveAttribute("hidden");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review protection plan/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("holdings-strip")).toBeVisible();
  });

  it("hides the comparison while the currency story is selected too", () => {
    renderTheater({ currencySelected: true });
    expect(screen.getByTestId("home-comparison")).not.toBeVisible();
  });

  it("restores the same mounted comparison and settings on close", () => {
    const { rerender } = render(
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
        focusedRegion="Africa"
        onSelectRegion={() => {}}
        inspection={<p data-testid="region-detail">Africa detail</p>}
      />,
    );
    const comparison = screen.getByTestId("home-comparison");
    expect(comparison).not.toBeVisible();
    expect(screen.getByTestId("region-detail")).toBeInTheDocument();
    rerender(
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
        inspection={<p data-testid="region-detail">Africa detail</p>}
      />,
    );
    expect(screen.getByTestId("home-comparison")).toBe(comparison);
    expect(screen.getByTestId("home-comparison")).toBeVisible();
    expect(screen.getByLabelText("Example amount")).toBeInTheDocument();
  });

  it("centres the holdings strip when it fits and anchors the ends for overflow", () => {
    renderTheater();
    const first = screen.getByRole("button", { name: "Africa 60%" });
    const last = screen.getByRole("button", { name: "LatAm 40%" });
    expect(first.className).toContain("ms-auto");
    expect(first.className).toContain("flex-none");
    expect(last.className).toContain("me-auto");
    expect(last.className).toContain("flex-none");
  });

  it("centres a single holding coin with both end margins", () => {
    renderTheater({
      regionData: [{ region: "Africa", value: 1000, color: "#0ea5e9" }],
      totalValue: 1000,
    });
    const only = screen.getByRole("button", { name: "Africa 100%" });
    expect(only.className).toContain("ms-auto");
    expect(only.className).toContain("me-auto");
  });

  it("keeps the comparison's Money/Goods setting across an open/close cycle", () => {
    const goodsMoment: NarrativeMoment = {
      ...MOMENT,
      goods: { unit: "bags of rice", count: 12 },
    };
    const shared = {
      moment: goodsMoment,
      inflationMoment: null,
      benchmarks: BENCHMARK_KEYS,
      horizons: HORIZON_KEYS,
      onSelectBenchmark: () => {},
      onSelectHorizon: () => {},
      onAmountChange: () => {},
      onProtect: () => {},
      frame: null,
      regionData: REGIONS,
      totalValue: 1000,
      onSelectRegion: () => {},
    };
    const { rerender } = render(<HomeRiskTheater {...shared} focusedRegion={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Goods" }));
    expect(screen.getByRole("button", { name: "Goods" })).toHaveAttribute("aria-pressed", "true");

    rerender(<HomeRiskTheater {...shared} focusedRegion="Africa" />);
    expect(screen.getByTestId("home-comparison")).toHaveAttribute("hidden");

    rerender(<HomeRiskTheater {...shared} focusedRegion={null} />);
    expect(screen.getByTestId("home-comparison")).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Goods" })).toHaveAttribute("aria-pressed", "true");
  });
});

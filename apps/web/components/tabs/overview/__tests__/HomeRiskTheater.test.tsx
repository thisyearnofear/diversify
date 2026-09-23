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
  it("grounds a currency moment with its corridor reading", () => {
    renderTheater();
    expect(screen.getByTestId("home-horizon-baseplate")).toHaveTextContent(
      "JMD vs US Dollar · −8.4%",
    );
  });

  it("uses the real inflation-moment fields", () => {
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
    expect(screen.getByTestId("home-horizon-baseplate")).toHaveTextContent(
      "Jamaica · 5.2% annual rate",
    );
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
    expect(await screen.findByLabelText("Your savings amount")).toBeInTheDocument();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Home view" })).not.toBeInTheDocument();
  });

  it("stays on the historical view on the first visit (no snapshot, no toggle)", () => {
    renderTheater();
    expect(screen.queryByTestId("currency-visit-review")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Home view" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your savings amount")).toBeInTheDocument();
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

describe("HomeRiskTheater — while you were away (Guardian activity)", () => {
  const ACTIVITY_KEY = "diversifi:last-visit:guardian-activity";
  const DAY = 24 * 3600 * 1000;

  beforeEach(() => {
    window.localStorage.clear();
    mocks.visibility = "quiet";
    mocks.sessionInfo = null;
    mocks.navigateToGuardian.mockReset();
  });

  function informedSession(week: string, evaluated: number, executed: number, declined: number) {
    mocks.visibility = "informed";
    mocks.sessionInfo = {
      activityStats: { week, evaluated, executed, declined },
      decisionLog: [
        { capturedAt: new Date(Date.now() - DAY).toISOString(), status: "declined", reason: "within bounds" },
      ],
    };
  }

  it("renders same-week deltas against the last visit's snapshot", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderTheater();
    const line = await screen.findByTestId("guardian-since-visit");
    expect(line.textContent).toContain("Since your last visit (3d ago)");
    expect(line.textContent).toContain("ran 5 checks");
    expect(line.textContent).toContain("1 move");
    expect(line.textContent).toContain("1 stand-down");
  });

  it("quotes 'this week' totals when the snapshot is from an earlier week", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W38|10|2|1", at: Date.now() - 8 * DAY }),
    );
    renderTheater();
    const line = await screen.findByTestId("guardian-since-visit");
    expect(line.textContent).toContain("This week: Guardian ran 15 checks");
    expect(line.textContent).not.toContain("Since your last visit");
  });

  it("stays silent in quiet mode", async () => {
    informedSession("2026-W39", 15, 3, 2);
    mocks.visibility = "quiet";
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderTheater();
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("guardian-since-visit")).not.toBeInTheDocument();
  });

  it("stays silent when the session doc predates activity counters", async () => {
    mocks.visibility = "informed";
    mocks.sessionInfo = { activityStats: null, decisionLog: [] };
    renderTheater();
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("guardian-since-visit")).not.toBeInTheDocument();
  });

  it("never fabricates a line — no snapshot, no counters, no zeros", async () => {
    informedSession("2026-W39", 0, 0, 0);
    renderTheater();
    await screen.findByTestId("holdings-strip");
    expect(screen.queryByTestId("guardian-since-visit")).not.toBeInTheDocument();
  });

  it("hands the line plus recent decisions to Ask Guardian on tap", async () => {
    informedSession("2026-W39", 15, 3, 2);
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify({ value: "2026-W39|10|2|1", at: Date.now() - 3 * DAY }),
    );
    renderTheater();
    const line = await screen.findByTestId("guardian-since-visit");
    fireEvent.click(line);
    await waitFor(() => expect(mocks.navigateToGuardian).toHaveBeenCalledTimes(1));
    const payload = mocks.navigateToGuardian.mock.calls[0][0];
    expect(payload.summary).toContain("Guardian ran 5 checks");
    expect(payload.prompt).toContain("Recent decisions:");
    expect(payload.prompt).toContain("within bounds");
  });
});

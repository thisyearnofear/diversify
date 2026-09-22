// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { HomeRiskTheater } from "../HomeRiskTheater";
import { BENCHMARK_KEYS, HORIZON_KEYS } from "@/constants/currency-risk";
import type { NarrativeMoment } from "@/lib/narrative/currency-moment";

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
    expect(review.textContent).toContain("The comparison changed");
    expect(review.textContent).toContain("0.7 percentage points higher");
    expect(within(review).getByText(/Last checked/)).toBeInTheDocument();
    expect(within(review).getByText("Latest reading")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Home view" })).toBeInTheDocument();
  });

  it("says 'No newer comparison yet' when the source date has not advanced", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: { ...READING, delta: -8.4, dataAsOf: "2026-09-11" }, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    const review = await screen.findByTestId("currency-visit-review");
    expect(review.textContent).toContain("No newer comparison yet");
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

  it("flips to holdings only via the coin button — never the stage controls", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ value: READING, at: NOW - 3 * 24 * 3600 * 1000 }),
    );
    renderTheater();
    await screen.findByTestId("currency-visit-review");

    fireEvent.click(screen.getByRole("button", { name: "Longer view" }));
    expect(screen.queryByRole("button", { name: "Show currency stage" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Last visit" }));
    expect(screen.queryByRole("button", { name: "Show currency stage" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Longer view" }));
    fireEvent.click(screen.getByRole("button", { name: "3Y" }));
    fireEvent.change(screen.getByLabelText("Your savings amount"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Protect this" }));
    expect(screen.queryByRole("button", { name: "Show currency stage" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Show holdings stack" })[0]);
    const back = await screen.findByRole("button", { name: "Show currency stage" });
    expect(back).toBeInTheDocument();
    expect(back).toHaveFocus();
    expect(screen.queryByRole("button", { name: "3Y" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Your savings amount" })).not.toBeInTheDocument();
    fireEvent.click(back);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "3Y" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Show holdings stack" })).toHaveFocus();
  });

  it("flips without rotation under reduced motion and returns", async () => {
    mocks.reduced = true;
    renderTheater();
    const flip = screen.getByRole("button", { name: "Show holdings stack" });
    fireEvent.click(flip);
    const back = await screen.findByRole("button", { name: "Show currency stage" });
    expect(back.parentElement).toHaveStyle({ transform: "none" });
    expect(back).toHaveFocus();
    expect(screen.queryByRole("button", { name: "3Y" })).not.toBeInTheDocument();
    fireEvent.click(back);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show holdings stack" })).toHaveFocus(),
    );
  });

  it("reveals the front again when holdings disappear mid-flip", async () => {
    const { rerender } = renderTheater();
    fireEvent.click(screen.getByRole("button", { name: "Show holdings stack" }));
    await screen.findByRole("button", { name: "Show currency stage" });

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
        regionData={[]}
        totalValue={0}
        focusedRegion={null}
        onSelectRegion={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "3Y" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Show currency stage" })).not.toBeInTheDocument();
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
    expect(review.textContent).toContain("0.7 percentage points higher");
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

  it("never paints over a hidden keep-mounted pane or steals its focus", async () => {
    mocks.reduced = true;
    const el = (hidden: boolean, overrides: Partial<React.ComponentProps<typeof HomeRiskTheater>> = {}) => (
      <div>
        <button type="button">outside</button>
        <div style={{ visibility: hidden ? "hidden" : "visible" }}>
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
          />
        </div>
      </div>
    );
    const faces = () => {
      const stage = screen.getByTestId("home-risk-theater").querySelector(":scope > div > div");
      return { front: stage?.children[0] as HTMLElement, back: stage?.children[1] as HTMLElement | undefined };
    };
    const outside = () => screen.getByRole("button", { name: "outside" });

    const { rerender } = render(el(true));
    expect(screen.queryByRole("button", { name: "Show holdings stack" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Your savings amount" })).toBeNull();
    expect(faces().front.style.visibility).toBe("");

    rerender(el(false));
    fireEvent.click(screen.getByRole("button", { name: "Show holdings stack" }));
    const backButton = await screen.findByRole("button", { name: "Show currency stage" });
    expect(backButton).toHaveFocus();

    outside().focus();
    rerender(el(true, { isActive: false }));
    expect(screen.queryByRole("button", { name: "Show currency stage" })).toBeNull();
    expect(faces().back?.style.visibility ?? "").toBe("");

    rerender(el(true, { isActive: false, regionData: [], totalValue: 0 }));
    await waitFor(() => expect(outside()).toHaveFocus());
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

// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { HomeRiskTheater } from "../HomeRiskTheater";
import { BENCHMARK_KEYS, HORIZON_KEYS } from "@/constants/currency-risk";
import type { NarrativeMoment } from "@/lib/narrative/currency-moment";

const mocks = vi.hoisted(() => ({
  visibility: "quiet" as "quiet" | "informed",
  navigateToGuardian: vi.fn(),
  sessionInfo: null as unknown as Record<string, unknown> | null,
}));

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

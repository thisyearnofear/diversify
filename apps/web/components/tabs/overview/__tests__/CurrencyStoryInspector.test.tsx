// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { CurrencyStoryInspector } from "../CurrencyStoryInspector";

const mockAskAdvisor = vi.fn();
let mockLive: {
  depreciation1yr: number | null;
  asOf: string | null;
  series: { dates: string[]; values: number[] } | null;
} | null = null;
let mockSignal: { text: string; dateLabel: string } | null = null;

vi.mock("@/components/swap/CorridorContext", () => ({
  useLiveCurrencyRisk: () => mockLive,
}));
vi.mock("@/hooks/use-proof-feed", () => ({ useProofFeed: () => ({ data: null }) }));
vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: mockAskAdvisor }),
}));
vi.mock("@/lib/corridor-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/corridor-context")>()),
  corridorSignalForCurrency: () => mockSignal,
}));

afterEach(() => {
  cleanup();
  mockLive = null;
  mockSignal = null;
  mockAskAdvisor.mockClear();
});

const FIXTURE = (overrides: Partial<{ dates: string[]; values: number[] }> = {}) => ({
  dates: ["2026-01-01", "2026-01-02", "2026-01-11"],
  values: [100, 110, 120],
  ...overrides,
});

function renderStory(code = "KES") {
  return render(<CurrencyStoryInspector code={code} onClose={vi.fn()} />);
}

describe("CurrencyStoryInspector — 12-month path", () => {
  it("spaces x by real timestamps, not index", () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    const path = document.querySelector('svg[viewBox="0 0 100 50"] path[fill="none"]');
    expect(path).not.toBeNull();
    expect(path!.getAttribute("d")).toContain("M0.00,");
    expect(path!.getAttribute("d")).toContain("L10.00,");
    expect(path!.getAttribute("d")).toContain("L100.00,");
  });

  it("labels the chart explicitly and carries feed provenance", () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    expect(screen.getByText("12-month path vs USD")).toBeInTheDocument();
    expect(screen.getByText(/indexed to 100/)).toBeInTheDocument();
    expect(screen.getByText("FX feed · as of 2026-01-11")).toBeInTheDocument();
    cleanup();
    mockLive = { depreciation1yr: null, asOf: null, series: FIXTURE() };
    renderStory();
    expect(screen.getByText("FX feed · date unavailable")).toBeInTheDocument();
  });

  it("shows readable endpoint dates and the source index values", () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    expect(screen.getByText(/Jan 2026 · 100/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2026 · 120/)).toBeInTheDocument();
    const chart = document.querySelector('svg[viewBox="0 0 100 50"]')!;
    expect(chart.querySelector("line")).not.toBeNull();
    expect(chart.querySelector("circle")).toBeNull();
  });

  it("draws the plot as one plain solid stroke — no dash or draw-in props", () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    const path = document.querySelector('svg[viewBox="0 0 100 50"] path[fill="none"]')!;
    expect(path.getAttribute("stroke-dasharray")).toBeNull();
    expect(path.getAttribute("pathLength")).toBeNull();
    expect(path.getAttribute("style") ?? "").not.toContain("stroke-dasharray");
  });

  it("draws a flat-100 series without degenerate coordinates", () => {
    mockLive = {
      depreciation1yr: null,
      asOf: "2026-01-11",
      series: FIXTURE({ values: [100, 100, 100] }),
    };
    renderStory();
    const path = document.querySelector('svg[viewBox="0 0 100 50"] path[fill="none"]');
    expect(path!.getAttribute("d")).toContain("M0.00,47.00");
    expect(path!.getAttribute("d")).toContain("L100.00,47.00");
  });

  it.each([
    ["mismatched arrays", { dates: ["2026-01-01"], values: [100, 110] }],
    ["a single point", { dates: ["2026-01-01"], values: [100] }],
    ["a non-finite value", { values: [100, NaN, 120] }],
    ["a non-positive value", { values: [100, 0, 120] }],
    ["an invalid date", { dates: ["2026-01-01", "not-a-date", "2026-01-11"] }],
    ["duplicate dates", { dates: ["2026-01-01", "2026-01-02", "2026-01-02"] }],
    ["descending dates", { dates: ["2026-01-11", "2026-01-02", "2026-01-01"] }],
  ])("renders the honest unavailable line for %s", (_label, series) => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE(series) };
    renderStory();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();
  });

  it("renders the unavailable line for a null live read and a null series", () => {
    renderStory();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();
    expect(screen.getByText(/Curated history · checked/)).toBeInTheDocument();

    cleanup();
    mockLive = { depreciation1yr: null, asOf: null, series: null };
    renderStory();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();
  });
});

describe("CurrencyStoryInspector — event rail", () => {
  it("defaults to the newest event caption with that event pressed, and switches on real buttons", () => {
    renderStory();
    expect(screen.getByText(/Record stability —/)).toBeInTheDocument();
    expect(screen.queryByText(/General Election —/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2025 · Record stability/ }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /2022 · General Election/ }));
    expect(screen.getByText(/General Election — KES dropped 6\.8%/)).toBeInTheDocument();
    expect(screen.queryByText(/Record stability —/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2022 · General Election/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("exposes a separate Latest button only when a live anchored signal exists", () => {
    renderStory();
    expect(screen.queryByRole("button", { name: "Latest" })).not.toBeInTheDocument();
    cleanup();
    mockSignal = { text: "CBK held the rate", dateLabel: "2d ago" };
    renderStory();
    const latest = screen.getByRole("button", { name: "Latest" });
    fireEvent.click(latest);
    expect(screen.getByText(/CBK held the rate · 2d ago/)).toBeInTheDocument();
    expect(screen.getByText(/Live signal · 2d ago/)).toBeInTheDocument();
    expect(screen.queryByText(/Curated history · checked/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Record stability —/)).not.toBeInTheDocument();
  });

  it("falls back to the newest event when the Latest signal disappears", () => {
    mockSignal = { text: "CBK held the rate", dateLabel: "2d ago" };
    const { rerender } = renderStory();
    fireEvent.click(screen.getByRole("button", { name: "Latest" }));
    expect(screen.getByText(/CBK held the rate · 2d ago/)).toBeInTheDocument();

    mockSignal = null;
    rerender(<CurrencyStoryInspector code="KES" onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Latest" })).not.toBeInTheDocument();
    expect(screen.getByText(/Record stability —/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2025 · Record stability/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Curated history · checked/)).toBeInTheDocument();
  });

  it("a drag release on the rail does not select an event", () => {
    renderStory();
    const track = screen.getByTestId("flick-row-track");
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: "mouse", clientX: 40 });
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: "mouse", clientX: 40 });
    fireEvent.click(screen.getByRole("button", { name: /2022 · General Election/ }));
    expect(screen.getByText(/Record stability —/)).toBeInTheDocument();
    expect(screen.queryByText(/General Election —/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2022 · General Election/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the curated freshness line, not a feed claim", () => {
    renderStory();
    expect(screen.getByText(/Curated history · checked/)).toBeInTheDocument();
  });

  it("resets the selection and chart on a code change", () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    const { rerender } = renderStory("KES");
    fireEvent.click(screen.getByRole("button", { name: /2022 · General Election/ }));
    expect(screen.getByText(/General Election —/)).toBeInTheDocument();

    mockLive = {
      depreciation1yr: null,
      asOf: "2026-01-11",
      series: FIXTURE({ values: [100, 90, 80] }),
    };
    rerender(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    const openSheet = document.querySelector('[data-selected-id="NGN"]')!;
    expect(openSheet.textContent).not.toContain("KES dropped 6.8%");
    expect(openSheet.textContent).toContain("Rate-cut test —");
    expect(openSheet.textContent).toContain("Jan 2026 · 80");
  });
});

describe("CurrencyStoryInspector — actions", () => {
  it("Ask Guardian closes the sheet, then asks", () => {
    const onClose = vi.fn();
    render(<CurrencyStoryInspector code="KES" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Ask Guardian about the KES/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockAskAdvisor).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockAskAdvisor.mock.invocationCallOrder[0],
    );
  });

  it("keeps the share line quiet and secondary", () => {
    renderStory();
    expect(screen.getByText(/Share this currency's story/)).toBeInTheDocument();
    // The share card plays the card's own curated 5y delta on the coin.
    const card = screen.getByTestId('moment-share-card');
    expect(card).toHaveAccessibleName(/5 years\. Replay$/);
    const worn = Number(screen.getByTestId('moment-share-coin').getAttribute('data-worn'));
    expect(worn).toBeGreaterThanOrEqual(0.45);
    expect(worn).toBeLessThanOrEqual(1);
  });
});

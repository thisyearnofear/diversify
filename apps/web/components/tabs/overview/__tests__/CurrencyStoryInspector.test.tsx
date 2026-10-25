// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { CurrencyStoryInspector } from "../CurrencyStoryInspector";

const mockAskAdvisor = vi.fn();
const mockTrack = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackFunnelEvent: mockTrack }));
let mockLive: {
  depreciation1yr: number | null;
  asOf: string | null;
  series: { dates: string[]; values: number[] } | null;
} | null = null;
let mockSignal: { text: string; dateLabel: string } | null = null;
let mockNews: Array<{ title: string; url: string; source: string; date: string | null }> = [];
let mockGeo: string | null = null;
vi.mock('@/hooks/use-geo-country', () => ({ useGeoCountry: () => mockGeo }));

vi.mock("@/components/swap/CorridorContext", () => ({
  useLiveCurrencyRisk: () => mockLive,
}));
vi.mock("@/hooks/use-currency-news", () => ({ useCurrencyNews: () => mockNews }));
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
  mockNews = [];
  mockGeo = null;
  mockAskAdvisor.mockClear();
  mockTrack.mockClear();
});

describe('Currency story wording', () => {
  it('lets people choose a local phrase without assuming it from the currency', () => {
    const { rerender } = render(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'japa math' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Local phrase' }));
    expect(screen.getByRole('heading', { name: 'japa math' })).toBeInTheDocument();
    rerender(<CurrencyStoryInspector code="BRL" onClose={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'custo Brasil' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Local phrase' }));
    expect(screen.getByRole('heading', { name: 'custo Brasil' })).toBeInTheDocument();
  });

  it('withdraws promotional wording where the thesis gate denies it', () => {
    mockGeo = 'GB';
    render(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Local phrase' })).toBeNull();
  });
});

const walkthroughCalls = (event: string) =>
  mockTrack.mock.calls.filter(([name]) => name === event);

const FIXTURE = (overrides: Partial<{ dates: string[]; values: number[] }> = {}) => ({
  dates: ["2026-01-01", "2026-01-02", "2026-01-11"],
  values: [100, 110, 120],
  ...overrides,
});

function renderStory(code = "KES") {
  return render(<CurrencyStoryInspector code={code} onClose={vi.fn()} />);
}

const openPath = async () => {
  fireEvent.click(screen.getByRole("button", { name: "1Y path" }));
  // mode="wait" — the outgoing panel exits before the new one mounts.
  await screen.findByText(/12-month path vs USD|Historical path unavailable/);
};
const openNews = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Headlines" }));
  await screen.findByTestId("currency-news");
};

describe("CurrencyStoryInspector — 12-month path", () => {
  it("spaces x by real timestamps, not index", async () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    await openPath();
    const path = document.querySelector('svg[viewBox="0 0 100 50"] path[fill="none"]');
    expect(path).not.toBeNull();
    expect(path!.getAttribute("d")).toContain("M0.00,");
    expect(path!.getAttribute("d")).toContain("L10.00,");
    expect(path!.getAttribute("d")).toContain("L100.00,");
  });

  it("labels the chart explicitly and carries feed provenance", async () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    await openPath();
    expect(screen.getByText("12-month path vs USD")).toBeInTheDocument();
    expect(screen.getByText(/indexed to 100/)).toBeInTheDocument();
    expect(screen.getByText("FX feed · as of 2026-01-11")).toBeInTheDocument();
    cleanup();
    mockLive = { depreciation1yr: null, asOf: null, series: FIXTURE() };
    renderStory();
    await openPath();
    expect(screen.getByText("FX feed · date unavailable")).toBeInTheDocument();
  });

  it("shows readable endpoint dates and the source index values", async () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    await openPath();
    expect(screen.getByText(/Jan 2026 · 100/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2026 · 120/)).toBeInTheDocument();
    const chart = document.querySelector('svg[viewBox="0 0 100 50"]')!;
    expect(chart.querySelector("line")).not.toBeNull();
    expect(chart.querySelector("circle")).toBeNull();
  });

  it("draws the plot as one plain solid stroke — no dash or draw-in props", async () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    renderStory();
    await openPath();
    const path = document.querySelector('svg[viewBox="0 0 100 50"] path[fill="none"]')!;
    expect(path.getAttribute("stroke-dasharray")).toBeNull();
    expect(path.getAttribute("pathLength")).toBeNull();
    expect(path.getAttribute("style") ?? "").not.toContain("stroke-dasharray");
  });

  it("draws a flat-100 series without degenerate coordinates", async () => {
    mockLive = {
      depreciation1yr: null,
      asOf: "2026-01-11",
      series: FIXTURE({ values: [100, 100, 100] }),
    };
    renderStory();
    await openPath();
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
  ])("renders the honest unavailable line for %s", async (_label, series) => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE(series) };
    renderStory();
    await openPath();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();
  });

  it("renders the unavailable line for a null live read and a null series", async () => {
    renderStory();
    expect(screen.getByText(/Curated history · checked/)).toBeInTheDocument();
    await openPath();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();

    cleanup();
    mockLive = { depreciation1yr: null, asOf: null, series: null };
    renderStory();
    await openPath();
    expect(screen.getByText("Historical path unavailable")).toBeInTheDocument();
    expect(document.querySelector('svg[viewBox="0 0 100 50"]')).toBeNull();
  });
});

describe("CurrencyStoryInspector — event rail", () => {
  it("defaults to the newest event caption with that event pressed, and switches on real buttons", () => {
    renderStory();
    expect(screen.getByRole('heading', { name: 'Record stability' })).toBeInTheDocument();
    expect(screen.getByText(/Pinned near KSh129/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'General Election' })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2025 · Record stability/ }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /2022 · General Election/ }));
    expect(screen.getByRole('heading', { name: 'General Election' })).toBeInTheDocument();
    expect(screen.getByText(/KES dropped 6\.8%/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Record stability' })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2022 · General Election/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("exposes a separate Latest button only when a live anchored signal exists", () => {
    renderStory();
    expect(screen.queryByRole("button", { name: /^Latest/ })).not.toBeInTheDocument();
    cleanup();
    mockSignal = { text: "CBK held the rate", dateLabel: "2d ago" };
    renderStory();
    const latest = screen.getByRole("button", { name: /Latest · CBK held the rate/ });
    fireEvent.click(latest);
    expect(screen.getByText(/CBK held the rate/)).toBeInTheDocument();
    expect(screen.getByText(/Live signal · 2d ago/)).toBeInTheDocument();
    expect(screen.queryByText(/Curated history · checked/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Record stability' })).not.toBeInTheDocument();
  });

  it("falls back to the newest event when the Latest signal disappears", () => {
    mockSignal = { text: "CBK held the rate", dateLabel: "2d ago" };
    const { rerender } = renderStory();
    fireEvent.click(screen.getByRole("button", { name: /Latest · CBK held the rate/ }));
    expect(screen.getByText(/CBK held the rate/)).toBeInTheDocument();

    mockSignal = null;
    rerender(<CurrencyStoryInspector code="KES" onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Latest/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Record stability' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Record stability' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'General Election' })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2022 · General Election/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the curated freshness line, not a feed claim", () => {
    renderStory();
    expect(screen.getByText(/Curated history · checked/)).toBeInTheDocument();
  });

  it("resets the selection and chart on a code change", async () => {
    mockLive = { depreciation1yr: null, asOf: "2026-01-11", series: FIXTURE() };
    const { rerender } = renderStory("KES");
    fireEvent.click(screen.getByRole("button", { name: /2022 · General Election/ }));
    expect(screen.getByRole('heading', { name: 'General Election' })).toBeInTheDocument();

    mockLive = {
      depreciation1yr: null,
      asOf: "2026-01-11",
      series: FIXTURE({ values: [100, 90, 80] }),
    };
    rerender(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    const openSheet = document.querySelector('[data-selected-id="NGN"]')!;
    expect(openSheet.textContent).not.toContain("KES dropped 6.8%");
    expect(openSheet.textContent).toContain("Rate-cut test");
    await openPath();
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
    // The competing replay card is gone — one quiet link is the whole share surface.
    expect(screen.queryByTestId('moment-share-card')).toBeNull();
  });
});

describe("CurrencyStoryInspector — cited news", () => {
  it("renders nothing when there are no headlines", () => {
    renderStory("NGN");
    expect(screen.queryByTestId("currency-news")).toBeNull();
    expect(screen.queryByText(/Headlines via Tavily/)).toBeNull();
  });

  it("lists cited headlines as external links with source and date", async () => {
    mockNews = [
      { title: "Naira steadies", url: "https://reuters.com/a", source: "reuters.com", date: "2026-10-13" },
      { title: "CBN holds rate", url: "https://ft.com/b", source: "ft.com", date: null },
    ];
    renderStory("NGN");
    await openNews();
    const link = screen.getByRole("link", { name: /Naira steadies/ });
    expect(link).toHaveAttribute("href", "https://reuters.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText("reuters.com · 2026-10-13")).toBeInTheDocument();
    expect(screen.getByText("ft.com")).toBeInTheDocument();
    expect(screen.getByText(/Headlines via Tavily/)).toBeInTheDocument();
  });

  it("hands the headlines to Guardian as sources to cite, not forecasts", () => {
    mockNews = [{ title: "Naira steadies", url: "https://reuters.com/a", source: "reuters.com", date: "2026-10-13" }];
    renderStory("NGN");
    fireEvent.click(screen.getByRole("button", { name: /Ask Guardian about the NGN/ }));
    const prompt = mockAskAdvisor.mock.calls[0][0] as string;
    expect(prompt).toContain("1. Naira steadies (reuters.com, 2026-10-13)");
    expect(prompt).toMatch(/do not predict/);
  });

  it("tracks a headline tap once with only the currency and a fixed source, leaving the link to navigate", async () => {
    mockNews = [
      { title: "Naira steadies", url: "https://reuters.com/a", source: "reuters.com", date: "2026-10-13" },
      { title: "CBN holds rate", url: "https://ft.com/b", source: "ft.com", date: null },
    ];
    const { rerender } = render(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    rerender(<CurrencyStoryInspector code="NGN" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Headlines" }));
    await screen.findByRole("link", { name: /Naira steadies/ });
    expect(walkthroughCalls("currency_headline_tapped")).toHaveLength(0);

    const link = screen.getByRole("link", { name: /Naira steadies/ });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);

    expect(walkthroughCalls("currency_headline_tapped")).toEqual([
      ["currency_headline_tapped", { currency: "NGN", source: "currency_story" }],
    ]);
    expect(link).toHaveAttribute("href", "https://reuters.com/a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/reuters|Naira steadies/);
  });

  it("tracks the story Ask Guardian tap once, without the question, keeping close-before-ask", () => {
    mockNews = [{ title: "Naira steadies", url: "https://reuters.com/a", source: "reuters.com", date: "2026-10-13" }];
    const onClose = vi.fn();
    const { rerender } = render(<CurrencyStoryInspector code="NGN" onClose={onClose} />);
    rerender(<CurrencyStoryInspector code="NGN" onClose={onClose} />);
    expect(walkthroughCalls("ask_guardian_tapped")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Ask Guardian about the NGN/ }));
    expect(walkthroughCalls("ask_guardian_tapped")).toEqual([
      ["ask_guardian_tapped", { currency: "NGN", source: "currency_story" }],
    ]);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockAskAdvisor.mock.invocationCallOrder[0],
    );
    expect(mockAskAdvisor.mock.calls[0][0]).toContain("Tell me the story of the NGN");
    expect(JSON.stringify(mockTrack.mock.calls)).not.toMatch(/Tell me|Naira|reuters/);

    fireEvent.click(screen.getByRole("button", { name: /Ask Guardian about the NGN/ }));
    expect(walkthroughCalls("ask_guardian_tapped")).toHaveLength(2);
  });

  it("leaves the Guardian prompt unchanged without headlines", () => {
    renderStory("NGN");
    fireEvent.click(screen.getByRole("button", { name: /Ask Guardian about the NGN/ }));
    expect(mockAskAdvisor.mock.calls[0][0]).not.toContain("Recent headlines");
  });
});

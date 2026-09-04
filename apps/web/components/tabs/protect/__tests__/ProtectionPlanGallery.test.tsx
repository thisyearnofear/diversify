import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const mockSetFinancialStrategy = vi.fn();
const mockRecordActivity = vi.fn(() => Promise.resolve());
let mockStrategy: string | null = null;

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: mockStrategy,
    setFinancialStrategy: mockSetFinancialStrategy,
  }),
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({ recordActivity: mockRecordActivity }),
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: "0xabc", chainId: 42220 }),
}));

vi.mock("@/components/tabs/protect/ProtectionAmbient", () => ({
  useAmbientOrigin: () => ({ reportTapOrigin: vi.fn() }),
}));

vi.mock("@/components/protection-cards/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/protection-cards/tokens")>();
  return {
    ...actual,
    ARCHETYPE_ORDER: ["africapitalism", "buen_vivir"],
  };
});

vi.mock("@/components/protection-cards/cards", () => ({
  CARD_REGISTRY: {
    africapitalism: () => React.createElement("div", { "data-testid": "africa-card" }),
    buen_vivir: () => React.createElement("div", { "data-testid": "buen-vivir-card" }),
  },
}));

import { ProtectionPlanGallery } from "../ProtectionPlanGallery";

function trackOf() {
  const track = document.querySelector<HTMLElement>('[data-testid="flick-row-track"]');
  if (!track) throw new Error("flick-row track not found");
  return track;
}

describe("ProtectionPlanGallery — inspect vs commit", () => {
  beforeEach(() => {
    mockStrategy = null;
    mockSetFinancialStrategy.mockReset();
    mockRecordActivity.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("commits immediately when onInspect is omitted", () => {
    render(<ProtectionPlanGallery />);
    fireEvent.click(screen.getByRole("button", { name: /Select Africapitalism/i }));
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("africapitalism");
    expect(mockRecordActivity).toHaveBeenCalled();
  });

  it("inspects without committing when onInspect is set", () => {
    const onInspect = vi.fn();
    render(<ProtectionPlanGallery onInspect={onInspect} />);
    fireEvent.click(screen.getByRole("button", { name: /Inspect Africapitalism/i }));
    expect(onInspect).toHaveBeenCalledWith("africapitalism");
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});

describe("ProtectionPlanGallery — flick row affordances (§4/§5)", () => {
  beforeEach(() => {
    mockStrategy = null;
    mockSetFinancialStrategy.mockReset();
    mockRecordActivity.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("row is the one scroll idiom: proximity snap, hidden scrollbar, no dead grid branch", () => {
    render(<ProtectionPlanGallery />);
    const track = screen.getByTestId("flick-row-track");
    expect(track.className).toContain("snap-proximity");
    expect(track.className).toContain("scrollbar-hide");
    expect(screen.queryByText(/Same JSX renders here/)).not.toBeInTheDocument();
  });

  it("chevron pages the row and hides at the edges", () => {
    const scrollBy = vi.fn();
    render(<ProtectionPlanGallery />);

    // jsdom has no layout: scrollWidth === clientWidth → both edges "at rest",
    // so neither chevron renders until overflow exists.
    expect(screen.queryByTestId("flick-row-next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flick-row-prev")).not.toBeInTheDocument();

    const track = trackOf();
    // Simulate an overflowing row (as in a real viewport).
    Object.defineProperty(track, "scrollWidth", { value: 1000, configurable: true });
    Object.defineProperty(track, "clientWidth", { value: 400, configurable: true });
    track.scrollBy = scrollBy;
    fireEvent.scroll(track);
    expect(screen.getByTestId("flick-row-next")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flick-row-next"));
    expect(scrollBy).toHaveBeenCalledWith({ left: 276, behavior: "smooth" });

    // Scroll to the far end: next disappears, prev appears.
    Object.defineProperty(track, "scrollLeft", { value: 600, configurable: true });
    fireEvent.scroll(track);
    expect(screen.queryByTestId("flick-row-next")).not.toBeInTheDocument();
    expect(screen.getByTestId("flick-row-prev")).toBeInTheDocument();
  });

  it("a mouse drag does not select the card under the release point", () => {
    render(<ProtectionPlanGallery />);
    const track = trackOf();
    const card = screen.getByRole("button", { name: /Select Africapitalism/i });

    fireEvent.pointerDown(track, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: "mouse", clientX: 90 });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: "mouse", clientX: 60 }); // past dead zone
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: "mouse", clientX: 60 });
    // The click the browser would fire on the card after the drag:
    fireEvent.click(card);

    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
  });

  it("a new press after a drag revokes the suppression — the next click selects", () => {
    render(<ProtectionPlanGallery />);
    const track = trackOf();
    const card = screen.getByRole("button", { name: /Select Africapitalism/i });

    // Drag completes; the click the browser fires on release is swallowed.
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: "mouse", clientX: 60 });
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: "mouse", clientX: 60 });
    fireEvent.click(card);
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();

    // A new interaction begins (press) — the stale trap is revoked, so the
    // click that follows it is a genuine choice.
    fireEvent.pointerDown(track, { pointerId: 2, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.click(card);
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("africapitalism");
  });
});

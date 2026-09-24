// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GuardianObject } from "../GuardianObject";
import type { GuardianTierState } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import { GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
} from "@diversifi/shared/src/types/guardian-protection";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";

vi.mock("@/components/shared/GuardianMascot", () => ({
  GuardianMascot: (props: { mood?: string }) => (
    <div data-testid="guardian-mascot" data-mood={props.mood} />
  ),
}));

const sessionInfo = (over: Partial<GuardianSessionInfo> = {}): GuardianSessionInfo =>
  ({
    active: true,
    dailyLimitUSD: 25,
    spentTodayUSD: 5,
    remainingTodayUSD: 20,
    executionCount: 3,
    recentExecutions: [],
    ...over,
  }) as GuardianSessionInfo;

function renderObject(overrides: Partial<Parameters<typeof GuardianObject>[0]> = {}) {
  const props = {
    guardianState: "monitoring" as GuardianTierState,
    isAnalyzing: false,
    sessionInfo: null,
    hasValidPermission: false,
    dailyLimit: 0,
    latestEvent: null,
    latestCall: null,
    ctaLabel: null,
    onCta: vi.fn(),
    onOpenJournal: vi.fn(),
    onOpenBounds: vi.fn(),
    ...overrides,
  };
  render(<GuardianObject {...props} />);
  return props;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("GuardianObject — state copy", () => {
  it.each(["idle", "authorized", "funded", "monitoring"] as const)(
    "renders the %s headline and its lifecycle badge",
    (state) => {
      renderObject({ guardianState: state });
      expect(
        screen.getByText(GUARDIAN_USER_COPY[state].headline),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          PROTECTION_STATE_LABELS[deriveProtectionLifecycleState(state)],
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(GUARDIAN_USER_COPY[state].description),
      ).toBeInTheDocument();
    },
  );

  it("analyzing swaps the mascot mood to thinking", () => {
    renderObject({ isAnalyzing: true });
    expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "thinking");
  });

  it("renders no ring — the budget is a sentence, not a dial", () => {
    renderObject({
      hasValidPermission: true,
      sessionInfo: sessionInfo(),
      dailyLimit: 25,
    });
    expect(document.querySelector("[class*='AllocationRing'], [data-testid*='ring']")).toBeNull();
  });
});

describe("GuardianObject — budget line", () => {
  it("shows $X left of $Y today only with permission + session + limit, and opens bounds", () => {
    const props = renderObject({
      hasValidPermission: true,
      sessionInfo: sessionInfo(),
      dailyLimit: 25,
    });
    const budget = screen.getByTestId("guardian-budget");
    expect(budget).toHaveTextContent("$20.00 left of $25 today");
    fireEvent.click(budget);
    expect(props.onOpenBounds).toHaveBeenCalledTimes(1);
  });

  it.each([
    { hasValidPermission: false, sessionInfo: sessionInfo(), dailyLimit: 25 },
    { hasValidPermission: true, sessionInfo: null, dailyLimit: 25 },
    { hasValidPermission: true, sessionInfo: sessionInfo(), dailyLimit: 0 },
  ])("stays hidden without the full trio", (over) => {
    renderObject(over as never);
    expect(screen.queryByTestId("guardian-budget")).not.toBeInTheDocument();
  });
});

describe("GuardianObject — latest line + CTA", () => {
  it("prefers the proof event over the call line and opens the journal", () => {
    const props = renderObject({
      latestEvent: {
        id: "e1",
        source: "vault",
        title: "Auto-Saver swap",
        subtitle: "USDC -> KESm · $10",
        timestamp: Date.now() - 60_000,
        status: "confirmed",
      },
      latestCall: "rotate to KESm",
    });
    const latest = screen.getByTestId("guardian-latest");
    expect(latest).toHaveTextContent("Auto-Saver swap · USDC -> KESm · $10");
    expect(latest).not.toHaveTextContent("Latest call:");
    fireEvent.click(latest);
    expect(props.onOpenJournal).toHaveBeenCalledTimes(1);
  });

  it("falls back to the latest call when no event exists", () => {
    renderObject({ latestCall: "rotate to KESm" });
    expect(screen.getByTestId("guardian-latest")).toHaveTextContent(
      "Latest call: rotate to KESm",
    );
  });

  it("renders no latest line when neither exists", () => {
    renderObject();
    expect(screen.queryByTestId("guardian-latest")).not.toBeInTheDocument();
  });

  it("fires onCta and hides when the label is null", () => {
    const props = renderObject({ ctaLabel: "Set up Auto-Saver" });
    fireEvent.click(screen.getByRole("button", { name: "Set up Auto-Saver" }));
    expect(props.onCta).toHaveBeenCalledTimes(1);
    cleanup();
    renderObject({ ctaLabel: null });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("GuardianObject — word budget", () => {
  it("a monitoring render with event + budget stays under 45 words", () => {
    renderObject({
      hasValidPermission: true,
      sessionInfo: sessionInfo(),
      dailyLimit: 25,
      latestEvent: {
        id: "e1",
        source: "vault",
        title: "Auto-Saver swap",
        subtitle: "USDC -> KESm · $10",
        timestamp: Date.now() - 60_000,
        status: "confirmed",
      },
      ctaLabel: "Preview next move",
    });
    const words = (document.body.textContent ?? "")
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(45);
  });
});

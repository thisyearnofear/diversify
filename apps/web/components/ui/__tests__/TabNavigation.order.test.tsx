// @vitest-environment jsdom
/**
 * Fixed dock order — the dock is always TAB_IDS clipped by visibility.
 * Personas never reorder it: no adaptive config can move Home ahead of
 * Shield or Guardian ahead of Exchange.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const m = vi.hoisted(() => ({
  adaptiveConfig: null as unknown,
  showHint: false,
  visitedTabs: [] as string[],
}));

vi.mock("framer-motion", () => {
  const MotionButton = React.forwardRef((props: any, ref: any) => {
    const { animate, transition, whileTap, ...rest } = props;
    return React.createElement("button", { ...rest, ref });
  });
  MotionButton.displayName = "MotionButton";
  const MotionSpan = (props: any) => {
    const { layoutId, ...rest } = props;
    return React.createElement("span", rest);
  };
  const MotionDiv = (props: any) => {
    const { animate, transition, ...rest } = props;
    return React.createElement("div", rest);
  };
  return {
    motion: { button: MotionButton, span: MotionSpan, div: MotionDiv },
    useReducedMotion: () => false,
  };
});

vi.mock("@/context/app/AdaptiveContext", () => ({
  useAdaptiveContext: () => ({ config: m.adaptiveConfig }),
}));

vi.mock("@/hooks/use-tab-discovery", () => ({
  useTabDiscovery: () => ({
    recordTabVisit: vi.fn(),
    recordTabBar: vi.fn(),
    recordSwipe: vi.fn(),
    showHint: m.showHint,
    visitedTabs: m.visitedTabs,
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tap: vi.fn() },
}));

vi.mock("@/components/shared/StreakNavBadge", () => ({
  StreakNavBadge: () => React.createElement("div", null),
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({ streak: null, canClaim: false, isLoading: false }),
}));

import TabNavigation, { DesktopRail } from "../TabNavigation";

/** A config whose routing disagrees with the canonical order — personas
 *  used to reorder the dock; now they must not. */
const BUSINESS_CONFIG = {
  persona: "ghanaian_importer",
  content: {
    shieldMorph: "cycle",
    contextualBanner: "fx-drag-warning",
  },
};

afterEach(() => {
  cleanup();
  m.adaptiveConfig = null;
  m.showHint = false;
  m.visitedTabs = [];
});

describe("TabNavigation — fixed dock order", () => {
  it("renders TAB_IDS order on the desktop rail regardless of adaptive config", () => {
    m.adaptiveConfig = BUSINESS_CONFIG;
    render(<DesktopRail activeTab="protect" setActiveTab={vi.fn()} experienceMode="full" />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["Shield", "Home", "Exchange", "Guardian"]);
  });

  it("renders TAB_IDS order on the mobile bar regardless of adaptive config", () => {
    m.adaptiveConfig = BUSINESS_CONFIG;
    render(<TabNavigation activeTab="protect" setActiveTab={vi.fn()} experienceMode="full" />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["Shield", "Home", "Exchange", "Guardian"]);
  });

  it("shows the first-use cue on Shield while Home is active and Shield is unvisited, even after the tab bar was used", () => {
    m.showHint = false;
    render(<TabNavigation activeTab="overview" setActiveTab={vi.fn()} experienceMode="full" />);
    const shield = screen.getByRole("tab", { name: /Shield/ });
    expect(shield.querySelector('[data-testid="shield-first-use-cue"]')).not.toBeNull();
    expect(shield).toHaveAttribute("title", "Explore protection");
    expect(screen.getByRole("tab", { name: /Home/ }).querySelector('[data-testid="shield-first-use-cue"]')).toBeNull();
  });

  it("drops the Shield cue once Shield has been visited", () => {
    m.showHint = true;
    m.visitedTabs = ["protect"];
    render(<TabNavigation activeTab="overview" setActiveTab={vi.fn()} experienceMode="full" />);
    expect(document.querySelector('[data-testid="shield-first-use-cue"]')).toBeNull();
  });

  it("simple clips to three tabs in the same order", () => {
    m.adaptiveConfig = BUSINESS_CONFIG;
    render(<TabNavigation activeTab="protect" setActiveTab={vi.fn()} experienceMode="simple" />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["Shield", "Home", "Exchange"]);
  });
});

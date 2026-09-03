// @vitest-environment jsdom
/**
 * DesktopRail dock magnification — Sylva's spring dock, desktop-pointer-only.
 *
 * framer-motion is stubbed with a RECORDING motion.button: every render
 * pushes the `animate` prop it received into `m.animateCalls`, so the
 * assertions inspect exactly what the dock asked framer to animate.
 *
 * Contract:
 *  - no hover-capable pointer (touch) → dock off, animate stays undefined
 *  - fine pointer → hovering a tab animates scale 1.18 / y −4 on it,
 *    scale 1.05 on neighbors
 *  - reduced motion → dock off even with a fine pointer
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const m = vi.hoisted(() => ({
  animateCalls: [] as unknown[],
  useReducedMotion: vi.fn(() => false as boolean | null),
}));

vi.mock("framer-motion", () => {
  const MotionButton = React.forwardRef((props: any, ref: any) => {
    m.animateCalls.push(props.animate);
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
    useReducedMotion: m.useReducedMotion,
  };
});

vi.mock("@/context/app/AdaptiveContext", () => ({
  useAdaptiveContext: () => ({ config: null }),
}));

vi.mock("@/hooks/use-tab-discovery", () => ({
  useTabDiscovery: () => ({
    recordTabVisit: vi.fn(),
    recordTabBar: vi.fn(),
    recordSwipe: vi.fn(),
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tap: vi.fn() },
}));

vi.mock("../TabNavHint", () => ({
  TabNavHint: () => React.createElement("div", null),
}));

vi.mock("@/components/shared/StreakNavBadge", () => ({
  StreakNavBadge: () => React.createElement("div", { "data-testid": "streak-nav-badge-mock" }),
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({ streak: null, canClaim: false, isLoading: false }),
}));

import { DesktopRail } from "../TabNavigation";

function matchMedia(matches: boolean) {
  return vi.fn().mockReturnValue({
    matches,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

beforeEach(() => {
  m.animateCalls.length = 0;
  m.useReducedMotion.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DesktopRail — dock magnification", () => {
  it("stays flat when the pointer is not hover-capable (touch)", () => {
    vi.stubGlobal("matchMedia", matchMedia(false));
    render(<DesktopRail activeTab="overview" setActiveTab={vi.fn()} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    m.animateCalls.length = 0;

    fireEvent.mouseEnter(tabs[1]);
    // Dock disabled → no re-render, no animate prop anywhere.
    expect(m.animateCalls.every((c) => c === undefined)).toBe(true);
  });

  it("magnifies the hovered tab and leans neighbors in", () => {
    vi.stubGlobal("matchMedia", matchMedia(true));
    render(<DesktopRail activeTab="overview" setActiveTab={vi.fn()} />);

    m.animateCalls.length = 0;
    fireEvent.mouseEnter(screen.getAllByRole("tab")[2]);

    // All tabs re-render; the hovered one gets the dock pose.
    expect(m.animateCalls).toContainEqual(
      expect.objectContaining({ scale: 1.18, y: -4 }),
    );
    // Neighbors get the lean-in pose, never the full dock pose.
    expect(m.animateCalls).toContainEqual(
      expect.objectContaining({ scale: 1.05, y: 0 }),
    );
  });

  it("is flat under reduced motion even with a fine pointer", () => {
    m.useReducedMotion.mockReturnValue(true);
    vi.stubGlobal("matchMedia", matchMedia(true));
    render(<DesktopRail activeTab="overview" setActiveTab={vi.fn()} />);

    m.animateCalls.length = 0;
    fireEvent.mouseEnter(screen.getAllByRole("tab")[0]);

    expect(m.animateCalls.every((c) => c === undefined)).toBe(true);
  });
});

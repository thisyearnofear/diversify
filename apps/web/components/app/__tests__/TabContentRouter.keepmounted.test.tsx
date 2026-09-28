// @vitest-environment jsdom
/**
 * Keep-mounted Home — the Overview pane never unmounts (prod), so returning
 * to Home is instant: no refetch, no skeleton, no count-up replay.
 *
 * The production code gates on NODE_ENV !== "test" so vitest suites exercise
 * the classic unmount path with framer stubs. These tests drive NODE_ENV
 * both ways to cover BOTH paths, and the NEXT_PUBLIC_KEEP_MOUNTED_HOME=false
 * kill switch. next/dynamic is faked per-specifier so each tab renders a
 * distinct testid.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const m = vi.hoisted(() => ({
  ctx: { value: null as any },
}));

vi.mock("framer-motion", () => {
  const MotionDiv = React.forwardRef((props: any, ref: any) => {
    const { animate, initial, exit, transition, drag, dragConstraints, dragElastic, onPanEnd, ...rest } = props;
    return React.createElement("div", { ...rest, ref });
  });
  MotionDiv.displayName = "MotionDiv";
  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: any) =>
      React.createElement("div", null, children),
    useReducedMotion: () => false,
  };
});

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    const src = String(loader);
    const name = src.includes("OverviewTab")
      ? "overview-tab"
      : src.includes("ProtectionTab")
        ? "protect-tab"
        : src.includes("ExchangeTab")
          ? "exchange-tab"
          : src.includes("AgentTab")
            ? "agent-tab"
            : "unknown-tab";
    const C = (props: { isActive?: boolean }) =>
      React.createElement(
        "div",
        {
          "data-testid": name,
          ...(name === "overview-tab" ? { "data-active": String(props?.isActive) } : {}),
        },
        name,
      );
    C.displayName = name;
    return C;
  },
}));

const mockRouter = vi.hoisted(() => ({
  query: {} as Record<string, string>,
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: mockRouter.query }),
}));

vi.mock("@/context/app/AppShellContext", () => ({
  useAppShellContext: () => m.ctx.value,
}));

vi.mock("@/hooks/use-tab-discovery", () => ({
  useTabDiscovery: () => ({ recordSwipe: vi.fn(), recordTabVisit: vi.fn() }),
}));

vi.mock("@/components/ui/PullToRefresh", () => ({
  default: ({ children }: any) => React.createElement("div", null, children),
}));

vi.mock("@/components/ui/ErrorBoundary", () => ({
  default: ({ children }: any) => React.createElement("div", null, children),
}));

vi.mock("@/components/agent/GuardianStreakWidget", () => ({
  GuardianStreakWidget: () => React.createElement("div", { "data-testid": "streak" }),
}));

vi.mock("@/components/ui/Skeleton", () => ({
  TabSkeleton: () => React.createElement("div", null),
}));

import TabContentRouter from "../TabContentRouter";

function makeContext(activeTab: string, extras: Record<string, unknown> = {}) {
  return {
    activeTab,
    setActiveTab: vi.fn(),
    setExperienceMode: vi.fn(),
    trackTabChange: vi.fn(),
    experienceMode: "advanced",
    hydrated: true,
    multichainPortfolio: null,
    isMultichainLoading: false,
    refresh: vi.fn(),
    isRegionLoading: false,
    userRegion: null,
    setUserRegion: vi.fn(),
    REGIONS: [],
    inflationData: {},
    currencyPerformanceData: undefined,
    walletChainId: null,
    isMiniPay: false,
    isFarcaster: false,
    ...extras,
  };
}

/** Mutable view of env — NODE_ENV is typed readonly on process.env. */
const env = process.env as {
  NODE_ENV?: string;
  NEXT_PUBLIC_KEEP_MOUNTED_HOME?: string;
};

const REAL_NODE_ENV = env.NODE_ENV;

beforeEach(() => {
  env.NODE_ENV = REAL_NODE_ENV;
  delete env.NEXT_PUBLIC_KEEP_MOUNTED_HOME;
  mockRouter.query = {};
});

afterEach(() => {
  env.NODE_ENV = REAL_NODE_ENV;
  delete env.NEXT_PUBLIC_KEEP_MOUNTED_HOME;
  cleanup();
});

describe("TabContentRouter — keep-mounted Home", () => {
  it("unmounts the old tab when keep-mounted is off (the test-env default)", () => {
    m.ctx.value = makeContext("overview");
    const { rerender } = render(<TabContentRouter />);
    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();

    m.ctx.value = makeContext("protect");
    rerender(<TabContentRouter />);
    expect(screen.getByTestId("protect-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-tab")).not.toBeInTheDocument();
  });

  it("keeps Home mounted but hidden when switching away (keep-mounted on)", () => {
    env.NODE_ENV = "production";
    m.ctx.value = makeContext("overview");
    const { rerender } = render(<TabContentRouter />);
    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();
    expect(screen.getByTestId("overview-tab")).toHaveAttribute("data-active", "true");

    m.ctx.value = makeContext("protect");
    rerender(<TabContentRouter />);

    // New tab renders…
    expect(screen.getByTestId("protect-tab")).toBeInTheDocument();
    // …and Home survives, hidden from interaction and the a11y tree.
    const homePane = screen
      .getByTestId("overview-tab")
      .closest("[data-keep-mounted='overview']");
    expect(homePane).not.toBeNull();
    expect(homePane).toHaveAttribute("aria-hidden", "true");
    expect(homePane).toHaveStyle({ pointerEvents: "none" });
    expect(screen.getByTestId("overview-tab")).toHaveAttribute("data-active", "false");

    // Coming back shows the SAME mounted instance (state preserved).
    m.ctx.value = makeContext("overview");
    rerender(<TabContentRouter />);
    const homeAgain = screen.getByTestId("overview-tab");
    expect(homeAgain.closest("[data-keep-mounted='overview']")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    expect(homeAgain).toHaveAttribute("data-active", "true");
  });

  it("mounts Home inactive when the app opens on another tab (keep-mounted on)", () => {
    env.NODE_ENV = "production";
    m.ctx.value = makeContext("protect");
    render(<TabContentRouter />);
    expect(screen.getByTestId("protect-tab")).toBeInTheDocument();
    expect(screen.getByTestId("overview-tab")).toHaveAttribute("data-active", "false");
  });

  it("respects the NEXT_PUBLIC_KEEP_MOUNTED_HOME=false kill switch", () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_KEEP_MOUNTED_HOME = "false";
    m.ctx.value = makeContext("overview");
    const { rerender } = render(<TabContentRouter />);
    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();

    m.ctx.value = makeContext("agent");
    rerender(<TabContentRouter />);
    expect(screen.getByTestId("agent-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-tab")).not.toBeInTheDocument();
  });
});

describe("TabContentRouter — fixed dock order + Guardian promotion", () => {
  it("beginner + requested Guardian promotes to intermediate — no bounce", () => {
    const setActiveTab = vi.fn();
    const setExperienceMode = vi.fn();
    m.ctx.value = makeContext("agent", {
      experienceMode: "beginner",
      setActiveTab,
      setExperienceMode,
    });
    render(<TabContentRouter />);
    // The hand-off promotes the dock instead of bouncing to the first tab.
    expect(setExperienceMode).toHaveBeenCalledWith("intermediate");
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("?tab=agent counts as a request even when beginner hides Guardian", () => {
    mockRouter.query = { tab: "agent" };
    const setActiveTab = vi.fn();
    const setExperienceMode = vi.fn();
    m.ctx.value = makeContext("overview", {
      experienceMode: "beginner",
      setActiveTab,
      setExperienceMode,
    });
    render(<TabContentRouter />);
    // The URL request lands the tab switch; the promotion itself is the
    // hidden-tab effect (covered above once activeTab is agent).
    expect(setActiveTab).toHaveBeenCalledWith("agent");
  });

  it("pre-hydration beginner mode neither promotes nor bounces — the saved mode may still be advanced", () => {
    const setActiveTab = vi.fn();
    const setExperienceMode = vi.fn();
    m.ctx.value = makeContext("agent", {
      experienceMode: "beginner",
      hydrated: false,
      setActiveTab,
      setExperienceMode,
    });
    render(<TabContentRouter />);
    expect(setExperienceMode).not.toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("hydration landing on advanced keeps Guardian without any calls", () => {
    const setActiveTab = vi.fn();
    const setExperienceMode = vi.fn();
    m.ctx.value = makeContext("agent", {
      experienceMode: "beginner",
      hydrated: false,
      setActiveTab,
      setExperienceMode,
    });
    const { rerender } = render(<TabContentRouter />);

    // The saved mode hydrates as advanced — agent is visible, nothing fires.
    m.ctx.value = makeContext("agent", {
      experienceMode: "advanced",
      setActiveTab,
      setExperienceMode,
    });
    rerender(<TabContentRouter />);
    expect(setExperienceMode).not.toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
    expect(screen.getByTestId("agent-tab")).toBeInTheDocument();
  });

  it("a non-agent hidden tab still falls back to the first dock tab", () => {
    const setActiveTab = vi.fn();
    m.ctx.value = makeContext("info", {
      experienceMode: "beginner",
      setActiveTab,
    });
    render(<TabContentRouter />);
    expect(setActiveTab).toHaveBeenCalledWith("protect");
    expect(screen.queryByTestId("agent-tab")).not.toBeInTheDocument();
  });

  it("still renders Exchange in beginner mode", () => {
    m.ctx.value = makeContext("exchange", { experienceMode: "beginner" });
    render(<TabContentRouter />);
    expect(screen.getByTestId("exchange-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-tab")).not.toBeInTheDocument();
  });
});

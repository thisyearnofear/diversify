import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) =>
    React.createElement("div", null, children),
  motion: {
    div: React.forwardRef((props: any, ref: any) =>
      React.createElement("div", { ...props, ref }),
    ),
    button: React.forwardRef((props: any, ref: any) => {
      const { whileHover, whileTap, animate, initial, transition, key, ...rest } = props;
      return React.createElement("button", { ...rest, ref });
    }),
    span: React.forwardRef((props: any, ref: any) => {
      const { animate, initial, transition, ...rest } = props;
      return React.createElement("span", { ...rest, ref });
    }),
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    const Dummy = () => React.createElement("div", null, "DynamicComponent");
    Dummy.displayName = "DynamicMock";
    return Dummy;
  },
}));

vi.mock("@/components/app/AppHeader", () => ({
  default: () => React.createElement("div", { "data-testid": "app-header" }),
}));

vi.mock("@/components/ui/TabNavigation", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "tab-navigation" }),
}));

vi.mock("@/components/ui/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/tour/GuidedTour", () => ({
  default: () => null,
}));

vi.mock("@/components/tour/TourTrigger", () => ({
  default: () => null,
}));

vi.mock("@/components/agent/GuardianStreakWidget", () => ({
  GuardianStreakWidget: () => null,
}));

vi.mock("@/components/wallet/WalletTutorial", () => ({
  WalletTutorial: () => null,
}));

vi.mock("@/components/ui/PullToRefresh", () => ({
  default: ({
    children,
  }: {
    children: React.ReactNode;
    onRefresh: () => void;
  }) => React.createElement("div", null, children),
}));

vi.mock("@/components/tabs/OverviewTab", () => ({
  default: () => React.createElement("div", { "data-testid": "overview-tab" }),
}));

vi.mock("@/components/tabs/ProtectionTab", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "protection-tab" }),
}));

vi.mock("@/components/tabs/ExchangeTab", () => ({
  default: () =>
    React.createElement("div", { "data-testid": "exchange-tab" }),
}));

vi.mock("@/components/tabs/AgentTab", () => ({
  default: () => React.createElement("div", { "data-testid": "agent-tab" }),
}));

vi.mock("@/components/tabs/InfoTab", () => ({
  default: () => React.createElement("div", { "data-testid": "info-tab" }),
}));

vi.mock("@/hooks/use-app-shell", () => ({
  useAppShell: vi.fn(),
}));

import AppShell from "../AppShell";
import { useAppShell } from "@/hooks/use-app-shell";

const mockUseAppShell = useAppShell as ReturnType<typeof vi.fn>;

const baseShellState = {
  activeTab: "overview",
  setActiveTab: vi.fn(),
  trackTabChange: vi.fn(),
  experienceMode: "advanced",
  setExperienceMode: vi.fn(),
  address: null,
  isWhitelisted: false,
  isMiniPay: false,
  isFarcaster: false,
  walletChainId: null,
  connectWallet: vi.fn(),
  openAdvisor: vi.fn(),
  unreadCount: 0,
  multichainPortfolio: {
    totalValue: 0,
    chainCount: 0,
    chains: [],
    regionData: [],
    isLoading: false,
    isStale: false,
    rebalancingOpportunities: [],
    diversificationScore: 0,
    weightedInflationRisk: 0,
    tokenCount: 0,
    refresh: vi.fn(),
  },
  isRegionLoading: false,
  userRegion: "USA",
  setUserRegion: vi.fn(),
  REGIONS: ["USA", "Africa", "Europe"],
  inflationData: {},
  isMultichainLoading: false,
  refresh: vi.fn(),
  currencyPerformanceData: undefined,
  availableTokens: [],
  openWalletTutorial: vi.fn(),
  closeTutorial: vi.fn(),
  isTutorialOpen: false,
  handleTranscription: vi.fn(),
};

describe("AppShell AI Chat FAB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppShell.mockReturnValue({ ...baseShellState });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the AI Chat FAB button", () => {
    render(<AppShell />);

    expect(screen.getByLabelText("Ask Guardian — chat with your AI")).toBeInTheDocument();
  });

  it("calls openAdvisor when FAB is clicked", () => {
    const openAdvisor = vi.fn();
    mockUseAppShell.mockReturnValue({ ...baseShellState, openAdvisor });

    render(<AppShell />);

    fireEvent.click(screen.getByLabelText("Ask Guardian — chat with your AI"));
    expect(openAdvisor).toHaveBeenCalled();
  });

  it("shows unread count badge when unreadCount > 0", () => {
    mockUseAppShell.mockReturnValue({ ...baseShellState, unreadCount: 5 });

    render(<AppShell />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 9+ badge for counts over 9", () => {
    mockUseAppShell.mockReturnValue({ ...baseShellState, unreadCount: 15 });

    render(<AppShell />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("does not show badge when unreadCount is 0", () => {
    mockUseAppShell.mockReturnValue({ ...baseShellState, unreadCount: 0 });

    render(<AppShell />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the robot emoji in the FAB", () => {
    render(<AppShell />);

    const button = screen.getByLabelText("Ask Guardian — chat with your AI");
    expect(button.textContent).toContain("💬");
  });
});

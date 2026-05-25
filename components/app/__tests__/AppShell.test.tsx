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

import AppShell from "../AppShell";

const EMPTY_PORTFOLIO = {
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
} as any;

const defaultProps = {
  activeTab: "overview" as const,
  setActiveTab: vi.fn(),
  trackTabChange: vi.fn(),
  experienceMode: "advanced" as const,
  setExperienceMode: vi.fn(),
  address: null,
  isWhitelisted: false,
  isMiniPay: false,
  isFarcaster: false,
  walletChainId: null,
  connectWallet: vi.fn(),
  openAdvisor: vi.fn(),
  unreadCount: 0,
  multichainPortfolio: EMPTY_PORTFOLIO,
  isRegionLoading: false,
  userRegion: "USA" as const,
  setUserRegion: vi.fn(),
  REGIONS: ["USA", "Africa", "Europe"] as const,
  inflationData: {},
  isMultichainLoading: false,
  refresh: vi.fn(),
  availableTokens: [],
  openWalletTutorial: vi.fn(),
  closeTutorial: vi.fn(),
  isTutorialOpen: false,
  handleTranscription: vi.fn(),
};

describe("AppShell AI Chat FAB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the AI Chat FAB button", () => {
    render(<AppShell {...defaultProps} />);

    expect(screen.getByLabelText("Ask Guardian — chat with your AI")).toBeInTheDocument();
  });

  it("calls openAdvisor when FAB is clicked", () => {
    const openAdvisor = vi.fn();

    render(<AppShell {...defaultProps} openAdvisor={openAdvisor} />);

    fireEvent.click(screen.getByLabelText("Ask Guardian — chat with your AI"));
    expect(openAdvisor).toHaveBeenCalled();
  });

  it("shows unread count badge when unreadCount > 0", () => {
    render(<AppShell {...defaultProps} unreadCount={5} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 9+ badge for counts over 9", () => {
    render(<AppShell {...defaultProps} unreadCount={15} />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("does not show badge when unreadCount is 0", () => {
    render(<AppShell {...defaultProps} unreadCount={0} />);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the robot emoji in the FAB", () => {
    render(<AppShell {...defaultProps} />);

    const button = screen.getByLabelText("Ask Guardian — chat with your AI");
    expect(button.textContent).toContain("💬");
  });
});

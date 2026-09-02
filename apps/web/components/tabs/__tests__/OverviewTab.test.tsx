import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

let mockAddress: string | null = "0xabc";
let mockIsConnecting = false;
let mockDemoActive = false;
const mockEnableDemo = vi.fn();
const mockDisableDemo = vi.fn();

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({
    address: mockAddress,
    isConnecting: mockIsConnecting,
    chainId: 42220,
  }),
}));

vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({
    demoMode: { isActive: mockDemoActive, mockAddress: "0xDemo", mockChainId: 42220 },
    enableDemoMode: mockEnableDemo,
    disableDemoMode: mockDisableDemo,
  }),
}));

vi.mock("@/components/tabs/overview/NotConnectedState", () => ({
  NotConnectedState: () => <div data-testid="not-connected" />,
}));
vi.mock("@/components/tabs/overview/ConnectingState", () => ({
  ConnectingState: () => <div data-testid="connecting" />,
}));
vi.mock("@/components/tabs/overview/ConnectedOverview", () => ({
  ConnectedOverview: ({ isDemo }: { isDemo: boolean }) => (
    <div data-testid="connected-overview" data-demo={String(isDemo)} />
  ),
}));
vi.mock("@/components/ui/skeletons/OverviewSkeleton", () => ({
  default: () => <div data-testid="overview-skeleton" />,
}));

import OverviewTab from "../OverviewTab";

function emptyPortfolio(overrides: Partial<MultichainPortfolio> = {}): MultichainPortfolio {
  return {
    totalValue: 0,
    isLoading: false,
    lastUpdated: null,
    chainCount: 0,
    chains: [],
    regionData: [],
    errors: [],
    isStale: false,
    ...overrides,
  } as MultichainPortfolio;
}

const baseProps = {
  isRegionLoading: false,
  userRegion: "USA" as const,
  setUserRegion: vi.fn(),
  REGIONS: ["USA", "Africa"] as const,
  setActiveTab: vi.fn(),
};

describe("OverviewTab — connected wallet vs preview", () => {
  beforeEach(() => {
    mockAddress = "0xabc";
    mockIsConnecting = false;
    mockDemoActive = false;
    mockEnableDemo.mockClear();
    mockDisableDemo.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not auto-enable demo while balances have not settled", () => {
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio({ lastUpdated: null, isLoading: false, totalValue: 0 })}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId("overview-skeleton")).toBeInTheDocument();
    expect(mockEnableDemo).not.toHaveBeenCalled();
    expect(screen.queryByTestId("connected-overview")).not.toBeInTheDocument();
  });

  it("does not auto-enable demo after a settled empty fetch — cold-start, not preview", async () => {
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio({ lastUpdated: Date.now(), isLoading: false, totalValue: 0 })}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId("connected-overview")).toHaveAttribute("data-demo", "false");
    await waitFor(() => {
      expect(mockEnableDemo).not.toHaveBeenCalled();
    });
  });

  it("exits opt-in demo when real holdings arrive", async () => {
    mockDemoActive = true;
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio({
          lastUpdated: Date.now(),
          isLoading: false,
          totalValue: 500,
        })}
        isLoading={false}
      />,
    );

    await waitFor(() => {
      expect(mockDisableDemo).toHaveBeenCalled();
    });
  });

  it("stays on the wait until a balance snapshot exists — never times out into empty Home", async () => {
    vi.useFakeTimers();
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio({ lastUpdated: null, isLoading: true, totalValue: 0 })}
        isLoading
      />,
    );
    expect(screen.getByTestId("overview-skeleton")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(screen.getByTestId("overview-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("connected-overview")).not.toBeInTheDocument();
    expect(mockEnableDemo).not.toHaveBeenCalled();
  });

  it("shows Home during a refresh once a snapshot already exists", () => {
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio({ lastUpdated: Date.now(), isLoading: true, totalValue: 40 })}
        isLoading
      />,
    );
    expect(screen.getByTestId("connected-overview")).toBeInTheDocument();
    expect(screen.queryByTestId("overview-skeleton")).not.toBeInTheDocument();
  });

  it("shows the unconnected state when there is no wallet and demo is off", () => {
    mockAddress = null;
    render(
      <OverviewTab
        {...baseProps}
        portfolio={emptyPortfolio()}
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("not-connected")).toBeInTheDocument();
  });
});

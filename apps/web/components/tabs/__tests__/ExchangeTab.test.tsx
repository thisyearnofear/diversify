import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: {} }),
}));

let mockAddress: string | null = "0xabc";

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: mockAddress }),
}));

vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    swapPrefill: null,
    setSwapPrefill: vi.fn(),
  }),
}));

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({ financialStrategy: "africapitalism" }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: { moneyPurpose: "savings" },
  }),
}));

vi.mock("@/context/app/PortfolioContext", () => ({
  usePortfolio: () => null,
}));

const mockEnableDemo = vi.fn();

vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({ enableDemoMode: mockEnableDemo }),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => null,
}));

vi.mock("@/components/business/CaribbeanFxNetCard", () => ({
  CaribbeanFxNetCard: () => React.createElement("div", { "data-testid": "caribbean-fx" }),
}));

vi.mock("@/components/swap/RouteSchematic", () => ({
  default: ({ fromToken, toToken }: { fromToken: string; toToken: string }) =>
    React.createElement("div", { "data-testid": "route-schematic" }, `${fromToken}-${toToken}`),
  RouteSchematic: ({ fromToken, toToken }: { fromToken: string; toToken: string }) =>
    React.createElement("div", { "data-testid": "route-schematic" }, `${fromToken}-${toToken}`),
}));

vi.mock("../SwapTab", () => ({
  default: ({
    instrument,
    onInspectQuote,
  }: {
    instrument?: boolean;
    onInspectQuote?: (from: string, to: string) => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "swap-tab" },
      instrument ? "instrument" : "chrome",
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "quote-row",
          onClick: () => onInspectQuote?.("cUSD", "USDC"),
        },
        "quote",
      ),
    ),
}));

vi.mock("@/components/earn/BestYieldCard", () => ({
  BestYieldCard: () => React.createElement("div", { "data-testid": "best-yield-card" }),
}));

import ExchangeTab from "../ExchangeTab";

describe("ExchangeTab — instrument", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "0xabc";
  });

  it("mounts the ticket as the object, with no extra inspect button or yield card", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    expect(screen.getByTestId("exchange-swap-object")).toBeInTheDocument();
    expect(screen.getByText("instrument")).toBeInTheDocument();
    expect(screen.queryByText("Inspect route and settlement")).not.toBeInTheDocument();
    expect(screen.queryByTestId("best-yield-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("unconnected: the ticket is still the object — no card stack", () => {
    mockAddress = null;
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    // The swap ticket renders as the object (SwapTab handles the
    // walletless morph internally — its CTA becomes the connect button).
    expect(screen.getByTestId("exchange-swap-object")).toBeInTheDocument();
    expect(screen.getByText("instrument")).toBeInTheDocument();
    // The old marketing stack is gone: no hero card, no how-it-works.
    expect(screen.queryByText("Protect your savings")).not.toBeInTheDocument();
    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
  });

  it("unconnected: demo entry is a quiet text link in the status tier", () => {
    mockAddress = null;
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Explore a sample plan" }));
    expect(mockEnableDemo).toHaveBeenCalledTimes(1);
  });

  it("opens the route inspector from the quote tap", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    fireEvent.click(screen.getByTestId("quote-row"));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("route-schematic")).toHaveTextContent("cUSD-USDC");
  });
});

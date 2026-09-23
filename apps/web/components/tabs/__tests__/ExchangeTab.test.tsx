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

let mockNettingRequested = false;
const mockConsumeNetting = vi.fn();

vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    swapPrefill: null,
    setSwapPrefill: vi.fn(),
    nettingRequested: mockNettingRequested,
    consumeNettingRequest: mockConsumeNetting,
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

vi.mock("@/components/business/FxNettingRail", () => ({
  FxNettingRail: (props: { initialSell?: string; initialBuy?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "fx-netting-rail" },
      `${props.initialSell ?? ""}-${props.initialBuy ?? ""}`,
    ),
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
    onInspectJourney,
  }: {
    instrument?: boolean;
    onInspectQuote?: (from: string, to: string) => void;
    onInspectJourney?: () => void;
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
      onInspectJourney
        ? React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "journey-row",
              onClick: onInspectJourney,
            },
            "journey",
          )
        : null,
    ),
}));

import type { CapitalHistory } from "@diversifi/shared/src/services/capital-history";

const journeyState: { data: CapitalHistory | null } = { data: null };
vi.mock("@/hooks/use-capital-history", () => ({
  useCapitalHistory: () => ({
    data: journeyState.data,
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

import ExchangeTab from "../ExchangeTab";

describe("ExchangeTab — instrument", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "0xabc";
    mockNettingRequested = false;
    journeyState.data = null;
  });

  it("mounts the ticket as the object, with no extra inspect button", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    expect(screen.getByTestId("exchange-swap-object")).toBeInTheDocument();
    expect(screen.getByText("instrument")).toBeInTheDocument();
    expect(screen.queryByText("Inspect route and settlement")).not.toBeInTheDocument();
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

  it("unconnected: the trust line renders exactly once — the tier owns it", () => {
    mockAddress = null;
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    // UnconnectedStatusTier already renders VerifiedEvidence; the
    // netting hand-off must not bring a second copy.
    expect(screen.getAllByText("Verified")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /FX netting/ })).toBeInTheDocument();
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

  it("renders the journey inspector with settled legs and explorer links", () => {
    journeyState.data = {
      address: "0xabc",
      chainId: 42220,
      stations: [
        { symbol: "USDm", firstSeen: "2023-01-01T00:00:00.000Z", lastSeen: "2024-01-01T00:00:00.000Z" },
        { symbol: "KESm", firstSeen: "2024-02-01T00:00:00.000Z", lastSeen: "2024-03-01T00:00:00.000Z" },
      ],
      legs: [
        {
          from: "USDm",
          to: "KESm",
          txHash: "0xdeadbeef",
          at: "2024-03-01T00:00:00.000Z",
          amountIn: "50",
          amountOut: "6450.25",
        },
      ],
      complete: true,
      asOf: "2026-09-23T12:00:00.000Z",
    };
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    fireEvent.click(screen.getByTestId("journey-row"));
    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet).toHaveTextContent("Your capital's journey");
    const inspector = screen.getByTestId("journey-inspector");
    expect(inspector).toHaveTextContent("Mar 1, 2024 · 50 USDm → 6,450.25 KESm");
    const link = screen.getByRole("link", { name: "View ↗" });
    expect(link).toHaveAttribute(
      "href",
      "https://celo.blockscout.com/tx/0xdeadbeef",
    );
    expect(inspector).toHaveTextContent("Read from Celo via Blockscout");
    expect(inspector).not.toHaveTextContent("Showing your most recent transfers");
  });

  it("journey inspector: empty state and the truncated-history footer", () => {
    journeyState.data = {
      address: "0xabc",
      chainId: 42220,
      stations: [],
      legs: [],
      complete: false,
      asOf: "2026-09-23T12:00:00.000Z",
    };
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    fireEvent.click(screen.getByTestId("journey-row"));
    const inspector = screen.getByTestId("journey-inspector");
    expect(inspector).toHaveTextContent(
      "No swaps between currencies found in this history.",
    );
    expect(inspector).toHaveTextContent("Showing your most recent transfers");
  });

  it("walletless gets no journey row", () => {
    mockAddress = null;
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );
    expect(screen.queryByTestId("journey-row")).not.toBeInTheDocument();
  });

  it("connected: the status rail carries the same quiet trust line as Home and Shield", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("· Evidence mirrored")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FX netting/ })).toBeInTheDocument();
  });

  it("the FX netting link unfolds the rail inside the inspector — no object flip", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    // Ticket remains the object — no separate netting card mounts.
    expect(screen.getByTestId("exchange-swap-object")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /FX netting/ }));
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("fx-netting-rail")).toBeInTheDocument();
    expect(screen.getByTestId("exchange-swap-object")).toBeInTheDocument();
  });

  it("pair inspection shows route detail AND the netting rail prefilled from the pair's corridor", () => {
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    fireEvent.click(screen.getByTestId("quote-row"));
    expect(screen.getByTestId("route-schematic")).toHaveTextContent("cUSD-USDC");
    // cUSD→USDC both mirror USD — corridorSideFor yields USD/USD.
    expect(screen.getByTestId("fx-netting-rail")).toHaveTextContent("USD-USD");
  });

  it("a netting hand-off (navigateToNetting) unfolds the rail on arrival", () => {
    mockNettingRequested = true;
    render(
      <ExchangeTab userRegion="USA" inflationData={{}} />,
    );

    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("fx-netting-rail")).toBeInTheDocument();
  });
});

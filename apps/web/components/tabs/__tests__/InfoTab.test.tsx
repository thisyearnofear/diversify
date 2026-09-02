/**
 * Learn tab — calculator instrument. No funding cards, no GoodDollar hub.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

let mockPhilosophy: string | null = null;
let mockCurrency = "KES";

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: { philosophy: mockPhilosophy },
    isComplete: Boolean(mockPhilosophy),
  }),
}));

vi.mock("@/hooks/use-currency-risk", () => ({
  useCurrencyRisk: () => ({ currencyCode: mockCurrency }),
}));

vi.mock("@/hooks/use-inflation-data", () => ({
  useInflationData: () => ({
    inflationData: {
      Africa: { avgRate: 12.5, countries: [] },
      USA: { avgRate: 4.1, countries: [] },
      Europe: { avgRate: 6.8, countries: [] },
      LatAm: { avgRate: 8.7, countries: [] },
      Asia: { avgRate: 4.2, countries: [] },
    },
    dataSource: "fallback",
    getDataFreshness: () => ({ mostRecentYear: "2023" }),
  }),
}));

vi.mock("@/lib/analytics", () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/components/shared/TokenIcon", () => ({
  TokenIcon: ({ symbol }: { symbol: string }) => (
    <span data-testid={`token-${symbol}`}>{symbol}</span>
  ),
}));

import InfoTab from "../InfoTab";

describe("InfoTab — Learn calculator", () => {
  const setActiveTab = vi.fn();

  beforeEach(() => {
    mockPhilosophy = null;
    mockCurrency = "KES";
    setActiveTab.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the calculator and not funding or GoodDollar cards", () => {
    render(
      <InfoTab userRegion="Africa" setActiveTab={setActiveTab} />,
    );

    expect(screen.getByTestId("protection-calculator")).toBeInTheDocument();
    expect(screen.getByLabelText("Your savings amount")).toBeInTheDocument();
    expect(screen.getByText("Choose a plan on Shield")).toBeInTheDocument();
    expect(screen.queryByText("Instant Access")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer from Exchange")).not.toBeInTheDocument();
    expect(screen.queryByText("GoodDollar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("opens the inspector from a year tap and sends the user to Shield", () => {
    render(
      <InfoTab userRegion="Africa" setActiveTab={setActiveTab} />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Year 3" }));
    expect(screen.getByTestId("inspector-sheet")).toHaveAttribute(
      "data-selected-id",
      "year-3",
    );
    expect(screen.getByText(/Purchasing power after inflation/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Choose a plan on Shield"));
    expect(setActiveTab).toHaveBeenCalledWith("protect");
  });

  it("morphs the protected line to the philosophy mix", () => {
    mockPhilosophy = "africapitalism";
    render(
      <InfoTab userRegion="Africa" setActiveTab={setActiveTab} />,
    );

    expect(screen.getByText("See this on Shield")).toBeInTheDocument();
    expect(screen.getByText(/your Africapitalism mix/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Year 5" }));
    expect(screen.getByText(/60% KESm/)).toBeInTheDocument();
    expect(screen.getByText(/25% cUSD/)).toBeInTheDocument();
  });

  it("shows the coin wait while balances load", () => {
    render(
      <InfoTab userRegion="Africa" isLoading setActiveTab={setActiveTab} />,
    );
    expect(screen.getByTestId("instrument-wait")).toBeInTheDocument();
    expect(screen.queryByTestId("protection-calculator")).not.toBeInTheDocument();
  });
});

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

vi.mock("@/hooks/use-emerging-markets-prices", () => ({
  useEmergingMarketsPrices: () => ({
    prices: {},
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    lastUpdated: null,
    isStale: false,
    hasEstimates: false,
  }),
}));

vi.mock("@/hooks/use-watchlist", () => ({
  useWatchlist: () => ({
    watchlist: [],
    toggleWatchlist: vi.fn(),
    isInWatchlist: () => false,
  }),
}));

import EmergingMarketsTracker from "../EmergingMarketsTracker";

describe("EmergingMarketsTracker — smoke test (locks in on-strategy)", () => {
  it("renders the Emerging Markets header", () => {
    render(<EmergingMarketsTracker />);
    // The header uses "🌍" + "Emerging Markets" in a single h2.
    expect(
      screen.getByRole("heading", { name: /emerging markets/i }),
    ).toBeInTheDocument();
  });
});

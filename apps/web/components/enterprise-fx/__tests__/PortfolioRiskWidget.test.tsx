import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

vi.mock("@/hooks/use-risk-assessment", () => ({
  useRiskAssessment: () => ({
    riskData: {
      overallScore: 42,
      riskLevel: "medium" as const,
      market: {
        liquidationRisk: 35,
        impliedVolatility: 48,
        sentiment: 55,
      },
      recommendations: [],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import PortfolioRiskWidget from "../PortfolioRiskWidget";

describe("PortfolioRiskWidget — smoke test (locks in on-strategy)", () => {
  it("renders the Portfolio Risk header with the medium level badge", () => {
    render(<PortfolioRiskWidget />);
    // getByText is more robust here than getByRole("heading") — the h3 is
    // nested inside a flex container with a status-dot span, and the
    // accessible name resolution can be ambiguous in that layout.
    expect(screen.getByText(/portfolio risk/i)).toBeInTheDocument();
    // The risk level badge "MEDIUM" should be visible.
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });
});

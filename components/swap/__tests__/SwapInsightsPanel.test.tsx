import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: {
      userGoal: "inflation_protection",
      riskTolerance: "moderate",
      timeHorizon: "medium",
    },
    isComplete: true,
  }),
}));

vi.mock("../demo/RealLifeScenario", () => ({
  default: () => <div data-testid="real-life-scenario" />,
}));

import SwapInsightsPanel from "../SwapInsightsPanel";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";

const regionData = (region: string, avgRate: number): RegionalInflationData => ({
  region,
  countries: [
    {
      country: region,
      region,
      currency: region,
      rate: avgRate,
      year: 2024,
      source: "fallback",
    },
  ],
  avgRate,
  stablecoins: [],
});

const homeAboveTarget: Record<string, RegionalInflationData> = {
  Africa: regionData("Africa", 11.2),
  USA: regionData("USA", 3.1),
};

const homeAtOrBelowTarget: Record<string, RegionalInflationData> = {
  Africa: regionData("Africa", 2.0),
  USA: regionData("USA", 3.1),
};

describe("SwapInsightsPanel — InflationBenefitCard wiring", () => {
  it("renders the Inflation Protection card when the home region has higher inflation than the target", () => {
    // Africa (11.2%) > USA (3.1%) → positive benefit, card visible.
    render(
      <SwapInsightsPanel userRegion="Africa" inflationData={homeAboveTarget} />,
    );
    expect(
      screen.getByText("Inflation Protection", { selector: "h3" }),
    ).toBeInTheDocument();
  });

  it("does NOT render the Inflation Protection card when there is no positive inflation benefit", () => {
    // Africa (2.0%) ≤ USA (3.1%) → no benefit, card stays hidden.
    render(
      <SwapInsightsPanel
        userRegion="Africa"
        inflationData={homeAtOrBelowTarget}
      />,
    );
    expect(
      screen.queryByText("Inflation Protection", { selector: "h3" }),
    ).not.toBeInTheDocument();
  });
});

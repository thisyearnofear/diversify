import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

import RiskMetrics from "../RiskMetrics";

describe("RiskMetrics — smoke test (locks in on-strategy)", () => {
  it("renders the Risk Intelligence header with a default asset", () => {
    render(
      <RiskMetrics
        liquidationRisk={45}
        impliedVolatility={60}
        realizedVol={0.3}
        forecastVol={0.4}
        sentiment={50}
        asset="BTC"
      />,
    );
    // The h3 contains "Risk Intelligence" + a status dot.
    expect(
      screen.getByRole("heading", { name: /risk intelligence/i }),
    ).toBeInTheDocument();
    // The asset label is rendered in the header.
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });
});

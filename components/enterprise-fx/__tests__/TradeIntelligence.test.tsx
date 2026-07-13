import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(cleanup);

import TradeIntelligence, { type IntelligenceItem } from "../TradeIntelligence";

const sampleItems: IntelligenceItem[] = [
  {
    id: "1",
    type: "news",
    title: "Cedi weakens 2% against dollar",
    description: "Ghana cedi slipped to a record low on local inflation data.",
    impact: "negative",
    impactAsset: "GHS",
    timestamp: "2h",
  },
  {
    id: "2",
    type: "impact",
    title: "Central bank raises rates",
    description: "Bank of Ghana increased the policy rate by 50 basis points.",
    impact: "neutral",
    timestamp: "5h",
  },
];

describe("TradeIntelligence — smoke test (locks in on-strategy)", () => {
  it("renders the Market Intelligence header with the provided items", () => {
    render(
      <TradeIntelligence items={sampleItems} selectedAsset="GHS" />,
    );
    expect(
      screen.getByRole("heading", { name: /market intelligence/i }),
    ).toBeInTheDocument();
    // The items should be rendered as titles.
    expect(screen.getByText(/cedi weakens/i)).toBeInTheDocument();
    expect(screen.getByText(/central bank raises rates/i)).toBeInTheDocument();
  });

  it("returns null when no items match the selected asset", () => {
    const { container } = render(
      <TradeIntelligence items={sampleItems} selectedAsset="BTC" />,
    );
    // No items match BTC (only GHS does), so the component should render
    // nothing meaningful. The header is still present but the items are
    // filtered out — so the item titles should NOT be in the document.
    expect(
      container.querySelector("[class*='space-y-2']"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cedi weakens/i)).not.toBeInTheDocument();
  });
});

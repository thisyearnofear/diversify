import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
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

describe("TradeIntelligence — smart-empty signal pill", () => {
  it("renders a single-line pill with the latest matching item", () => {
    render(<TradeIntelligence items={sampleItems} selectedAsset="GHS" />);
    // The pill is rendered (testid present)
    expect(screen.getByTestId("trade-intelligence-pill")).toBeInTheDocument();
    // The latest matching item title is shown
    expect(screen.getByText(/cedi weakens/i)).toBeInTheDocument();
    // The 'Macro' label is shown (helps the user parse the line)
    expect(screen.getByText(/macro/i)).toBeInTheDocument();
  });

  it("returns null (no DOM output) when no items match the selected asset", () => {
    // All items have impactAsset: "GHS" (or no impactAsset = universal).
    // To force a clean "no match", use items where every item has
    // impactAsset set to a non-matching value.
    const allGhsItems: IntelligenceItem[] = [
      {
        id: "1",
        type: "news",
        title: "Cedi weakens 2% against dollar",
        description: "Ghana cedi slipped to a record low on local inflation data.",
        impact: "negative",
        impactAsset: "GHS",
        timestamp: "2h",
      },
    ];
    const { container } = render(
      <TradeIntelligence items={allGhsItems} selectedAsset="BTC" />,
    );
    // Component returns null when nothing matches → no DOM output
    expect(container.firstChild).toBeNull();
  });

  it("returns null after the user clicks the dismiss button", () => {
    const onDismiss = vi.fn();
    render(
      <TradeIntelligence
        items={sampleItems}
        selectedAsset="GHS"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId("trade-intelligence-pill")).toBeInTheDocument();
    // Click the dismiss button (aria-label is "Dismiss signal")
    fireEvent.click(screen.getByRole("button", { name: /dismiss signal/i }));
    // The pill is gone
    expect(
      screen.queryByTestId("trade-intelligence-pill"),
    ).not.toBeInTheDocument();
    // The onDismiss callback was called
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows the impactAsset chip when the matching item has one", () => {
    render(<TradeIntelligence items={sampleItems} selectedAsset="GHS" />);
    // The pill shows "GHS" as the asset chip
    expect(screen.getByText("GHS")).toBeInTheDocument();
  });

  it("drops items older than maxAgeMs when emittedAt is set", () => {
    // 7 days ago — older than the default 48h
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const staleItems: IntelligenceItem[] = [
      {
        id: "1",
        type: "news",
        title: "Stale signal",
        description: "This is from a week ago.",
        impact: "negative",
        impactAsset: "GHS",
        timestamp: "7d",
        emittedAt: sevenDaysAgo,
      },
    ];
    const { container } = render(
      <TradeIntelligence items={staleItems} selectedAsset="GHS" />,
    );
    // Stale item is dropped → component returns null
    expect(container.firstChild).toBeNull();
  });
});

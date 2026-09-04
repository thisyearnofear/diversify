import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The moment hook drives which object renders — mock it so the test fixes
// the currency-moment shape (the common path for detected countries).
vi.mock("@/hooks/use-currency-moment", () => ({
  useCurrencyMoment: () => ({
    moment: { currencyCode: "NGN", benchmark: "XAU" },
    inflationMoment: null,
    benchmarks: [],
    horizons: [],
    setBenchmark: vi.fn(),
    setHorizon: vi.fn(),
    setSavingsAmount: vi.fn(),
    onChangeCountry: vi.fn(),
    frame: null,
  }),
}));

vi.mock("@/components/tabs/overview/CurrencyMomentCard", () => ({
  CurrencyMomentCard: () => <div data-testid="moment-card" />,
}));
vi.mock("@/components/tabs/overview/InflationMomentCard", () => ({
  InflationMomentCard: () => <div data-testid="inflation-card" />,
}));
vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => <button type="button">Connect wallet</button>,
}));
vi.mock("@/components/shared/TabComponents", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { NotConnectedState } from "../NotConnectedState";

describe("NotConnectedState — Home's unconnected morph", () => {
  it("keeps the moment card as the object with the connect CTA attached", () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    // The Risk Theater object renders walletless — it is geo data, not
    // wallet data.
    expect(screen.getByTestId("moment-card")).toBeInTheDocument();
    // One CTA, attached to the object — no card wrapper, no second button.
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
  });

  it("drops the marketing stack — no how-it-works, no proof card", () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Connect a wallet to protect what matters/),
    ).not.toBeInTheDocument();
  });

  it("keeps trust + demo as quiet status-tier lines", () => {
    const onEnableDemo = vi.fn();
    render(<NotConnectedState onEnableDemo={onEnableDemo} />);

    // §7 trust: one quiet line, not a proof card.
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // Demo entry is a text link, not a competing button strip.
    fireEvent.click(
      screen.getByRole("button", { name: "Explore a sample plan" }),
    );
    expect(onEnableDemo).toHaveBeenCalledTimes(1);
  });
});

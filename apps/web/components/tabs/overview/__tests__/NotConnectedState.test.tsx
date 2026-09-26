import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The moment hook drives which object renders — mock it with overridable
// state so every branch (moment / inflation / detecting / detection-failed)
// is testable in isolation.
const hookState = vi.hoisted(() => ({
  moment: { currencyCode: "NGN", benchmark: "XAU" } as Record<string, unknown> | null,
  inflationMoment: null as Record<string, unknown> | null,
  isLoading: false,
  countryCode: null as string | null,
  countryIsDefault: false,
  onChangeCountry: vi.fn(),
}));

vi.mock("@/hooks/use-currency-moment", () => ({
  useCurrencyMoment: () => ({
    moment: hookState.moment,
    inflationMoment: hookState.inflationMoment,
    isLoading: hookState.isLoading,
    countryCode: hookState.countryCode,
    countryIsDefault: hookState.countryIsDefault,
    benchmarks: [],
    horizons: [],
    setBenchmark: vi.fn(),
    setHorizon: vi.fn(),
    setSavingsAmount: vi.fn(),
    onChangeCountry: hookState.onChangeCountry,
    frame: null,
  }),
}));

vi.mock("@/components/tabs/overview/CurrencyMomentCard", () => ({
  CurrencyMomentCard: ({
    rememberVisit,
    countryIsDefault,
  }: {
    rememberVisit?: boolean;
    countryIsDefault?: boolean;
  }) => (
    <div
      data-testid="moment-card"
      data-remember-visit={String(rememberVisit)}
      data-country-is-default={String(countryIsDefault)}
    />
  ),
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
import { CountryOverrideSelect } from "../CountryOverrideSelect";

describe("NotConnectedState — Home's unconnected morph", () => {
  beforeEach(() => {
    hookState.moment = { currencyCode: "NGN", benchmark: "XAU" };
    hookState.inflationMoment = null;
    hookState.isLoading = false;
    hookState.countryCode = null;
    hookState.countryIsDefault = false;
    hookState.onChangeCountry.mockReset();
  });

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

  it("renders a quiet detecting state while geo resolves — never a premature failure", () => {
    hookState.moment = null;
    hookState.isLoading = true;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    expect(screen.getByText(/Detecting your region/i)).toBeInTheDocument();
    // Not a dead end, not a lie: no "could not detect" while still loading.
    expect(
      screen.queryByText(/could not detect/i),
    ).not.toBeInTheDocument();
  });

  it("when detection fails, the fallback card carries the country picker — the instruction and the affordance travel together", () => {
    hookState.moment = null;
    hookState.isLoading = false;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    // Honest copy + a working control (§5: selection rewrites the artefact).
    expect(screen.getByText(/could not detect your country/i)).toBeInTheDocument();
    const select = screen.getByLabelText(
      "Select the country where your savings live",
    );
    expect(select).toBeInTheDocument();
    // Placeholder state — no country silently pre-selected.
    expect(select).toHaveValue("");
    expect(screen.getByText("Choose a country…")).toBeInTheDocument();
  });

  it("forwards isActive to the moment card's visit memory", () => {
    const { rerender } = render(
      <NotConnectedState isActive={false} onEnableDemo={vi.fn()} />,
    );
    expect(screen.getByTestId("moment-card")).toHaveAttribute(
      "data-remember-visit",
      "false",
    );
    rerender(<NotConnectedState isActive={true} onEnableDemo={vi.fn()} />);
    expect(screen.getByTestId("moment-card")).toHaveAttribute(
      "data-remember-visit",
      "true",
    );
  });

  it("geo failed → the moment object still renders as a display-only default and stays out of visit memory", () => {
    hookState.moment = { currencyCode: "NGN", benchmark: "USD" };
    hookState.countryIsDefault = true;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    const card = screen.getByTestId("moment-card");
    // The object stays alive — the card renders instead of a picker-only
    // dead end — but the default is honest: flagged as default and kept
    // out of visit memory (default views never read or write memory).
    expect(card).toHaveAttribute("data-country-is-default", "true");
    expect(card).toHaveAttribute("data-remember-visit", "false");
  });

  it("picking a country from the fallback re-points the moment (judge path: geo blocked → still lands on their currency)", () => {
    hookState.moment = null;
    hookState.isLoading = false;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    const select = screen.getByLabelText(
      "Select the country where your savings live",
    );
    fireEvent.change(select, { target: { value: "JM" } });
    expect(hookState.onChangeCountry).toHaveBeenCalledWith("JM");
  });
});

describe("CountryOverrideSelect — no-country placeholder state", () => {
  it("renders the curated list behind a disabled placeholder when no country is known", () => {
    render(
      <CountryOverrideSelect
        currentCountryCode=""
        currentCountryName=""
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(
      "Select the country where your savings live",
    );
    expect(select).toHaveValue("");
    expect(screen.getByText("Choose a country…")).toBeInTheDocument();
    // Curated corridors present (Caribbean + Africa + benchmarks).
    expect(
      screen.getByRole("option", { name: /Jamaica \(JMD\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Barbados \(BBD\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Ghana \(GHS\)/ }),
    ).toBeInTheDocument();
  });

  it("fires onChange only for a real selection — the placeholder is inert", () => {
    const onChange = vi.fn();
    render(
      <CountryOverrideSelect
        currentCountryCode=""
        currentCountryName=""
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText(
      "Select the country where your savings live",
    );
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "JM" } });
    expect(onChange).toHaveBeenCalledWith("JM");
  });
});

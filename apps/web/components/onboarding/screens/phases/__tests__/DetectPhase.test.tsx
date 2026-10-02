import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DetectPhase } from "../DetectPhase";

// DetectPhase is presentational — every branch arrives as props, so a
// fixture drives all of: detected card / no-detection bench preview /
// picker grid / no-match empty state / country request.
function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    riskLoading: false,
    riskData: null,
    showCountryPicker: true,
    setShowCountryPicker: vi.fn(),
    manualCountrySearch: "",
    setManualCountrySearch: vi.fn(),
    filteredCountries: [
      { iso2: "JM", flag: "🇯🇲", countryName: "Jamaica", code: "JMD" },
      { iso2: "GH", flag: "🇬🇭", countryName: "Ghana", code: "GHS" },
    ],
    setCountryOverride: vi.fn(),
    countryRequestCountry: "",
    setCountryRequestCountry: vi.fn(),
    countryRequestStatus: "idle" as const,
    setCountryRequestError: vi.fn(),
    countryRequestError: null,
    handleCountryRequest: vi.fn(),
    onAdvance: vi.fn(),
    moneyPurpose: 'long_term_savings' as const,
    setMoneyPurpose: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
}

describe("DetectPhase — country picker empty-search state", () => {
  it("renders country buttons when the search matches", () => {
    render(
      <DetectPhase
        {...makeProps({ manualCountrySearch: "jam", filteredCountries: [
          { iso2: "JM", flag: "🇯🇲", countryName: "Jamaica", code: "JMD" },
        ] })}
      />,
    );
    // The picker is open with a match — the grid renders the country.
    expect(
      screen.getByRole("button", { name: /Jamaica JMD/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No country matches/i)).not.toBeInTheDocument();
  });

  it("never leaves a no-match search as a blank grid — honest copy + a way out", () => {
    const setSearch = vi.fn();
    render(
      <DetectPhase
        {...makeProps({
          manualCountrySearch: "zzz",
          filteredCountries: [],
          setManualCountrySearch: setSearch,
        })}
      />,
    );
    // Explanation, not a void.
    expect(
      screen.getByText(/No country matches “zzz”/i),
    ).toBeInTheDocument();
    // Clear search returns to the suggested grid.
    fireEvent.click(screen.getByRole("button", { name: /Clear search/i }));
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("the country request form appears only when a search finds nothing", () => {
    const { unmount } = render(<DetectPhase {...makeProps()} />);
    expect(screen.queryByText(/Don.t see your country/i)).not.toBeInTheDocument();
    unmount();
    render(<DetectPhase {...makeProps({ manualCountrySearch: "zzz", filteredCountries: [] })} />);
    expect(screen.getByText(/Don.t see your country/i)).toBeInTheDocument();
  });
});

describe("DetectPhase — one tap to the numbers", () => {
  it("does not advance on the previous country's data", () => {
    const onAdvance = vi.fn();
    const props = makeProps({ onAdvance, riskData: { flag: "🇳🇬", countryName: "Nigeria", code: "NGN" } });
    const { rerender } = render(<DetectPhase {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Ghana GHS/ }));
    expect(onAdvance).not.toHaveBeenCalled();
    rerender(<DetectPhase {...props} riskData={{ flag: "🇬🇭", countryName: "Ghana", code: "GHS" }} />);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("offers supplier-payment intent before a values plan", () => {
    const props = makeProps();
    render(<DetectPhase {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Supplier payment" }));
    expect(props.setMoneyPurpose).toHaveBeenCalledWith("upcoming_payment");
  });

  it("picking a country advances once its data resolves — no second CTA tap", () => {
    const onAdvance = vi.fn();
    const props = makeProps({ onAdvance });
    const { rerender } = render(<DetectPhase {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Ghana GHS/ }));
    expect(props.setCountryOverride).toHaveBeenCalledWith("GH");
    expect(onAdvance).not.toHaveBeenCalled();
    rerender(
      <DetectPhase
        {...props}
        showCountryPicker={false}
        riskData={{ flag: "🇬🇭", countryName: "Ghana", code: "GHS" }}
      />,
    );
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("a detected country still waits for the visitor's tap", () => {
    const onAdvance = vi.fn();
    render(
      <DetectPhase
        {...makeProps({ onAdvance, showCountryPicker: false, riskData: { flag: "🇳🇬", countryName: "Nigeria", code: "NGN" } })}
      />,
    );
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Show me the numbers/ }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

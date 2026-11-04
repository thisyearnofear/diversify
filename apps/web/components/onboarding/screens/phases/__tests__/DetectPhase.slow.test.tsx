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
      { iso2: "JM", flag: "🇯🇲", countryName: "Jamaica", code: "JMD", hasHistory: true },
      { iso2: "GH", flag: "🇬🇭", countryName: "Ghana", code: "GHS", hasHistory: true },
    ],
    setCountryOverride: vi.fn(),
    selectedCountry: null,
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
          { iso2: "JM", flag: "🇯🇲", countryName: "Jamaica", code: "JMD", hasHistory: true },
        ] })}
      />,
    );
    // The picker is open with a match — the shared sheet renders the row.
    expect(
      screen.getByRole("button", { name: /Jamaica \(JMD\)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No countries match/i)).not.toBeInTheDocument();
  });

  it("never leaves a no-match search as a blank grid — honest copy + a way out", () => {
    const setSearch = vi.fn();
    render(
      <DetectPhase
        {...makeProps({
          manualCountrySearch: "zzz",
          filteredCountries: [],
    selectedCountry: null,
          setManualCountrySearch: setSearch,
        })}
      />,
    );
    // Explanation, not a void.
    expect(
      screen.getByText(/No countries match “zzz”/i),
    ).toBeInTheDocument();
    // The search input stays — typing away or backing up is the way out.
    fireEvent.change(screen.getByLabelText(/Search countries/i), { target: { value: "" } });
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("a country without researched history is still selectable — honestly labeled", () => {
    const props = makeProps({
      manualCountrySearch: "swit",
      filteredCountries: [
        { iso2: "CH", flag: "🇨🇭", countryName: "Switzerland", code: null, hasHistory: false },
      ],
    });
    render(<DetectPhase {...props} />);
    const row = screen.getByRole("button", { name: /Switzerland/ });
    expect(row).toHaveTextContent("Explore plans · history unavailable");
    fireEvent.click(row);
    expect(props.setCountryOverride).toHaveBeenCalledWith("CH");
    // Selecting stays on detect — no auto-advance.
    expect(props.onAdvance).not.toHaveBeenCalled();
    // And a no-history card shows the honest caption + Explore plans CTA.
    render(
      <DetectPhase
        {...props}
        showCountryPicker={false}
        selectedCountry={{ iso2: "CH", flag: "🇨🇭", countryName: "Switzerland", code: null, hasHistory: false }}
        riskData={null}
      />,
    );
    expect(screen.getByText(/history isn.t available here yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Explore plans/ })).toBeInTheDocument();
  });
});

describe("DetectPhase — purpose headlines and caption", () => {
  it("titles the screen from the chosen purpose and explains it in the caption", () => {
    const { rerender } = render(<DetectPhase {...makeProps({ showCountryPicker: false })} />);
    const heading = screen.getByText('Your money. Your next chapter.');
    expect(heading).toHaveAttribute('data-phase-heading');
    expect(heading).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByText('Make room for the future you have in mind.')).toBeInTheDocument();

    rerender(<DetectPhase {...makeProps({ showCountryPicker: false, moneyPurpose: 'upcoming_payment' })} />);
    expect(screen.getByText('Your next payment. In perspective.')).toBeInTheDocument();
    expect(screen.getByText('See the currency exposure behind your next invoice.')).toBeInTheDocument();
    expect(screen.getByText('Start with the currency you earn.')).toBeInTheDocument();

    rerender(<DetectPhase {...makeProps({ showCountryPicker: false, moneyPurpose: 'everyday_buffer' })} />);
    expect(screen.getByText('A little breathing room.')).toBeInTheDocument();
    expect(screen.getByText('Keep everyday needs within reach.')).toBeInTheDocument();
  });

  it("reports the mount so the orchestrator can move focus to the heading", () => {
    const onEntered = vi.fn();
    render(<DetectPhase {...makeProps({ onEntered })} />);
    expect(onEntered).toHaveBeenCalledTimes(1);
  });
});

describe("DetectPhase — one tap to the numbers", () => {
  it("picking a country lands on the card — the visitor still taps forward", () => {
    const onAdvance = vi.fn();
    const props = makeProps({ onAdvance, riskData: { flag: "🇳🇬", countryName: "Nigeria", code: "NGN" } });
    render(<DetectPhase {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Ghana \(GHS\)/ }));
    expect(props.setCountryOverride).toHaveBeenCalledWith("GH");
    expect(props.setShowCountryPicker).toHaveBeenCalledWith(false);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("offers supplier-payment intent before a values plan", () => {
    const props = makeProps();
    render(<DetectPhase {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Supplier payment" }));
    expect(props.setMoneyPurpose).toHaveBeenCalledWith("upcoming_payment");
  });

  it("a selected country with history shows the numbers CTA — one explicit tap", () => {
    const onAdvance = vi.fn();
    render(
      <DetectPhase
        {...makeProps({
          onAdvance,
          showCountryPicker: false,
          selectedCountry: { iso2: "GH", flag: "🇬🇭", countryName: "Ghana", code: "GHS", hasHistory: true },
          riskData: { flag: "🇬🇭", countryName: "Ghana", code: "GHS" },
        })}
      />,
    );
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Show me the numbers/ }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("a detected country still waits for the visitor's tap", () => {
    const onAdvance = vi.fn();
    render(
      <DetectPhase
        {...makeProps({ onAdvance, showCountryPicker: false,
          selectedCountry: { iso2: "NG", flag: "🇳🇬", countryName: "Nigeria", code: "NGN", hasHistory: true },
          riskData: { flag: "🇳🇬", countryName: "Nigeria", code: "NGN" } })}
      />,
    );
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Show me the numbers/ }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

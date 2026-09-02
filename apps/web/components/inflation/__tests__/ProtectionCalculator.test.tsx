import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { ProtectionCalculator } from "../ProtectionCalculator";
import { GOLD_MIX, seriesFor, type InflationRates } from "@/lib/learn/protection-calculator";

const RATES: InflationRates = {
  local: 12.5,
  usd: 4.1,
  eur: 6.8,
  africa: 12.5,
  latam: 8.7,
  asia: 4.2,
  europe: 6.8,
};

describe("ProtectionCalculator", () => {
  it("names the preserved amount and calls onProtect", () => {
    const onProtect = vi.fn();
    const onSelectYear = vi.fn();
    render(
      <ProtectionCalculator
        amount={10_000}
        onAmountChange={vi.fn()}
        currencyCode="KES"
        series={seriesFor(10_000, GOLD_MIX, RATES, 5)}
        selectedYear={5}
        years={5}
        mixLabel="Gold"
        onSelectYear={onSelectYear}
        onProtect={onProtect}
        ctaLabel="Choose a plan on Shield"
      />,
    );

    expect(screen.getByText(/more kept in 5 years with gold/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Choose a plan on Shield"));
    expect(onProtect).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Year 2" }));
    expect(onSelectYear).toHaveBeenCalledWith(2);
  });
});

// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/hooks/useFinancialStrategies", () => ({
  STRATEGIES: [
    { id: "global", name: "Global", icon: "🌍", tagline: "Worldwide balance" },
    { id: "africapitalism", name: "Africapitalism", icon: "🌍", tagline: "Build the motherland" },
    { id: "buen_vivir", name: "Buen Vivir", icon: "🌱", tagline: "Good living" },
    { id: "custom", name: "Custom", icon: "⚙️", tagline: "Your own mix" },
  ],
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: { customPlan: null, riskTolerance: "Balanced" },
  }),
}));

vi.mock("@/hooks/use-anchor-currency", () => ({
  useAnchorCurrency: () => ({ anchorCurrency: null }),
}));

vi.mock("@/components/onboarding/LensCoinSelector", () => ({
  LensCoinSelector: ({
    lenses,
    selected,
    onSelect,
  }: {
    lenses: { id: string; label: string }[];
    selected: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="lens-coin-selector">
      {lenses.map((l) => (
        <button
          key={l.id}
          type="button"
          data-testid={`coin-${l.id}`}
          data-selected={selected === l.id || undefined}
          onClick={() => onSelect(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  ),
}));

import { GuardianPlanSwitcher } from "../GuardianPlanSwitcher";

afterEach(() => cleanup());

function renderSwitcher(over: Partial<Parameters<typeof GuardianPlanSwitcher>[0]> = {}) {
  const props = {
    currentPlan: "africapitalism",
    onUpdatePlan: vi.fn(() => Promise.resolve(true)),
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
  render(<GuardianPlanSwitcher {...props} />);
  return props;
}

describe("GuardianPlanSwitcher", () => {
  it("no Custom coin is offered — shaping stays on Shield", () => {
    renderSwitcher();
    expect(screen.queryByTestId("coin-custom")).not.toBeInTheDocument();
    expect(screen.getByTestId("coin-global")).toBeInTheDocument();
  });

  it("a legacy custom server plan opens on Global and can save a named plan", async () => {
    const props = renderSwitcher({ currentPlan: "custom" });
    expect(screen.getByTestId("coin-global")).toHaveAttribute("data-selected", "true");
    const save = screen.getByRole("button", { name: "Use this plan" });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await vi.waitFor(() => expect(props.onUpdatePlan).toHaveBeenCalledWith("global"));
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    fireEvent.click(screen.getByRole("button", { name: "Use this plan" }));
    await vi.waitFor(() => expect(props.onUpdatePlan).toHaveBeenCalledWith("buen_vivir"));
  });

  it("a current named plan is preselected and save stays disabled until a change", () => {
    renderSwitcher({ currentPlan: "africapitalism" });
    expect(screen.getByTestId("coin-africapitalism")).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Use this plan" })).toBeDisabled();
    fireEvent.click(screen.getByTestId("coin-global"));
    expect(screen.getByRole("button", { name: "Use this plan" })).not.toBeDisabled();
  });
});

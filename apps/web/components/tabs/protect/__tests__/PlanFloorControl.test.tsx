import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PlanFloorControl } from "../PlanFloorControl";
import { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import {
  getArchetypeAllocations,
  legsForRisk,
  type RiskTolerance,
} from "@/components/protection-cards/plan-preview";

const SAVED = legsForRisk(getArchetypeAllocations("africapitalism"), "Balanced");
const CONSERVATIVE = legsForRisk(getArchetypeAllocations("africapitalism"), "Conservative");

function renderControl(overrides: Partial<React.ComponentProps<typeof PlanFloorControl>> = {}) {
  const onChange = vi.fn();
  const props = {
    value: "Balanced" as const,
    legs: SAVED,
    savedLegs: SAVED,
    isPreviewing: false,
    onCancel: vi.fn(),
    ...overrides,
    onChange,
  };
  render(<PlanFloorControl {...props} />);
  return props;
}

describe("PlanFloorControl — balance preview", () => {
  it("idle: one caption names the saved floor and the honesty caveat", () => {
    renderControl();
    expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
      "Dollar reserve · 25% — dollar-pegged, not risk-free",
    );
    expect(screen.queryByText(/Explore without/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this balance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep current balance" })).not.toBeInTheDocument();
  });

  it("preview: caption compares saved vs draft floors", () => {
    renderControl({
      value: "Conservative",
      legs: CONSERVATIVE,
      isPreviewing: true,
      onApply: vi.fn(),
    });
    expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
      "Dollar reserve 25% → 40%",
    );
  });

  it("radio labels read as choices; selecting fires onChange only — never apply", () => {
    const { onChange, onApply } = renderControl({ onApply: vi.fn(), isPreviewing: true, legs: CONSERVATIVE, value: "Conservative" });
    const group = screen.getByRole("radiogroup", { name: "Plan balance" });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    expect(onChange).toHaveBeenCalledWith("Conservative");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("roving tabindex + arrow keys wrap, Home/End jump, and focus follows", () => {
    const props = renderControl();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);

    const balanced = screen.getByRole("radio", { name: "Balanced" });
    balanced.focus();
    fireEvent.keyDown(balanced, { key: "ArrowRight" });
    expect(props.onChange).toHaveBeenLastCalledWith("Aggressive");
    fireEvent.keyDown(balanced, { key: "ArrowLeft" });
    expect(props.onChange).toHaveBeenLastCalledWith("Conservative");
    fireEvent.keyDown(balanced, { key: "End" });
    expect(props.onChange).toHaveBeenLastCalledWith("Aggressive");
    expect(screen.getByRole("radio", { name: "More exposure" })).toHaveFocus();

    cleanup();
    props.onChange.mockClear();
    render(<PlanFloorControl {...props} value="Conservative" />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "More reserve" }), { key: "ArrowLeft" });
    expect(props.onChange).toHaveBeenLastCalledWith("Aggressive");

    cleanup();
    render(<PlanFloorControl {...props} value="Aggressive" />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "More exposure" }), { key: "ArrowRight" });
    expect(props.onChange).toHaveBeenLastCalledWith("Conservative");
    fireEvent.keyDown(screen.getByRole("radio", { name: "More exposure" }), { key: "Home" });
    expect(props.onChange).toHaveBeenLastCalledWith("Conservative");
    expect(screen.getByRole("radio", { name: "More reserve" })).toHaveFocus();
  });

  it("apply and cancel fire their own callbacks while previewing", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    renderControl({ isPreviewing: true, value: "Conservative", legs: CONSERVATIVE, onApply, onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Use this balance" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("demo: no save button, sample honesty line, keep still offered", () => {
    renderControl({ isPreviewing: true, value: "Conservative", legs: CONSERVATIVE, onApply: undefined });
    expect(screen.queryByRole("button", { name: "Use this balance" })).not.toBeInTheDocument();
    expect(screen.getByText("Sample preview only — nothing will be saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep current balance" })).toBeInTheDocument();
  });

  function Harness() {
    const [savedRisk, setSavedRisk] = React.useState<RiskTolerance>("Balanced");
    const balance = usePlanBalancePreview({
      scopeKey: "harness",
      savedRisk,
      onCommit: setSavedRisk,
    });
    return (
      <PlanFloorControl
        value={balance.risk}
        legs={legsForRisk(getArchetypeAllocations("africapitalism"), balance.risk)}
        savedLegs={legsForRisk(getArchetypeAllocations("africapitalism"), savedRisk)}
        isPreviewing={balance.isPreviewing}
        onApply={() => balance.commit()}
        onCancel={balance.cancel}
        onChange={balance.select}
      />
    );
  }

  it("Keep current balance returns focus to the saved radio", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    const keep = screen.getByRole("button", { name: "Keep current balance" });
    keep.focus();
    fireEvent.click(keep);
    expect(screen.getByRole("radio", { name: "Balanced" })).toHaveFocus();
    expect(
      screen.getAllByRole("radio").filter((r) => r.tabIndex === 0),
    ).toHaveLength(1);
  });

  it("Use this balance returns focus to the newly saved radio", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
    const use = screen.getByRole("button", { name: "Use this balance" });
    use.focus();
    fireEvent.click(use);
    expect(screen.getByRole("radio", { name: "More reserve" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "More reserve" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getAllByRole("radio").filter((r) => r.tabIndex === 0),
    ).toHaveLength(1);
  });
});

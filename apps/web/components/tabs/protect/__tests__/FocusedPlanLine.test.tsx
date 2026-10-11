// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FocusedPlanLine } from "../PhilosophyCoinRail";
import { resolvePlan } from "@/components/protection-cards/plan-preview";

vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return {
    ...mod,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("FocusedPlanLine — the reading names the actual mix", () => {
  it("shows the resolved starting mix, not the tagline", () => {
    render(
      <FocusedPlanLine
        strategyId="africapitalism"
        legs={resolvePlan({ strategy: "africapitalism" }).legs}
      />,
    );
    const line = screen.getByTestId("focused-plan-line");
    expect(line).toHaveTextContent("Africapitalism");
    expect(line).toHaveTextContent("Starting mix · Shilling 60% · Dollar 25% · +1 more");
    expect(line).not.toHaveTextContent("Build the motherland");
  });

  it("a committed custom plan reads 'Your mix'", () => {
    render(
      <FocusedPlanLine
        strategyId="custom"
        legs={resolvePlan({ strategy: "africapitalism" }).legs}
      />,
    );
    expect(screen.getByTestId("focused-plan-line")).toHaveTextContent("Your mix ·");
  });

  it("switching focus updates the line", () => {
    const { rerender } = render(
      <FocusedPlanLine
        strategyId="africapitalism"
        legs={resolvePlan({ strategy: "africapitalism" }).legs}
      />,
    );
    rerender(
      <FocusedPlanLine
        strategyId="buen_vivir"
        legs={resolvePlan({ strategy: "buen_vivir" }).legs}
      />,
    );
    const lines = screen.getAllByTestId("focused-plan-line");
    expect(lines[lines.length - 1]).toHaveTextContent("Real 45%");
  });

  it("a more-reserve preview reflects the adjusted targets it is handed", () => {
    const conservative = resolvePlan({ strategy: "africapitalism", riskTolerance: "Conservative" }).legs;
    render(<FocusedPlanLine strategyId="africapitalism" legs={conservative} />);
    expect(screen.getByTestId("focused-plan-line")).toHaveTextContent(
      `Shilling ${conservative[0].percent}%`,
    );
    expect(conservative[0].percent).not.toBe(60);
  });

  it("no focus keeps the quiet Philosophy label", () => {
    render(<FocusedPlanLine strategyId={null} />);
    expect(screen.getByTestId("focused-plan-line")).toHaveTextContent("Philosophy");
  });
});

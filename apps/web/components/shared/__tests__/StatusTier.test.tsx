import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StatusTier } from "../StatusTier";

describe("StatusTier", () => {
  it("renders only provided slots", () => {
    render(<StatusTier trust={<span>trust</span>} rail={<span>rail</span>} />);
    expect(screen.getByTestId("status-tier")).toBeInTheDocument();
    expect(screen.getAllByTestId(/./).length).toBeGreaterThan(0);
    const slots = document.querySelectorAll("[data-status-slot]");
    expect(slots).toHaveLength(2);
    expect(slots[0]).toHaveAttribute("data-status-slot", "trust");
    expect(slots[1]).toHaveAttribute("data-status-slot", "rail");
  });

  it("renders all three slots in trust → transition → rail order", () => {
    render(
      <StatusTier
        trust={<span>t</span>}
        transition={<span>x</span>}
        rail={<span>r</span>}
      />,
    );
    const slots = document.querySelectorAll("[data-status-slot]");
    expect([...slots].map((s) => s.getAttribute("data-status-slot"))).toEqual([
      "trust",
      "transition",
      "rail",
    ]);
    expect(slots.length).toBeLessThanOrEqual(3);
  });

  it("treats false/null slots as absent", () => {
    render(<StatusTier trust={<span>t</span>} transition={false} rail={null} />);
    const slots = document.querySelectorAll("[data-status-slot]");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toHaveAttribute("data-status-slot", "trust");
  });
});

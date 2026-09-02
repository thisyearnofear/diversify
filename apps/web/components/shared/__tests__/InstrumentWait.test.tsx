import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InstrumentWait } from "../InstrumentWait";

vi.mock("framer-motion", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useReducedMotion: () => true,
    motion: { div: Passthrough },
  };
});

describe("InstrumentWait", () => {
  it("is one coin and one job line, not a card skeleton", () => {
    render(<InstrumentWait label="Reading your wallet" />);
    const wait = screen.getByTestId("instrument-wait");
    expect(wait).toHaveAttribute("role", "status");
    expect(screen.getByText("Reading your wallet")).toBeInTheDocument();
    expect(wait.querySelectorAll("[class*='rounded-2xl']").length).toBe(0);
    // Reduced-motion: no shine loop, no one-shot sweep either.
    expect(wait.querySelector(".coin-shine-once")).not.toBeInTheDocument();
    expect(wait.querySelector(".coin-shine")).not.toBeInTheDocument();
  });
});

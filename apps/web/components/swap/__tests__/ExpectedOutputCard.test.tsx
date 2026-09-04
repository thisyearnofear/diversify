import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import ExpectedOutputCard from "../ExpectedOutputCard";

vi.mock("@/components/shared/AnimatedNumber", () => ({
  AnimatedNumber: ({ value, className }: { value: number; className?: string }) =>
    React.createElement("span", { className, "data-testid": "animated-number" }, String(value)),
}));

vi.mock("framer-motion", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const MotionPassthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    motion: new Proxy({}, { get: () => MotionPassthrough }),
    AnimatePresence: Passthrough,
    useReducedMotion: () => true,
  };
});

const baseProps = {
  amount: "100",
  fromToken: "USDm",
  toToken: "KESm",
  mounted: true,
};

describe("ExpectedOutputCard — quote lifecycle", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when no quote can ever arrive (walletless) — no perpetual shimmer", () => {
    render(<ExpectedOutputCard {...baseProps} expectedOutput={null} canFetchQuote={false} />);

    expect(screen.queryByTestId("quote-row")).not.toBeInTheDocument();
    // The old behavior: a pulsing block that never resolves.
    expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("shimmers while the quote is being fetched", () => {
    render(<ExpectedOutputCard {...baseProps} expectedOutput={null} canFetchQuote={true} />);

    expect(screen.getByTestId("quote-row")).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for quote…")).not.toBeInTheDocument();
  });

  it("shows the rate once the quote arrives", () => {
    render(<ExpectedOutputCard {...baseProps} expectedOutput="12940" canFetchQuote={true} />);

    expect(screen.getByTestId("quote-row")).toBeInTheDocument();
    expect(screen.getByTestId("animated-number")).toBeInTheDocument();
    expect(screen.getByText(/1 USDm ≈/)).toBeInTheDocument();
    expect(screen.getByText("KESm")).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("falls back to the quote row's inline expansion when there is no tab inspector", () => {
    render(<ExpectedOutputCard {...baseProps} expectedOutput="12940" canFetchQuote={true} />);

    fireEvent.click(screen.getByTestId("quote-row"));
    expect(screen.getByText("You send")).toBeInTheDocument();
    expect(screen.getByText("You receive")).toBeInTheDocument();
  });

  it("renders nothing before hydration even with a quote pending", () => {
    render(
      <ExpectedOutputCard {...baseProps} mounted={false} expectedOutput={null} canFetchQuote={true} />,
    );

    expect(screen.queryByTestId("quote-row")).not.toBeInTheDocument();
  });
});

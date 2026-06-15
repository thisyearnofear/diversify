/**
 * Tests for ContextualBanner.
 *
 * The component is a pure presentational switch — given a `kind` prop,
 * it renders exactly one variant or null. We verify the priority resolution
 * (only one banner at a time) and the visual variants.
 */

// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ContextualBanner } from "../ContextualBanner";

vi.mock("framer-motion", () => {
  const MotionDiv = React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ...props, ref }),
  );
  MotionDiv.displayName = "MotionDiv";
  return {
    AnimatePresence: ({ children }: any) =>
      React.createElement("div", null, children),
    motion: { div: MotionDiv },
  };
});

// Mock the chain-loading onramp and wallet button so we don't need full app context.
vi.mock("../../onramp", () => ({
  NetworkOptimizedOnramp: ({ className }: any) => (
    <div data-testid="onramp" className={className} />
  ),
}));

vi.mock("../../wallet/WalletButton", () => ({
  default: () => <div data-testid="wallet-button" />,
}));

vi.mock("@/hooks/use-cold-start", () => ({
  useColdStart: () => ({
    emoji: "💡",
    headline: "Add funds to start",
    body: "Connect your wallet to see your protection",
    currentChainName: "Celo",
    isOnSupportedChain: true,
    suggestedChainName: "Celo",
    suggestedChainId: 42220,
  }),
}));

// Mock the design-system primitives from TabComponents so the test
// doesn't drag in @diversifi/shared-0g and friends via the design
// system's transitive imports.
vi.mock("../TabComponents", () => ({
  Card: ({ children, className = "" }: any) => (
    <div data-testid="mock-card" className={className}>
      {children}
    </div>
  ),
  PrimaryButton: ({ children, onClick, icon, fullWidth }: any) => (
    <button data-testid="primary-button" onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  SecondaryButton: ({ children, onClick }: any) => (
    <button data-testid="secondary-button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const baseProps = {
  isDemo: false,
  userRegion: "Africa" as any,
  chainId: 42220,
  address: "0x1234567890abcdef",
  setActiveTab: vi.fn(),
  onDisableDemo: vi.fn(),
  onEnableDemo: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("ContextualBanner", () => {
  it("renders nothing when kind is null", () => {
    const { container } = render(
      <ContextualBanner {...baseProps} kind={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the cold-start variant", () => {
    render(<ContextualBanner {...baseProps} kind="cold-start" />);
    expect(screen.getByText("Add funds to start")).toBeInTheDocument();
    expect(screen.getByTestId("onramp")).toBeInTheDocument();
  });

  it("renders the demo variant", () => {
    render(
      <ContextualBanner
        {...baseProps}
        kind="demo"
        isDemo={true}
        demoValue={1234}
      />,
    );
    expect(screen.getByText("Preview Mode Active")).toBeInTheDocument();
    expect(screen.getByText(/1234/)).toBeInTheDocument();
  });

  it("renders the goal-drift variant with the message", () => {
    render(
      <ContextualBanner
        {...baseProps}
        kind="goal-drift"
        goalDriftMessage="Hedge score 30% — below your 60% goal."
        goalDriftActionLabel="Rebalance"
      />,
    );
    expect(screen.getByText("Goal Drift")).toBeInTheDocument();
    expect(
      screen.getByText("Hedge score 30% — below your 60% goal."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rebalance/)).toBeInTheDocument();
  });

  it("renders the daily-claim variant", () => {
    render(
      <ContextualBanner
        {...baseProps}
        kind="daily-claim"
        dailyClaimText="3-day streak"
      />,
    );
    expect(screen.getByText("Daily Reward Ready")).toBeInTheDocument();
    expect(screen.getByText("3-day streak")).toBeInTheDocument();
  });

  it("renders only ONE banner at a time (priority semantics)", () => {
    // The component takes a single `kind` prop. This test documents the
    // design decision: the parent (useHomeSections) picks the winner and
    // passes it down. The component itself never renders two variants.
    const { container } = render(
      <ContextualBanner {...baseProps} kind="cold-start" />,
    );
    // Cold-start copy present
    expect(screen.getByText("Add funds to start")).toBeInTheDocument();
    // Demo copy NOT present
    expect(screen.queryByText("Preview Mode Active")).not.toBeInTheDocument();
    // Goal-drift copy NOT present
    expect(screen.queryByText("Goal Drift")).not.toBeInTheDocument();
    // Daily-claim copy NOT present
    expect(screen.queryByText("Daily Reward Ready")).not.toBeInTheDocument();
    // Container is a single top-level motion.div
    expect(container.children.length).toBe(1);
  });
});

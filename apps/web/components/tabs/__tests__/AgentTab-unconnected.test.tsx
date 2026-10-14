import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Walletless: the morph under test.
let mockAddress: string | null = null;

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({ financialStrategy: null, setFinancialStrategy: () => {} }),
}));
vi.mock("../../../context/app/StrategyContext", () => ({
  useStrategy: () => ({ financialStrategy: null, setFinancialStrategy: () => {} }),
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: mockAddress }),
}));

vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({ enableDemoMode: mockEnableDemo, demoMode: { isActive: false } }),
}));

const mockEnableDemo = vi.fn();

vi.mock("@/hooks/use-agent-status", () => ({
  useAgentStatus: () => ({
    autonomousStatus: null,
    isLoading: false,
    statusError: null,
    initializeAI: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-agent-config", () => ({
  useAgentConfig: () => ({
    config: {},
    updateConfig: vi.fn(),
  }),
}));

vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({ experienceMode: "simple" }),
}));

vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: vi.fn() }),
}));

const navState = {
  guardianContext: null as {
    summary: string;
    prompt: string;
    example?: boolean;
  } | null,
  clearGuardianContext: vi.fn(),
  navigateToGuardian: vi.fn(),
};
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => navState,
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => <button type="button">Connect wallet</button>,
}));

vi.mock("@/hooks/use-guardian-instrument", () => ({
  useGuardianInstrument: () => {
    throw new Error("guardian hook must not mount for a walletless wallet");
  },
}));

vi.mock("@/components/agent/AutomationSettings", () => ({
  default: () => <div data-testid="automation-settings" />,
}));

// The mascot is a framer-motion SVG — stub it; its behavior is tested
// in its own suite. What matters here is THAT it renders as the object.
vi.mock("@/components/shared/GuardianMascot", () => ({
  GuardianMascot: (props: { size?: number; mood?: string }) => (
    <div data-testid="guardian-mascot" data-size={props.size ?? null} data-mood={props.mood} />
  ),
}));

vi.mock("@/components/shared/VerifiedEvidence", () => ({
  VerifiedEvidence: () => <div data-testid="verified-evidence">Verified</div>,
}));

let mockSeries: { dates: string[]; values: number[] } | null = null;
vi.mock("@/hooks/use-currency-risk", () => ({
  useCurrencyRisk: () => ({ currencyCode: "NGN" }),
}));
vi.mock("@/components/swap/CorridorContext", () => ({
  useLiveCurrencyRisk: (code: string | null) =>
    code && mockSeries ? { depreciation1yr: null, asOf: "2026-02-01", series: mockSeries } : null,
}));

import AgentTab from "../AgentTab";

describe("AgentTab — unconnected morph", () => {
  beforeEach(() => {
    navState.guardianContext = null;
    navState.clearGuardianContext.mockClear();
  });

  it("a Shield example hand-off lands straight in the example — consumed once, no intro detour", async () => {
    navState.guardianContext = {
      summary: "An example Guardian decision",
      prompt: "Show me an example Guardian decision",
      example: true,
    };
    const { rerender } = render(<AgentTab />);

    await waitFor(() =>
      expect(screen.getByTestId("guardian-example")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("guardian-example")).toHaveTextContent(
      "Example decision · not live",
    );
    rerender(<AgentTab />);
    expect(navState.clearGuardianContext).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/your Shield plan/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
  });

  it("opens on the labelled example — the Guardian demonstrates itself, connect CTA attached", () => {
    render(<AgentTab />);

    expect(screen.getByTestId("guardian-example")).toHaveTextContent("Example decision · not live");
    expect(screen.getByTestId("guardian-example-mark")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(mockEnableDemo).not.toHaveBeenCalled();
  });

  it("makes the Guardian itself the intro object, with the connect CTA attached", () => {
    render(<AgentTab />);
    fireEvent.click(screen.getByRole("button", { name: /Back to Guardian/ }));

    expect(screen.getByTestId("guardian-mascot")).toBeInTheDocument();
    // Gaze surface: the mascot renders at hero size (not the 82px chat size,
    // not compact) — it is the tab's one expressive object.
    expect(screen.getByTestId("guardian-mascot").getAttribute("data-size")).toBe("112");
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    // Two buttons total: the connect CTA + the example link — nothing else.
    expect(screen.getAllByRole("button").length).toBe(2);
  });

  it("drops the marketing stack — no how-it-works, no hero copy", () => {
    render(<AgentTab />);
    fireEvent.click(screen.getByRole("button", { name: /Back to Guardian/ }));

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardian watches")).not.toBeInTheDocument();
    expect(screen.queryByText("Bounded execution")).not.toBeInTheDocument();
  });

  it("tapping the mark walks three decisions the Guardian performs, in the third person", async () => {
    render(<AgentTab />);
    const mark = screen.getByTestId("guardian-example-mark");
    expect(mark).toHaveAccessibleName("Next example decision, 1 of 3");
    expect(screen.getByTestId("guardian-example")).toHaveTextContent("Example decision · not live");

    fireEvent.click(mark);
    await waitFor(() =>
      expect(screen.getByTestId("guardian-example")).toHaveTextContent("Propose a move"),
    );
    expect(screen.getByTestId("guardian-example")).toHaveTextContent("You sign in Exchange.");
    expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "alert");
    expect(mark).toHaveAccessibleName("Next example decision, 2 of 3");

    fireEvent.click(mark);
    await waitFor(() =>
      expect(screen.getByTestId("guardian-example")).toHaveTextContent("Show the work"),
    );
    expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "neutral");

    // Wraps around, and the label stays honest at every step.
    fireEvent.click(mark);
    await waitFor(() =>
      expect(screen.getByTestId("guardian-example")).toHaveTextContent("Wait for reliable data"),
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bI\b|\bI'm\b|\bmy\b/);
    expect(text).not.toMatch(/receipt:|0x[0-9a-f]{6}/i);
    expect(mockEnableDemo).not.toHaveBeenCalled();
  });

  it("keeps trust as a quiet status-tier line on the intro and teaches via a labeled example", async () => {
    render(<AgentTab />);

    const example = screen.getByTestId("guardian-example");
    expect(example).toHaveTextContent("Example decision · not live");
    expect(example).toHaveTextContent("Wait for reliable data");
    expect(example).toHaveTextContent("No trustworthy reading, so no move.");
    expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "protective");
    expect(screen.queryByTestId("verified-evidence")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(mockEnableDemo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Why this decision?" }));
    const inspector = screen.getByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "example-decision");
    expect(inspector).toHaveTextContent("stands down instead of guessing");
    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(screen.getByTestId("guardian-example")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument());
    expect(screen.getByTestId("guardian-example")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back to Guardian/ }));
    expect(screen.queryByTestId("guardian-example")).not.toBeInTheDocument();
    expect(screen.getByTestId("verified-evidence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "See an example decision" }));
    expect(screen.getByTestId("guardian-example")).toBeInTheDocument();
  });

  it("replays the visitor's own currency's sharpest month, labelled past data", async () => {
    mockSeries = {
      dates: ["2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01"],
      values: [100, 99, 90, 88],
    };
    try {
      render(<AgentTab />);
      const replay = screen.getByTestId("guardian-example");
      expect(replay).toHaveTextContent("Replay · NGN vs USD · past data");
      expect(replay).toHaveTextContent("Nov 2025");
      fireEvent.click(screen.getByTestId("guardian-example-mark"));
      await waitFor(() => expect(replay).toHaveTextContent("NGN −9.1% in 30 days"));
      expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "alert");
    } finally {
      mockSeries = null;
    }
  });
});

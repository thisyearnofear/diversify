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
  useNavigationOptional: () => navState,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: {} }),
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
  VerifiedEvidencePanel: () => (
    <div data-testid="verified-evidence-panel">Panel</div>
  ),
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

  it("opens on the watch board — capability first, the example behind its pill", () => {
    render(<AgentTab />);

    expect(screen.getByTestId("guardian-watch-view")).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-example")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(mockEnableDemo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Example decision" }));
    expect(screen.getByTestId("guardian-example")).toHaveTextContent("Example decision · not live");
    expect(screen.getByTestId("guardian-example-mark")).toBeInTheDocument();
  });

  it("makes the Guardian itself the intro object, with the connect CTA attached", () => {
    render(<AgentTab />);
    // The presenter control owns the exits: the active pill folds its mode.
    fireEvent.click(screen.getByRole("button", { name: "What it watches" }));

    expect(screen.getByTestId("guardian-mascot")).toBeInTheDocument();
    // Gaze surface: the mascot renders at hero size (not the 82px chat size,
    // not compact) — it is the tab's one expressive object.
    expect(screen.getByTestId("guardian-mascot").getAttribute("data-size")).toBe("112");
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    // Four buttons total: the connect CTA + the three presenter pills —
    // the walletless watching layer (plan §12 W1) under one control.
    expect(screen.getAllByRole("button").length).toBe(4);
    expect(
      screen.getByRole("button", { name: "What it watches" }),
    ).toBeInTheDocument();
    // The live line carries real watch beats even with no wallet.
    expect(screen.getByTestId("guardian-live-line")).toBeInTheDocument();
  });

  it("performs the watching board in place — no sheet, then the deck one tap behind", async () => {
    render(<AgentTab />);

    // W7: the walletless tab arrives on the gauge board — the fallback
    // queue names real moneys on the first frame, and no InspectorSheet
    // opens for the first view.
    const view = await screen.findByTestId("guardian-watch-view");
    expect(view).toHaveTextContent("What the Guardian watches");
    expect(view).toHaveTextContent("kept of a five-years-ago dollar");
    await waitFor(() =>
      expect(view.textContent).toMatch(/~\d+¢/),
    );
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    // The Guardian narrates — it holds the thinking posture while reading.
    expect(screen.getByTestId("guardian-mascot")).toHaveAttribute(
      "data-mood",
      "thinking",
    );

    // The deep deck is still one tap behind, in the inspector sheet.
    fireEvent.click(
      screen.getByRole("button", { name: /Full board/ }),
    );
    const inspector = await screen.findByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "board");
    await waitFor(() =>
      expect(inspector.textContent).toMatch(/NGN|KES|kept/),
    );

    // Closing the deck returns to the strip, not to nothing. The deck's
    // live content (rotating cards, async poll) keeps mutating height
    // mid-exit under jsdom, so the fold spring can stall — assert the
    // close initiated (sheet inert/exiting) and the strip is back.
    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    await waitFor(() => {
      const sheet = screen.queryByTestId("inspector-sheet");
      expect(sheet === null || sheet.hasAttribute("inert")).toBe(true);
    });
    expect(screen.getByTestId("guardian-watch-view")).toBeInTheDocument();
  });

  it("folds the board away with the same pill, and reopens it", async () => {
    render(<AgentTab />);

    await screen.findByTestId("guardian-watch-view");
    fireEvent.click(screen.getByRole("button", { name: "What it watches" }));
    await waitFor(() =>
      expect(screen.queryByTestId("guardian-watch-view")).not.toBeInTheDocument(),
    );
    // The presenter closes back on the resting intro, not another mode.
    expect(screen.queryByTestId("guardian-example")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "What it watches" }));
    expect(screen.getByTestId("guardian-watch-view")).toBeInTheDocument();
  });


  it("tapping the mark walks three decisions the Guardian performs, in the third person", async () => {
    render(<AgentTab />);
    fireEvent.click(screen.getByRole("button", { name: "Example decision" }));
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

  it("turns the reading into the verifier — a mode of the slot, never a panel below", async () => {
    render(<AgentTab />);

    // Arrival is the board alone: the check is not bolted underneath it,
    // and no accordion waits to push the viewport open.
    const board = await screen.findByTestId("guardian-watch-view");
    expect(board).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-verify-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("verified-evidence")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(screen.getByTestId("guardian-verify-view")).toBeInTheDocument();
    expect(screen.getByTestId("verified-evidence-panel")).toBeInTheDocument();
    // One thing on the stage at a time — the board withdrew into its pill.
    expect(screen.queryByTestId("guardian-watch-view")).not.toBeInTheDocument();

    // The other pills carry their own verb and take the check with them.
    fireEvent.click(screen.getByRole("button", { name: "Example decision" }));
    expect(screen.queryByTestId("guardian-verify-view")).not.toBeInTheDocument();
    expect(screen.getByTestId("guardian-example")).toBeInTheDocument();

    // The active pill is the exit: it re-opens, then folds back to the
    // resting intro — never onto another mode.
    fireEvent.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(screen.getByTestId("guardian-verify-view")).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-example")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify evidence" }));
    expect(screen.queryByTestId("guardian-verify-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardian-example")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Your savings stay in your wallet/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "What it watches" }));
    expect(screen.getByTestId("guardian-watch-view")).toBeInTheDocument();
  });

  it("greets a returner with a 'Since' lead only when the watch changed", async () => {
    const key = "diversifi:last-visit:guardian-watch";
    // Last visit knew only the naira beat; a week has passed.
    window.localStorage.setItem(
      key,
      JSON.stringify({
        value: { keys: ["watch-nation-NGN"] },
        at: Date.now() - 7 * 3_600_000,
      }),
    );
    try {
      render(<AgentTab />);
      await waitFor(() =>
        expect(screen.getByTestId("guardian-live-line")).toHaveTextContent(
          "Since ",
        ),
      );
    } finally {
      window.localStorage.removeItem(key);
    }
  });

  it("says nothing on return when the watch is unchanged", async () => {
    const key = "diversifi:last-visit:guardian-watch";
    // Both fallback watch beats were already known last visit.
    window.localStorage.setItem(
      key,
      JSON.stringify({
        value: { keys: ["watch-nation-NGN", "watch-nation-KES"] },
        at: Date.now() - 7 * 3_600_000,
      }),
    );
    try {
      render(<AgentTab />);
      await waitFor(() =>
        expect(screen.getByTestId("guardian-live-line")).toHaveTextContent(
          "Watching the",
        ),
      );
      expect(screen.getByTestId("guardian-live-line")).not.toHaveTextContent(
        "Since ",
      );
    } finally {
      window.localStorage.removeItem(key);
    }
  });

  it("replays the visitor's own currency's sharpest month, labelled past data", async () => {
    mockSeries = {
      dates: ["2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01"],
      values: [100, 99, 90, 88],
    };
    try {
      render(<AgentTab />);
      // The replay lives behind its own pill now — labelled with the code.
      fireEvent.click(screen.getByRole("button", { name: "Replay NGN" }));
      const replay = screen.getByTestId("guardian-example");
      expect(replay).toHaveTextContent("Past data replay · NGN vs USD");
      expect(replay).toHaveTextContent("Nov 2025");
      fireEvent.click(screen.getByTestId("guardian-example-mark"));
      await waitFor(() => expect(replay).toHaveTextContent("NGN −9.1% in 30 days"));
      expect(screen.getByTestId("guardian-mascot")).toHaveAttribute("data-mood", "alert");
    } finally {
      mockSeries = null;
    }
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Walletless: the morph under test.
let mockAddress: string | null = null;

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
  useExperience: () => ({ experienceMode: "beginner" }),
}));

vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: vi.fn() }),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => <button type="button">Connect wallet</button>,
}));

vi.mock("@/components/agent/AgentTierStatus", () => ({
  AgentTierStatus: () => <div data-testid="agent-tier-status" />,
}));

vi.mock("@/components/agent/AutomationSettings", () => ({
  default: () => <div data-testid="automation-settings" />,
}));

// The mascot is a framer-motion SVG — stub it; its behavior is tested
// in its own suite. What matters here is THAT it renders as the object.
vi.mock("@/components/shared/GuardianMascot", () => ({
  GuardianMascot: (props: { size?: number }) => (
    <div data-testid="guardian-mascot" data-size={props.size ?? null} />
  ),
}));

vi.mock("@/components/shared/VerifiedEvidence", () => ({
  VerifiedEvidence: () => <div data-testid="verified-evidence">Verified</div>,
}));

import AgentTab from "../AgentTab";

describe("AgentTab — unconnected morph", () => {
  it("makes the Guardian itself the object, with the connect CTA attached", () => {
    render(<AgentTab />);

    expect(screen.getByTestId("guardian-mascot")).toBeInTheDocument();
    // Gaze surface: the mascot renders at hero size (not the 82px chat size,
    // not compact) — it is the tab's one expressive object.
    expect(screen.getByTestId("guardian-mascot").getAttribute("data-size")).toBe("112");
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    // Two buttons total: the connect CTA + the demo text link — nothing else.
    expect(screen.getAllByRole("button").length).toBe(2);
  });

  it("drops the marketing stack — no how-it-works, no hero copy", () => {
    render(<AgentTab />);

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardian watches")).not.toBeInTheDocument();
    expect(screen.queryByText("Bounded execution")).not.toBeInTheDocument();
  });

  it("keeps trust + demo as quiet status-tier lines (shared tier)", () => {
    render(<AgentTab />);

    expect(screen.getByTestId("verified-evidence")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore a sample plan" }));
    expect(mockEnableDemo).toHaveBeenCalledTimes(1);
  });
});

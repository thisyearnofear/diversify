// @vitest-environment jsdom
/**
 * The Guardian trust moment: what each grant surface promises must match
 * what the permission actually does.
 *
 * - Daily limit (COPILOT) is proposal-only — the loop never executes it —
 *   so its copy must never say Guardian swaps/acts on its own.
 * - The autonomy opt-in (GuardianGrantModal) is the ONE place that says
 *   Guardian may act without asking, states the signed limit read-only
 *   (no second limit picker), and names both signatures.
 * - Limits & controls holds limits only; preferences sit behind one link.
 */
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GuardianPermissionModal } from "../GuardianPermissionModal";
import { GuardianGrantModal } from "../GuardianGrantModal";
import { GuardianBoundsSheet } from "../GuardianBoundsSheet";
import { DAILY_LIMIT_PRESETS } from "@/constants/guardian-limits";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("../../shared/Scrim", () => ({ default: () => null }));
vi.mock("../LoopResultSummary", () => ({ LoopResultSummary: () => null }));

afterEach(() => cleanup());

function permissionModal(over: Partial<Parameters<typeof GuardianPermissionModal>[0]> = {}) {
  const props = {
    pendingDailyLimit: 10,
    setPendingDailyLimit: vi.fn(),
    DAILY_LIMIT_PRESETS,
    isChainSupported: true,
    isLowOnFunds: false,
    hasNonStableButNoStable: false,
    nonStableBalanceOnChain: 0,
    currentChainName: "Celo",
    stableBalanceTotal: 40,
    portfolioLoading: false,
    switchToChain: vi.fn(),
    onCancel: vi.fn(),
    onApprove: vi.fn(),
    ...over,
  };
  render(<GuardianPermissionModal {...props} />);
  return props;
}

function boundsSheet(over: Partial<Parameters<typeof GuardianBoundsSheet>[0]> = {}) {
  const props = {
    hasValidPermission: true,
    dailyLimit: 25,
    sessionInfo: {
      active: true,
      dailyLimitUSD: 25,
      spentTodayUSD: 5,
      remainingTodayUSD: 20,
      executionCount: 2,
      recentExecutions: [],
    } as unknown as GuardianSessionInfo,
    permissionExpiry: "10/4/2026",
    isRunningLoop: false,
    onRunNow: vi.fn(),
    loopResult: null,
    sessionKeyError: null,
    isRevoking: false,
    onRevoke: vi.fn(),
    onSetLimit: vi.fn(),
    vault: { vault: { strategy: "africapitalism" } } as never,
    onChangeStrategy: vi.fn(),
    walletStableBalanceUSD: 40,
    isOnGrantEligibleChain: true,
    grantAvailable: true,
    grantStatus: "idle" as const,
    grantError: null,
    onOpenGrantModal: vi.fn(),
    onSwitchToGrantChain: vi.fn(),
    onOpenSettings: vi.fn(),
    ...over,
  };
  render(<GuardianBoundsSheet {...props} />);
  return props;
}

describe("GuardianPermissionModal — daily limit (proposal-only)", () => {
  it("says nothing moves without approval, never that Guardian swaps on its own", () => {
    permissionModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Nothing moves until you approve it");
    expect(dialog).toHaveTextContent("You approve each one");
    expect(dialog).not.toHaveTextContent(/may swap|Auto-Saver/);
  });

  it("the chip sets the pending limit and the one CTA signs", () => {
    const props = permissionModal();
    fireEvent.click(screen.getByRole("button", { name: "$25" }));
    expect(props.setPendingDailyLimit).toHaveBeenCalledWith(25);
    fireEvent.click(screen.getByRole("button", { name: "Sign in wallet" }));
    expect(props.onApprove).toHaveBeenCalledTimes(1);
  });

  it("an unsupported chain disables signing and offers the switch", () => {
    const props = permissionModal({ isChainSupported: false });
    expect(screen.getByRole("button", { name: "Switch network first" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Celo" }));
    expect(props.switchToChain).toHaveBeenCalledWith(42220);
  });
});

describe("GuardianGrantModal — the one autonomy opt-in", () => {
  it("states the signed limit read-only — no second limit picker", () => {
    render(<GuardianGrantModal dailyLimit={25} onCancel={vi.fn()} onContinue={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Let Guardian act for you" });
    expect(dialog).toHaveTextContent("$25 a day");
    for (const amount of DAILY_LIMIT_PRESETS) {
      expect(within(dialog).queryByRole("button", { name: `$${amount}` })).not.toBeInTheDocument();
    }
  });

  it("says plainly that Guardian acts without asking, and names both signatures", () => {
    render(<GuardianGrantModal dailyLimit={10} onCancel={vi.fn()} onContinue={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("without asking each time");
    expect(dialog).toHaveTextContent("sign twice");
    expect(dialog).toHaveTextContent("In MetaMask");
  });

  it("Continue hands off; Cancel does not", () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    render(<GuardianGrantModal dailyLimit={10} onCancel={onCancel} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue to MetaMask" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("GuardianBoundsSheet — Limits & controls holds limits only", () => {
  it("renders limits, pause and the plan — preferences live behind one link", () => {
    const props = boundsSheet();
    expect(screen.getByText("$25/day")).toBeInTheDocument();
    expect(screen.getByText("Protection plan")).toBeInTheDocument();
    expect(screen.queryByText(/Voice|Email|Zapier|Protection Settings/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notifications & integrations →" }));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause Guardian" }));
    expect(props.onRevoke).toHaveBeenCalledTimes(1);
  });

  it("proposal-only copy by default; autonomy copy only for a GUARDIAN-tier permission", () => {
    boundsSheet();
    expect(screen.getByText(/You approve each one in your wallet/)).toBeInTheDocument();
    cleanup();
    boundsSheet({ isAutonomous: true, grantStatus: "granted" });
    expect(screen.getByText(/on its own within this limit/)).toBeInTheDocument();
    expect(screen.queryByText(/You approve each one/)).not.toBeInTheDocument();
  });

  it("no signed limit: one CTA sets it, and the autonomy opt-in is not offered", () => {
    const props = boundsSheet({ hasValidPermission: false, sessionInfo: null });
    fireEvent.click(screen.getByRole("button", { name: "Set daily limit" }));
    expect(props.onSetLimit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Let Guardian act/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause Guardian" })).not.toBeInTheDocument();
  });

  it("an empty wallet says why nothing is proposed", () => {
    boundsSheet({ walletStableBalanceUSD: 1 });
    expect(screen.getByText(/Waiting for funds/)).toBeInTheDocument();
  });

  it("plan drift: when Shield's plan differs, the sheet says so and offers one-tap Follow", () => {
    const onFollowShieldPlan = vi.fn();
    boundsSheet({ shieldPlan: "buen_vivir", shieldPlanName: "Buen Vivir", onFollowShieldPlan });
    expect(screen.getByTestId("guardian-plan-mismatch")).toHaveTextContent("Your Shield plan is Buen Vivir");
    fireEvent.click(screen.getByRole("button", { name: "Follow Buen Vivir" }));
    expect(onFollowShieldPlan).toHaveBeenCalledTimes(1);
  });

  it("a local Custom plan never offers Follow — Guardian keeps its server plan", () => {
    const onFollowShieldPlan = vi.fn();
    boundsSheet({ shieldPlan: "custom", shieldPlanName: "Custom", onFollowShieldPlan });
    expect(screen.getByTestId("guardian-plan-custom-local")).toHaveTextContent(
      "Guardian keeps following Africapitalism — Custom plans live on this device.",
    );
    expect(screen.queryByRole("button", { name: /^Follow/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardian-plan-mismatch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change plan" })).toBeInTheDocument();
    expect(onFollowShieldPlan).not.toHaveBeenCalled();
  });

  it("no drift: no mismatch line, Change plan stays", () => {
    boundsSheet({ shieldPlan: "africapitalism", shieldPlanName: "Africapitalism" });
    expect(screen.queryByTestId("guardian-plan-mismatch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change plan" })).toBeInTheDocument();
  });
});

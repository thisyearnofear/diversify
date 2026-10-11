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
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GuardianPermissionModal } from "../GuardianPermissionModal";
import { GuardianGrantModal } from "../GuardianGrantModal";
import { GuardianBoundsSheet } from "../GuardianBoundsSheet";
import { DAILY_LIMIT_PRESETS } from "@/constants/guardian-limits";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";
import { BalanceVisibilityProvider } from "@/context/app/BalanceVisibilityContext";

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn(), haptics: { confirm: vi.fn() } }));
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
    onEditPlanInShield: vi.fn(),
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

  it("the seal requires a sustained hold — a click or early release signs nothing", () => {
    // rAF must be faked explicitly — it is not in vitest's default toFake.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    try {
      const onContinue = vi.fn();
      render(<GuardianGrantModal dailyLimit={10} onCancel={vi.fn()} onContinue={onContinue} />);
      const holdButton = screen.getByRole("button", { name: "Hold to let Guardian act" });
      fireEvent.click(holdButton);
      fireEvent.pointerDown(holdButton);
      act(() => vi.advanceTimersByTime(400));
      fireEvent.pointerUp(holdButton);
      act(() => vi.advanceTimersByTime(2000));
      expect(onContinue).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a full hold hands off to MetaMask exactly once; Cancel does not", () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    try {
      const onContinue = vi.fn();
      const onCancel = vi.fn();
      render(<GuardianGrantModal dailyLimit={10} onCancel={onCancel} onContinue={onContinue} />);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onContinue).not.toHaveBeenCalled();
      const holdButton = screen.getByRole("button", { name: "Hold to let Guardian act" });
      fireEvent.pointerDown(holdButton);
      act(() => vi.advanceTimersByTime(1600));
      expect(onContinue).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(holdButton);
      act(() => vi.advanceTimersByTime(500));
      expect(onContinue).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

  it("masks the account-specific budget throughout bounds without changing the grant confirmation", () => {
    localStorage.setItem("diversifi.balances.hidden", "1");
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
      } as GuardianSessionInfo,
      permissionExpiry: "10/4/2026",
      isRunningLoop: false,
      onRunNow: vi.fn(),
      loopResult: null,
      sessionKeyError: null,
      isRevoking: false,
      onRevoke: vi.fn(),
      onSetLimit: vi.fn(),
      vault: { vault: { strategy: "africapitalism" } } as never,
      onEditPlanInShield: vi.fn(),
      walletStableBalanceUSD: 40,
      isOnGrantEligibleChain: true,
      grantAvailable: true,
      grantStatus: "idle" as const,
      grantError: null,
      onOpenGrantModal: vi.fn(),
      onSwitchToGrantChain: vi.fn(),
      onOpenSettings: vi.fn(),
    };
    render(<BalanceVisibilityProvider><GuardianBoundsSheet {...props} /></BalanceVisibilityProvider>);
    expect(screen.getByText("••••/day")).toBeInTheDocument();
    expect(screen.getAllByText("••••")).toHaveLength(2);
    expect(screen.getByText(/may move up to ••••\/day/)).toBeInTheDocument();
    expect(screen.queryByText(/\$25\/day/)).not.toBeInTheDocument();
    localStorage.removeItem("diversifi.balances.hidden");
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

  it("plan drift: unsynced targets offer an explicit sync for measured review", () => {
    const onFollowShieldPlan = vi.fn();
    boundsSheet({ planSyncNeeded: true, shieldPlanName: "Buen Vivir", onFollowShieldPlan });
    expect(screen.getByTestId("guardian-plan-unsynced")).toHaveTextContent("On this device — Shield plan: Buen Vivir");
    fireEvent.click(screen.getByRole("button", { name: "Sync targets for measured review" }));
    expect(onFollowShieldPlan).toHaveBeenCalledTimes(1);
  });

  it("a connected wallet with no server plan still gets the explicit sync", () => {
    const onFollowShieldPlan = vi.fn();
    boundsSheet({
      vault: { vault: null } as never,
      planSyncNeeded: true,
      shieldPlanName: "Buen Vivir",
      onFollowShieldPlan,
    });
    expect(screen.getByText("None synced")).toBeInTheDocument();
    expect(screen.getByTestId("guardian-plan-unsynced")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync targets for measured review" }));
    expect(onFollowShieldPlan).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /plan in Shield/ })).not.toBeInTheDocument();
  });

  it("a failed sync surfaces the vault error, not a synced claim", () => {
    boundsSheet({
      vault: { vault: { strategy: "africapitalism" }, error: "Failed to update strategy" } as never,
      planSyncNeeded: true,
      onFollowShieldPlan: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to update strategy");
    expect(screen.getByTestId("guardian-plan-unsynced")).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-plan-synced")).not.toBeInTheDocument();
  });

  it("a synced plan says targets are synced for measured review, never followed", () => {
    boundsSheet({ planSynced: true, shieldPlan: "africapitalism" });
    expect(screen.getByTestId("guardian-plan-synced")).toHaveTextContent("Targets synced for measured review");
    expect(screen.queryByRole("button", { name: /Sync targets/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit plan in Shield" })).toBeInTheDocument();
  });

  it("a synced custom mix is labeled by its own mix and values, not the named id", () => {
    boundsSheet({ planSynced: true, shieldPlan: "custom", valuesPlanName: "Buen Vivir" });
    expect(screen.getByText("Custom mix · Buen Vivir values")).toBeInTheDocument();
    cleanup();
    boundsSheet({ planSynced: true, shieldPlan: "custom" });
    expect(screen.getByText("Custom mix")).toBeInTheDocument();
    expect(screen.queryByText("africapitalism")).not.toBeInTheDocument();
  });

  it("an unsynced custom keeps the server plan name and a separate on-device line", () => {
    boundsSheet({
      planSyncNeeded: true,
      shieldPlan: "custom",
      shieldPlanName: "Custom",
      onFollowShieldPlan: vi.fn(),
    });
    expect(screen.getByText("africapitalism")).toBeInTheDocument();
    expect(screen.getByTestId("guardian-plan-unsynced")).toHaveTextContent(
      "On this device — Shield plan: Custom",
    );
    expect(screen.queryByText(/Custom mix/)).not.toBeInTheDocument();
  });

  it("no drift and no sync state: the edit routes back to Shield", () => {
    const props = boundsSheet({ shieldPlan: "africapitalism" });
    expect(screen.queryByTestId("guardian-plan-unsynced")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardian-plan-synced")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit plan in Shield" }));
    expect(props.onEditPlanInShield).toHaveBeenCalledTimes(1);
  });

  it("a true blank state — no vault, no local plan — still offers the Shield door", () => {
    const props = boundsSheet({ vault: { vault: null } as never });
    expect(screen.getByText("None synced")).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-plan-unsynced")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardian-plan-synced")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose a plan in Shield" }));
    expect(props.onEditPlanInShield).toHaveBeenCalledTimes(1);
  });

  it("no local plan offers 'Choose a plan in Shield' instead", () => {
    boundsSheet({});
    expect(screen.getByRole("button", { name: "Choose a plan in Shield" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change plan|Use this plan/ })).not.toBeInTheDocument();
  });
});

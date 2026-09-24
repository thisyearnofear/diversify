// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { GuardianTierState } from "@diversifi/shared/src/services/vault/guardian-tier-state";

// Instrument composition: one CTA per state, budget/latest lines feed the
// inspector sheets, context wins over selection, no dead card-stack copy.
let mockAddress: string | null = "0xabc";
const mockAskAdvisor = vi.fn();
const mockClearGuardianContext = vi.fn();
const mockNavigateToFund = vi.fn();
let mockGuardianContext: unknown = null;
let mockExperienceMode = "advanced";

const mockSetShowPermissionModal = vi.fn();
const mockRunPreview = vi.fn();

let instrument: Record<string, unknown>;

function makeInstrument(over: Record<string, unknown> = {}) {
  const guardianState = (over.guardianState ?? "monitoring") as GuardianTierState;
  return {
    guardianState,
    copy: GUARDIAN_USER_COPY[guardianState],
    sessionInfo: null,
    hasValidPermission: false,
    dailyLimit: 0,
    guardianProofEvents: [] as any[],
    latestCall: null,
    isAnalyzing: false,
    setShowPermissionModal: mockSetShowPermissionModal,
    runPreview: mockRunPreview,
    runNow: vi.fn(),
    isLowOnFunds: false,
    isRunningLoop: false,
    loopResult: null,
    anchorByTxHash: new Map(),
    permissionExpiry: null,
    sessionKeyError: null,
    isRevoking: false,
    handleRevokePermission: vi.fn(),
    vault: { vault: null, error: null, updateStrategy: vi.fn() },
    setShowStrategySwitcher: vi.fn(),
    hasTokenVault: false,
    stableBalanceOnChain: { total: 0, tokens: [] as any[] },
    isOnArbitrum: true,
    grantStatus: "idle",
    grantError: null,
    setShowGrantConfirmModal: vi.fn(),
    switchToChain: vi.fn(),
    showPermissionModal: false,
    showGrantConfirmModal: false,
    showStrategySwitcher: false,
    pendingDailyLimit: 0,
    setPendingDailyLimit: vi.fn(),
    DAILY_LIMIT_PRESETS: [],
    isChainSupported: true,
    hasNonStableButNoStable: false,
    nonStableBalanceOnChain: null,
    currentChainName: "Celo",
    portfolio: { isLoading: false },
    handleRequestPermission: vi.fn(),
    handleGrantAdvanced: vi.fn(),
    ...over,
  };
}

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: mockAddress, chainId: 42220 }),
}));
vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({ enableDemoMode: vi.fn(), demoMode: { isActive: false } }),
}));
vi.mock("@/hooks/use-agent-status", () => ({
  useAgentStatus: () => ({
    autonomousStatus: null,
    isLoading: false,
    statusError: null,
    initializeAI: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-agent-config", () => ({
  useAgentConfig: () => ({ config: {}, updateConfig: vi.fn() }),
}));
vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({ experienceMode: mockExperienceMode }),
}));
vi.mock("@/hooks/use-advisor", () => ({
  useAdvisor: () => ({ askAdvisor: mockAskAdvisor }),
}));
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    guardianContext: mockGuardianContext,
    clearGuardianContext: mockClearGuardianContext,
    navigateToGuardian: vi.fn(),
  }),
}));
vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => <button type="button">Connect wallet</button>,
}));
vi.mock("@/hooks/use-guardian-instrument", () => ({
  useGuardianInstrument: () => instrument,
}));
vi.mock("@/components/agent/GuardianJournalSheet", () => ({
  GuardianJournalSheet: () => <div data-testid="guardian-journal-sheet" />,
}));
vi.mock("@/components/agent/GuardianBoundsSheet", () => ({
  GuardianBoundsSheet: () => <div data-testid="guardian-bounds-sheet" />,
}));
vi.mock("@/components/agent/AutomationSettings", () => ({
  default: () => <div data-testid="automation-settings" />,
}));
vi.mock("@/components/shared/GuardianMascot", () => ({
  GuardianMascot: () => <div data-testid="guardian-mascot" />,
}));
vi.mock("@/components/shared/VerifiedEvidence", () => ({
  VerifiedEvidence: () => <div data-testid="verified-evidence">Verified</div>,
}));

import AgentTab from "../AgentTab";

const monitoringSession = {
  active: true,
  dailyLimitUSD: 25,
  spentTodayUSD: 5,
  remainingTodayUSD: 20,
  executionCount: 1,
  recentExecutions: [],
};

describe("AgentTab — instrument composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockGuardianContext = null;
    mockExperienceMode = "advanced";
    instrument = makeInstrument();
  });

  it("idle: the one CTA opens the permission modal", () => {
    instrument = makeInstrument({ guardianState: "idle" });
    render(<AgentTab onNavigateToFund={mockNavigateToFund} />);
    fireEvent.click(
      screen.getByRole("button", { name: GUARDIAN_USER_COPY.idle.cta }),
    );
    expect(mockSetShowPermissionModal).toHaveBeenCalledWith(true);
    expect(mockNavigateToFund).not.toHaveBeenCalled();
    expect(mockRunPreview).not.toHaveBeenCalled();
  });

  it("funded: the one CTA opens the permission modal", () => {
    instrument = makeInstrument({ guardianState: "funded" });
    render(<AgentTab onNavigateToFund={mockNavigateToFund} />);
    fireEvent.click(
      screen.getByRole("button", { name: GUARDIAN_USER_COPY.funded.cta }),
    );
    expect(mockSetShowPermissionModal).toHaveBeenCalledWith(true);
  });

  it("authorized: the one CTA routes to funding", () => {
    instrument = makeInstrument({ guardianState: "authorized" });
    render(<AgentTab onNavigateToFund={mockNavigateToFund} />);
    fireEvent.click(
      screen.getByRole("button", { name: GUARDIAN_USER_COPY.authorized.cta }),
    );
    expect(mockNavigateToFund).toHaveBeenCalledTimes(1);
    expect(mockSetShowPermissionModal).not.toHaveBeenCalled();
  });

  it("authorized without a funding route shows no CTA", () => {
    instrument = makeInstrument({ guardianState: "authorized" });
    render(<AgentTab />);
    expect(
      screen.queryByRole("button", { name: GUARDIAN_USER_COPY.authorized.cta }),
    ).not.toBeInTheDocument();
  });

  it("monitoring: Preview next move opens the journal and runs a dry run", () => {
    instrument = makeInstrument({ guardianState: "monitoring" });
    render(<AgentTab />);
    fireEvent.click(screen.getByRole("button", { name: "Preview next move" }));
    expect(mockRunPreview).toHaveBeenCalledTimes(1);
    const inspector = screen.getByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "journal");
    expect(within(inspector).getByTestId("guardian-journal-sheet")).toBeInTheDocument();
  });

  it("budget line opens the Limits & controls sheet", () => {
    instrument = makeInstrument({
      guardianState: "monitoring",
      hasValidPermission: true,
      sessionInfo: monitoringSession,
      dailyLimit: 25,
    });
    render(<AgentTab />);
    fireEvent.click(screen.getByTestId("guardian-budget"));
    const inspector = screen.getByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "bounds");
    expect(within(inspector).getByTestId("guardian-bounds-sheet")).toBeInTheDocument();
  });

  it("latest line opens the Guardian journal sheet", () => {
    instrument = makeInstrument({ guardianState: "monitoring", latestCall: "rotate to KESm" });
    render(<AgentTab />);
    fireEvent.click(screen.getByTestId("guardian-latest"));
    const inspector = screen.getByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "journal");
    expect(within(inspector).getByText("Guardian journal")).toBeInTheDocument();
  });

  it("a pending Shield context beats the open sheet", () => {
    instrument = makeInstrument({ guardianState: "monitoring", latestCall: "x" });
    const { rerender } = render(<AgentTab />);
    fireEvent.click(screen.getByTestId("guardian-latest"));
    expect(screen.getByTestId("inspector-sheet")).toHaveAttribute("data-selected-id", "journal");

    mockGuardianContext = { summary: "Plan gap", prompt: "Guardian, fix it" };
    rerender(<AgentTab />);
    // The journal sheet may linger as an exit-animation copy; the live
    // (context) sheet must not contain it.
    const sheets = screen.getAllByTestId("inspector-sheet");
    const contextSheet = sheets.find(
      (s) => s.getAttribute("data-selected-id") === "context",
    );
    expect(contextSheet).toBeTruthy();
    expect(within(contextSheet as HTMLElement).getByTestId("guardian-context")).toBeInTheDocument();
    expect(
      within(contextSheet as HTMLElement).queryByTestId("guardian-journal-sheet"),
    ).not.toBeInTheDocument();
  });

  it("Change limits hides while the budget line shows, and for beginners", () => {
    instrument = makeInstrument({
      guardianState: "monitoring",
      hasValidPermission: true,
      sessionInfo: monitoringSession,
      dailyLimit: 25,
    });
    render(<AgentTab />);
    expect(screen.queryByRole("button", { name: "Change limits" })).not.toBeInTheDocument();
    cleanup();

    instrument = makeInstrument({ guardianState: "monitoring" });
    render(<AgentTab />);
    expect(screen.getByRole("button", { name: "Change limits" })).toBeInTheDocument();
    cleanup();

    mockExperienceMode = "beginner";
    render(<AgentTab />);
    expect(screen.queryByRole("button", { name: "Change limits" })).not.toBeInTheDocument();
  });

  it("retired card-stack copy never renders", () => {
    instrument = makeInstrument({
      guardianState: "monitoring",
      hasValidPermission: true,
      sessionInfo: monitoringSession,
      dailyLimit: 25,
      latestCall: "rotate to KESm",
    });
    render(<AgentTab />);
    const text = document.body.textContent ?? "";
    for (const dead of ["Total Savings", "Protection Performance", "Tier", "Proof chain"]) {
      expect(text).not.toContain(dead);
    }
  });
});

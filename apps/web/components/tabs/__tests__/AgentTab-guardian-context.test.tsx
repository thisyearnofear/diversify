import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GUARDIAN_USER_COPY } from "@diversifi/shared/src/services/vault/guardian-tier-state";

// F4 drill-down: the one-shot Guardian context card must show the attached
// journaled record VERBATIM (readable, not JSON) and hand it to Ask Guardian.
let mockAddress: string | null = "0xabc";
const mockAskAdvisor = vi.fn();
const mockClearGuardianContext = vi.fn();
let mockGuardianContext: unknown = null;

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
  useExperience: () => ({ experienceMode: "advanced" }),
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
const mockInstrument = {
  guardianState: "monitoring" as const,
  copy: GUARDIAN_USER_COPY.monitoring,
  sessionInfo: null,
  hasValidPermission: false,
  dailyLimit: 0,
  guardianProofEvents: [] as any[],
  latestCall: null,
  isAnalyzing: false,
  setShowPermissionModal: vi.fn(),
  runPreview: vi.fn(),
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
};

vi.mock("@/hooks/use-guardian-instrument", () => ({
  useGuardianInstrument: () => mockInstrument,
}));
vi.mock("@/components/agent/GuardianObject", () => ({
  GuardianObject: (props: { onOpenJournal?: () => void }) => (
    <div data-testid="guardian-object-inner" onClick={props.onOpenJournal} />
  ),
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

const DECISION_REF = {
  capturedAt: "2026-09-19T10:00:00.000Z",
  kind: "decision" as const,
  source: "guardian-loop",
  status: "daily_limit_reached",
  reason: "Daily budget spent",
  targetToken: "KESm",
  durationMs: 1180,
};

describe("AgentTab — Guardian context card drill-down", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuardianContext = null;
  });

  it("renders inside the inspector, not above the object", () => {
    mockGuardianContext = {
      summary: "Guardian stood down on KESm · 5m ago",
      prompt: "Guardian, you stood down on my KESm position…",
      decisionRef: DECISION_REF,
    };
    render(<AgentTab />);

    const inspector = screen.getByTestId("inspector-sheet");
    expect(inspector).toHaveAttribute("data-selected-id", "context");
    expect(within(inspector).getByText("From your Shield plan")).toBeInTheDocument();
    expect(within(inspector).getByTestId("guardian-context")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("guardian-object")).queryByTestId("guardian-context"),
    ).not.toBeInTheDocument();
  });

  it("closing the inspector clears the one-shot hand-off", () => {
    mockGuardianContext = {
      summary: "Plan gap on KESm",
      prompt: "Guardian, fix it",
    };
    render(<AgentTab />);

    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(mockClearGuardianContext).toHaveBeenCalledTimes(1);
  });

  it("renders the attached decision record verbatim", () => {
    mockGuardianContext = {
      summary: "Guardian stood down on KESm · 5m ago · decided in 1.2 s",
      prompt: "Guardian, you stood down on my KESm position…",
      decisionRef: DECISION_REF,
    };
    render(<AgentTab />);

    const card = screen.getByTestId("guardian-decision-ref");
    expect(card.textContent).toContain("Decision · KESm");
    expect(card.textContent).toContain("daily_limit_reached");
    expect(card.textContent).toContain("took 1.2 s");
    expect(card.textContent).toContain("Daily budget spent");
    expect(card.textContent).toContain("guardian-loop");
    // Readable, not a JSON dump.
    expect(card.textContent).not.toContain('{"');
  });

  it("passes the record to Ask Guardian and clears the one-shot hand-off", () => {
    mockGuardianContext = {
      summary: "Guardian stood down on KESm · 5m ago",
      prompt: "Guardian, you stood down on my KESm position…",
      decisionRef: DECISION_REF,
    };
    render(<AgentTab />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Guardian about this" }));
    expect(mockAskAdvisor).toHaveBeenCalledWith(
      "Guardian, you stood down on my KESm position…",
      { decisionRef: DECISION_REF },
    );
    expect(mockClearGuardianContext).toHaveBeenCalledTimes(1);
  });

  it("keeps the status tier within the 3-slot budget", () => {
    render(<AgentTab />);
    expect(document.querySelectorAll("[data-status-slot]").length).toBeLessThanOrEqual(3);
  });

  it("stays unchanged for plain hand-offs without a record", () => {
    mockGuardianContext = { summary: "Plan gap on KESm", prompt: "Guardian, fix it" };
    render(<AgentTab />);

    expect(screen.getByTestId("guardian-context")).toBeInTheDocument();
    expect(screen.queryByTestId("guardian-decision-ref")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask Guardian about this" }));
    expect(mockAskAdvisor).toHaveBeenCalledWith("Guardian, fix it", {
      decisionRef: undefined,
    });
  });
});

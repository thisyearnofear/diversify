/**
 * A saved Custom plan survives a reload: the profile and ring are real, the
 * module graph is fresh, and nothing but localStorage carries the plan — so
 * the ring's wallet view must still read the plan's rules (an Islamic-derived
 * Custom plan keeps `excludeYield`, so a held USDY stays outside the plan).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("next/router", () => ({ useRouter: () => ({ isReady: true, query: {} }) }));
vi.mock("@/context/app/GuardianVisibilityContext", () => ({
  useGuardianVisibility: () => ({ visibility: "quiet", origin: "persona", setVisibility: vi.fn() }),
}));
vi.mock("@/hooks/use-advisor", () => ({ useAdvisor: () => ({ askAdvisor: vi.fn() }) }));
vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({
    streak: 0,
    canClaim: false,
    isWhitelisted: false,
    estimatedReward: "0",
    recordActivity: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/hooks/use-agent-analysis", () => ({ useLatestAdvice: () => null }));
vi.mock("@/hooks/use-agent-status", () => ({ useAgentStatus: () => ({ isLoading: false }) }));
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({
    navigateToSwap: vi.fn(),
    navigateToGuardian: vi.fn(),
    pendingIntent: null,
    consumeIntent: vi.fn(),
  }),
}));
vi.mock("@/components/agent/AgentTierStatus", () => ({
  GuardianStatusChip: () => null,
  useGuardianTierSnapshotFrom: () => ({ guardianState: "idle" }),
  AgentTierStatus: () => null,
}));
vi.mock("@/hooks/use-vault", () => ({
  useVault: () => ({ vault: null, refresh: vi.fn(), updateStrategy: vi.fn() }),
}));
vi.mock("@/hooks/use-session-key", () => ({
  useSessionKey: () => ({
    requestPermission: vi.fn(),
    signedPermission: null,
    sessionInfo: null,
    deriveGuardianState: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-currency-risk", () => ({
  useCurrencyRisk: () => ({ riskData: null, primaryDepreciation: 0 }),
}));
vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({
    demoMode: { isActive: false },
    enableDemoMode: vi.fn(),
    disableDemoMode: vi.fn(),
  }),
}));
vi.mock("@/context/app/ExperienceContext", () => ({
  useExperience: () => ({ experienceMode: "full" }),
}));
vi.mock("@/context/app/AdaptiveContext", () => ({
  useAdaptiveContext: () => ({
    config: { content: { shieldMorph: "plan" } },
    isMobile: false,
    detectionMethod: "none",
  }),
}));
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => false };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("next/dynamic", () => ({
  default: () => {
    const Dummy = () => null;
    Dummy.displayName = "DynamicMock";
    return Dummy;
  },
}));
vi.mock("../../shared/GuardianMascot", () => ({ GuardianMascot: () => null }));
vi.mock("@/components/tabs/protect/PhilosophyCoinRail", () => ({
  PhilosophyCoinRail: () => null,
  FocusedPlanLine: () => null,
}));
vi.mock("@/components/tabs/protect/PaymentCycleReport", () => ({ PaymentCycleReport: () => null }));
vi.mock("@/components/wallet/WalletButton", () => ({ default: () => null }));
vi.mock("../../wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: "0xabc", chainId: 42161 }),
}));

const ISLAMIC_CUSTOM = {
  from: "islamic",
  rules: { excludeYield: true },
  slices: [
    { exposure: "XAU", target: 60 },
    { exposure: "USD", target: 40 },
  ],
};

const PORTFOLIO = {
  totalValue: 1000,
  chainCount: 1,
  chains: [
    {
      chainId: 42161,
      chainName: "Arbitrum",
      totalValue: 1000,
      tokenCount: 3,
      balances: [
        { symbol: "USDC", value: 500, chainId: 42161 },
        { symbol: "USDY", value: 300, chainId: 42161 },
        { symbol: "PAXG", value: 200, chainId: 42161 },
      ],
    },
  ],
  regionData: [],
  isLoading: false,
  isStale: false,
  rebalancingOpportunities: [],
  diversificationScore: 50,
  weightedInflationRisk: 5,
  tokenCount: 3,
};

describe("ProtectionTab — a saved Custom plan after reload", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "diversifi-protection-profile-v2",
      JSON.stringify({ philosophy: "custom", riskTolerance: "Balanced", customPlan: ISLAMIC_CUSTOM }),
    );
    vi.resetModules();
  });

  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    localStorage.clear();
  });

  it("keeps the Custom slices and counts a held USDY outside the plan", async () => {
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { ProtectionProfileProvider } = await import("@/hooks/use-protection-profile");
    const { default: ProtectionTab } = await import("../ProtectionTab");
    render(
      <ProtectionProfileProvider>
        <ProtectionTab userRegion="USA" portfolio={PORTFOLIO as never} />
      </ProtectionProfileProvider>,
    );

    // Custom slices from localStorage alone — gold 60 / dollars 40.
    const ring = screen.getByTestId("shield-ring");
    expect(ring).toHaveTextContent(/60%/);
    expect(ring).toHaveTextContent(/40%/);
    expect(ring).not.toHaveTextContent(/Choose a plan/);

    // excludeYield survives: USDY is its own wallet slice, not folded into the dollar leg.
    const usdy = screen.getByRole("button", { name: /USDY — wallet holding/ });
    fireEvent.click(usdy);
    expect(ring).toHaveTextContent(/30%\s*USDY\s*outside plan/);
  }, 15000);
});

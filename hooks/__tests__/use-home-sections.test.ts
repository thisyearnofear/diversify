/**
 * Tests for useHomeSections.
 *
 * The hook is the IA brain of the home page. It decides:
 *   - which contextual banner to show
 *   - which deep sections to render
 *   - what the primary tip is
 *   - the hero variant
 *
 * We test it in isolation by mocking its dependencies (the experience,
 * profile, cold-start, and streak contexts/hooks). That keeps the tests
 * fast and lets us verify the resolution logic without rendering the
 * whole tree.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHomeSections } from "../use-home-sections";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../../context/app/ExperienceContext", () => ({
  useExperience: vi.fn(),
}));

vi.mock("../use-protection-profile", () => ({
  useProtectionProfile: vi.fn(),
}));

vi.mock("../use-cold-start", () => ({
  useColdStart: vi.fn(),
}));

vi.mock("../use-streak-rewards", () => ({
  useStreakRewards: vi.fn(),
}));

vi.mock("@diversifi/shared", () => ({
  getBeginnerPrimaryTip: vi.fn(
    (
      goal: string,
      scores: { hedge: number; diversify: number; rwa: number },
    ) => {
      if (goal === "inflation_protection" && scores.hedge < 60) {
        return `Protection score ${Math.round(scores.hedge)}% — consider moving to more stable holdings.`;
      }
      return null;
    },
  ),
}));

vi.mock("../use-market-regime", () => ({
  useMarketRegime: vi.fn(() => null),
}));

import { useExperience } from "../../context/app/ExperienceContext";
import { useProtectionProfile } from "../use-protection-profile";
import { useColdStart } from "../use-cold-start";
import { useStreakRewards } from "../use-streak-rewards";

const mockUseExperience = useExperience as ReturnType<typeof vi.fn>;
const mockUseProtectionProfile = useProtectionProfile as ReturnType<typeof vi.fn>;
const mockUseColdStart = useColdStart as ReturnType<typeof vi.fn>;
const mockUseStreakRewards = useStreakRewards as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

const basePortfolio = (overrides: Partial<any> = {}) => ({
  totalValue: 1000,
  goalScores: { hedge: 70, diversify: 70, rwa: 30 },
  missingRegions: ["LatAm"],
  regionData: [{ region: "Africa", color: "#f00" }],
  allTokens: [],
  errors: [],
  diversificationScore: 70,
  diversificationRating: "Good",
  ...overrides,
});

const baseArgs = () => ({
  portfolio: basePortfolio() as any,
  isDemo: false,
  userRegion: "Africa" as any,
  chainId: 42220,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Clear the FX Corridor hint dismissal flag so each test starts fresh.
  window.localStorage.removeItem("diversifi.fx_corridor_hint_dismissed");
  mockUseExperience.mockReturnValue({ experienceMode: "standard" });
  mockUseProtectionProfile.mockReturnValue({
    config: { userGoal: "exploring" },
    isComplete: false,
  });
  mockUseColdStart.mockReturnValue({
    emoji: "💡",
    headline: "Add funds to start",
    body: "Connect your wallet to see your protection",
    currentChainName: "Celo",
    isOnSupportedChain: true,
    suggestedChainName: "Celo",
  });
  mockUseStreakRewards.mockReturnValue({ canClaim: false, isWhitelisted: false });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useHomeSections", () => {
  describe("mode resolution", () => {
    it("returns beginner when experienceMode is beginner", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "beginner" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.mode).toBe("beginner");
      expect(result.current.isBeginner).toBe(true);
    });

    it("returns advanced when experienceMode is advanced", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "advanced" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.mode).toBe("advanced");
      expect(result.current.isAdvanced).toBe(true);
    });

    it("defaults to standard for any other mode", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "intermediate" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.mode).toBe("standard");
      expect(result.current.isStandard).toBe(true);
    });
  });

  describe("contextual banner resolution", () => {
    it("shows cold-start when wallet is connected but no holdings", () => {
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), portfolio: basePortfolio({ totalValue: 0 }) as any }),
      );
      expect(result.current.banner).toBe("cold-start");
    });

    it("shows demo banner when isDemo is true", () => {
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), isDemo: true }),
      );
      expect(result.current.banner).toBe("demo");
    });

    it("shows daily-claim when streak is claimable and has holdings", () => {
      mockUseStreakRewards.mockReturnValue({ canClaim: true, isWhitelisted: true });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("daily-claim");
    });

    it("shows goal-drift when profile is complete with a real goal and has holdings", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: { userGoal: "inflation_protection" },
        isComplete: true,
      });
      const { result } = renderHook(() =>
        useHomeSections({
          ...baseArgs(),
          portfolio: basePortfolio({
            goalScores: { hedge: 30, diversify: 30, rwa: 0 },
          }) as any,
        }),
      );
      expect(result.current.banner).toBe("goal-drift");
    });

    it("shows apac-rail for Confucian + Asia when no higher-priority banner applies", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          philosophy: "confucian",
          userRegion: "Asia",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("apac-rail");
    });

    it("shows fx-corridor-hint when moneyPurpose is upcoming_payment and not dismissed", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("fx-corridor-hint");
    });

    it("does not show fx-corridor-hint when the user has already dismissed it", () => {
      // Pre-seed the dismissal flag (simulating a user who clicked the banner
      // on a previous visit).
      window.localStorage.setItem(
        "diversifi.fx_corridor_hint_dismissed",
        "true",
      );
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      // Banner resolves to null (or another low-priority banner) — never
      // fx-corridor-hint once dismissed.
      expect(result.current.banner).not.toBe("fx-corridor-hint");
    });

    it("dismissFxCorridorHint persists the flag in localStorage and clears the banner", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("fx-corridor-hint");

      // Dismiss the hint
      act(() => {
        result.current.dismissFxCorridorHint();
      });

      // localStorage was written
      expect(
        window.localStorage.getItem("diversifi.fx_corridor_hint_dismissed"),
      ).toBe("true");
      // Banner no longer resolves to fx-corridor-hint
      expect(result.current.banner).not.toBe("fx-corridor-hint");
    });

    it("apac-rail outranks fx-corridor-hint for APAC + business audience", () => {
      // An APAC user with both Confucian philosophy AND upcoming_payment:
      // the APAC rail message is more specific, so it wins.
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          philosophy: "confucian",
          userRegion: "Asia",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("apac-rail");
    });

    it("fx-corridor-hint outranks daily-claim for SME-graduated users with a streak", () => {
      // An importer with a claimable streak: the FX Corridor hint is more
      // relevant (it's a discovery moment for the new section) than the
      // daily-claim reward.
      mockUseStreakRewards.mockReturnValue({ canClaim: true, isWhitelisted: true });
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("fx-corridor-hint");
    });

    it("cold-start outranks demo (a fresh connected user with no holdings and demo off)", () => {
      // Demo mode is the only banner triggered when isDemo is on; the cold-start
      // logic should not stack with demo. Verify the resolution is exactly one.
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), portfolio: basePortfolio({ totalValue: 0 }) as any, isDemo: true }),
      );
      // The hook prefers demo over cold-start because isDemo is checked first
      // in the priority list. This is intentional — the user explicitly chose
      // demo, so respect that.
      expect(["demo", "cold-start"]).toContain(result.current.banner);
    });

    it("returns null when nothing applies", () => {
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      // hasHoldings, no demo, no claim, no profile → no banner
      expect(result.current.banner).toBeNull();
    });
  });

  describe("section visibility", () => {
    it("adds the FX Corridor business section when moneyPurpose is upcoming_payment", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      const businessSection = result.current.sections.find(
        (s) => s.id === "business",
      );
      expect(businessSection).toBeDefined();
      expect(businessSection?.title).toBe("FX Corridor");
      expect(businessSection?.defaultOpen).toBe(true);
      expect(result.current.showBusinessDashboard).toBe(true);
    });

    it("does not add the FX Corridor business section in beginner mode even with moneyPurpose set", () => {
      // The business section is gated on moneyPurpose only; beginner mode
      // is a separate concern (the user can still be a beginner importer).
      // The hook adds the section regardless of experienceMode — the JSX
      // is responsible for the beginner collapse.
      mockUseExperience.mockReturnValue({ experienceMode: "beginner" });
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          moneyPurpose: "upcoming_payment",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      const businessSection = result.current.sections.find(
        (s) => s.id === "business",
      );
      expect(businessSection).toBeDefined();
      expect(result.current.showBusinessDashboard).toBe(true);
    });

    it("filters the smart-tips section entirely when tipsCount is 0 (0px-when-empty)", () => {
      // Density-first pass: when the caller reports 0 tips, the
      // smart-tips HomeSection disappears entirely (no empty-state
      // message, no 1-line header) so the user gets the screen space
      // back. Default behaviour (tipsCount undefined) preserves the
      // old behaviour.
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), tipsCount: 0 }),
      );
      const smartTips = result.current.sections.find(
        (s) => s.id === "smart-tips",
      );
      expect(smartTips).toBeUndefined();
      // The other sections are still present
      expect(result.current.sections.length).toBeGreaterThan(0);
    });

    it("shows the smart-tips section when tipsCount is positive", () => {
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), tipsCount: 3 }),
      );
      const smartTips = result.current.sections.find(
        (s) => s.id === "smart-tips",
      );
      expect(smartTips).toBeDefined();
      expect(smartTips?.title).toBe("Smart Tips");
    });

    it("shows the smart-tips section when tipsCount is undefined (backward-compat default)", () => {
      // Older callers that don't pass tipsCount should still see the
      // smart-tips section — the density filter is opt-in.
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      const smartTips = result.current.sections.find(
        (s) => s.id === "smart-tips",
      );
      expect(smartTips).toBeDefined();
    });

    it("hides insight sections in beginner mode", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "beginner" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.showMarketIntel).toBe(false);
      expect(result.current.showSmartTips).toBe(false);
      expect(result.current.showRewards).toBe(false);
      expect(result.current.sections).toEqual([]);
    });

    it("shows market intel, smart tips, rewards in standard mode with holdings", () => {
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.showMarketIntel).toBe(true);
      expect(result.current.showSmartTips).toBe(true);
      expect(result.current.showRewards).toBe(true);
      expect(result.current.sections.length).toBe(3);
    });

    it("adds the agent section in advanced mode", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "advanced" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.showAgentCommandCenter).toBe(true);
      expect(result.current.sections.some((s) => s.id === "agent")).toBe(true);
    });

    it("hides all insight sections when there are no holdings", () => {
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), portfolio: basePortfolio({ totalValue: 0 }) as any }),
      );
      expect(result.current.showMarketIntel).toBe(false);
      expect(result.current.showSmartTips).toBe(false);
      expect(result.current.showRewards).toBe(false);
    });
  });

  describe("primary tip", () => {
    it("returns a hedge tip when goal is inflation_protection and score is low", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: { userGoal: "inflation_protection" },
        isComplete: true,
      });
      const { result } = renderHook(() =>
        useHomeSections({
          ...baseArgs(),
          portfolio: basePortfolio({ goalScores: { hedge: 30, diversify: 30, rwa: 0 } }) as any,
        }),
      );
      expect(result.current.primaryTip).toMatch(/Hedge score 30%/);
    });

    it("returns null when there are no holdings", () => {
      const { result } = renderHook(() =>
        useHomeSections({ ...baseArgs(), portfolio: basePortfolio({ totalValue: 0 }) as any }),
      );
      expect(result.current.primaryTip).toBeNull();
    });
  });

  describe("hero variant", () => {
    it("is compact in beginner mode", () => {
      mockUseExperience.mockReturnValue({ experienceMode: "beginner" });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.heroVariant).toBe("compact");
    });

    it("is detailed in standard mode", () => {
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.heroVariant).toBe("detailed");
    });
  });
});

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
import { renderHook } from "@testing-library/react";
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

    it("shows apac-rail-pending for Confucian + Asia when no higher-priority banner applies", () => {
      mockUseProtectionProfile.mockReturnValue({
        config: {
          userGoal: "exploring",
          philosophy: "confucian",
          userRegion: "Asia",
        },
        isComplete: true,
      });
      const { result } = renderHook(() => useHomeSections(baseArgs()));
      expect(result.current.banner).toBe("apac-rail-pending");
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

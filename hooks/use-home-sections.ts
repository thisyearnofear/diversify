/**
 * useHomeSections — Centralizes the "what should the home page look like" decision
 * for the Overview tab.
 *
 * Before this hook, `ConnectedOverview.tsx` had `isBeginner`/`isAdvanced` guards
 * scattered through ~660 lines of JSX. That made it hard to reason about what
 * the user would see in each mode, and impossible to test the IA in isolation.
 *
 * The hook returns a single `HomeSections` object that describes:
 *   - which contextual banner (if any) is currently the most important one
 *   - which deep sections to show, in what order, and which is default-open
 *   - the hero variant (compact vs. detailed)
 *   - the level of insight depth (minimal / standard / full)
 *
 * `ConnectedOverview` consumes this and renders the right UI for each descriptor.
 * Adding a new mode (e.g. "sharia-compliant") or a new section is a one-line change.
 */

import { useMemo } from "react";
import type { Region } from "./use-user-region";
import type { MultichainPortfolio } from "./use-multichain-balances";
import type { TabId } from "@/constants/tabs";
import { useExperience } from "../context/app/ExperienceContext";
import { useProtectionProfile } from "./use-protection-profile";
import { useColdStart } from "./use-cold-start";
import { useStreakRewards } from "./use-streak-rewards";
import { getBeginnerPrimaryTip, type ProtectionUserGoal } from "@diversifi/shared";
import { needsApacRailMessaging } from "@/constants/apac-rail";

export type HomeMode = "beginner" | "standard" | "advanced";

export type ContextualBannerKind =
  | "cold-start"      // Connected, no holdings → fund or learn
  | "demo"            // Demo mode is on
  | "goal-drift"      // Profile complete but goal is misaligned
  | "apac-rail-pending" // APAC philosophy + Asia region; rail not shipped
  | "daily-claim"     // GoodDollar reward ready
  | null;             // No banner — let the hero speak

export interface HomeSectionDescriptor {
  /** Stable id used for in-page navigation and tests */
  id: string;
  /** Section title shown on the collapsible header */
  title: string;
  /** Optional icon (emoji) */
  icon?: string;
  /** Optional short teaser — when collapsed, this is all the user sees */
  teaser?: string;
  /** Whether the section is expanded by default. Only one section should be
   *  default-open in beginner mode to keep the page scannable. */
  defaultOpen: boolean;
  /** Section is hidden in this mode */
  hiddenIn?: HomeMode[];
}

export interface ContextualBannerDescriptor {
  kind: ContextualBannerKind;
  /** Priority score (higher wins). Used for unit-testing the resolution. */
  priority: number;
}

export interface UseHomeSectionsInput {
  portfolio: MultichainPortfolio | null;
  isDemo: boolean;
  userRegion: Region;
  chainId: number | null;
}

export interface HomeSections {
  mode: HomeMode;
  isBeginner: boolean;
  isStandard: boolean;
  isAdvanced: boolean;

  /** The single contextual banner to render, if any. */
  banner: ContextualBannerKind;

  /** Hero card variant. */
  heroVariant: "compact" | "detailed";

  /** Ordered list of deep sections to render after the hero. */
  sections: HomeSectionDescriptor[];

  /** Convenience booleans for the JSX. */
  showProtectionMix: boolean;
  showRegionSelector: boolean;
  showTwoChainsBanner: boolean;
  showAgentCommandCenter: boolean;
  showRewards: boolean;
  showMarketIntel: boolean;
  showSmartTips: boolean;
  showInsightAccordion: boolean;
  showProtectionScorecard: boolean;
  showGuardianChip: boolean;

  /** The "next best move" tip for the hero. */
  primaryTip: string | null;

  /** Default open section id, used by the in-page nav highlight. */
  primarySectionId: string;
}

const COLD_START_PRIORITY = 100;
const DEMO_PRIORITY = 80;
const GOAL_DRIFT_PRIORITY = 60;
const APAC_RAIL_PRIORITY = 55;
const DAILY_CLAIM_PRIORITY = 40;

export function useHomeSections({
  portfolio,
  isDemo,
  userRegion,
  chainId,
}: UseHomeSectionsInput): HomeSections {
  const { experienceMode } = useExperience();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
  const { canClaim } = useStreakRewards();
  const coldStart = useColdStart(chainId);

  const hasHoldings = (portfolio?.totalValue ?? 0) > 0;

  return useMemo<HomeSections>(() => {
    const mode: HomeMode =
      experienceMode === "beginner"
        ? "beginner"
        : experienceMode === "advanced"
          ? "advanced"
          : "standard";

    const isBeginner = mode === "beginner";
    const isAdvanced = mode === "advanced";
    const isStandard = mode === "standard";

    // ── 1. Resolve the single contextual banner by priority ──────────────
    // Higher priority wins. Multiple banners used to stack and compete for
    // attention; now exactly one renders (or none).
    let banner: ContextualBannerKind = null;
    let bannerPriority = 0;

    if (isDemo) {
      banner = "demo";
      bannerPriority = Math.max(bannerPriority, DEMO_PRIORITY);
    }
    if (!hasHoldings && !isDemo) {
      // Cold-start only applies when the user has no holdings to show.
      // Demo mode is its own banner above, so we skip cold-start in demo.
      banner = "cold-start";
      bannerPriority = Math.max(bannerPriority, COLD_START_PRIORITY);
    } else if (canClaim && hasHoldings) {
      // Daily claim is shown alongside holdings.
      banner = "daily-claim";
      bannerPriority = Math.max(bannerPriority, DAILY_CLAIM_PRIORITY);
    }
    if (
      profileComplete &&
      profileConfig.userGoal &&
      profileConfig.userGoal !== "exploring" &&
      hasHoldings
    ) {
      // Goal drift overrides daily-claim but is overridden by cold-start.
      if (bannerPriority < GOAL_DRIFT_PRIORITY) {
        banner = "goal-drift";
        bannerPriority = GOAL_DRIFT_PRIORITY;
      }
    }
    const effectiveRegion = profileConfig.userRegion ?? userRegion;
    if (
      needsApacRailMessaging(profileConfig.philosophy, effectiveRegion) &&
      bannerPriority < APAC_RAIL_PRIORITY
    ) {
      banner = "apac-rail-pending";
      bannerPriority = APAC_RAIL_PRIORITY;
    }

    // ── 2. Determine which deep sections to show ─────────────────────────
    // Default-open is intentionally restricted: in beginner mode only the
    // Protection Mix is open by default. Power users get two open sections.
    const sections: HomeSectionDescriptor[] = [];

    if (hasHoldings && !isBeginner) {
      sections.push({
        id: "market-intel",
        title: "Guardian Pulse",
        icon: "🌍",
        teaser: "Live macro signals, regional risk, and verifiable audit trail.",
        defaultOpen: isAdvanced,
      });
    }

    if (hasHoldings && !isBeginner) {
      sections.push({
        id: "smart-tips",
        title: "Smart Tips",
        icon: "💡",
        teaser: "Personalised actions from your goal and the current market regime.",
        defaultOpen: false,
      });
    }

    if (hasHoldings && !isBeginner) {
      sections.push({
        id: "rewards",
        title: "Celo Welcome Bonus",
        icon: "💚",
        teaser: "Claim free G$ daily on Celo — a bonus for active savers.",
        defaultOpen: false,
      });
    }

    if (isAdvanced) {
      sections.push({
        id: "agent",
        title: "Agent Command Center",
        icon: "🤖",
        teaser: "Proactive Guardian status, latest activity, and automation controls.",
        defaultOpen: isAdvanced,
      });
    }

    // ── 3. Hero variant ───────────────────────────────────────────────────
    // Beginner → compact (one number, one sentence, one CTA).
    // Standard / Advanced → detailed (score + breakdown in same card).
    const heroVariant: "compact" | "detailed" = isBeginner
      ? "compact"
      : "detailed";

    // ── 4. Determine which supporting bits the JSX needs ────────────────
    const showProtectionMix = hasHoldings;
    const showRegionSelector = !isBeginner;
    const showTwoChainsBanner = !isBeginner && !isDemo; // skip in demo
    const showAgentCommandCenter = isAdvanced;
    const showRewards = hasHoldings && !isBeginner;
    const showMarketIntel = hasHoldings && !isBeginner;
    const showSmartTips = hasHoldings && !isBeginner;
    // Insights accordion is just the deep sections wrapped together.
    const showInsightAccordion = sections.length > 0;
    // Protection Scorecard: show when the user has holdings (needs portfolio data
    // to be meaningful). Renders the philosophy-aware protection summary.
    const showProtectionScorecard = hasHoldings;
    const showGuardianChip = hasHoldings && isBeginner;

    // ── 5. Primary tip (next best move) ──────────────────────────────────
    // Mirrors the legacy buildTips() but is just a single line for the hero.
    // The full tip list still lives in `buildTips` and is shown inside the
    // Smart Tips section.
    let primaryTip: string | null = null;
    if (hasHoldings && portfolio) {
      const gs = portfolio.goalScores;

      if (isBeginner && profileComplete && profileConfig.userGoal) {
        primaryTip = getBeginnerPrimaryTip(
          profileConfig.userGoal as ProtectionUserGoal,
          gs,
          portfolio.missingRegions ?? [],
        );
      } else if (profileComplete && profileConfig.userGoal === "inflation_protection") {
        if (gs.hedge < 60) {
          primaryTip = `Hedge score ${Math.round(gs.hedge)}% — swap high-inflation tokens to USDm or EURm.`;
        } else if (gs.hedge >= 80) {
          primaryTip = `Strong inflation protection (${Math.round(gs.hedge)}%). Consider PAXG on Arbitrum for long-term coverage.`;
        }
      } else if (profileConfig.userGoal === "geographic_diversification") {
        if (gs.diversify < 60) {
          const missing = portfolio.missingRegions?.slice(0, 2).join(" and ");
          primaryTip = missing
            ? `Diversification ${Math.round(gs.diversify)}% — add ${missing} exposure.`
            : `Diversification ${Math.round(gs.diversify)}% — rebalance across regions.`;
        }
      } else if (profileConfig.userGoal === "rwa_access") {
        if (gs.rwa === 0) {
          primaryTip = "No real-world assets yet — use Arbitrum for tokenised gold, Treasuries, or yield.";
        } else if (gs.rwa < 80) {
          primaryTip = `RWA score ${Math.round(gs.rwa)}% — add PAXG, USDY, or SYRUPUSDC on Arbitrum.`;
        }
      }
      // Cold-start: tip a one-liner the user can act on
      if (!primaryTip && coldStart?.headline) {
        primaryTip = coldStart.headline;
      }
    }

    return {
      mode,
      isBeginner,
      isStandard,
      isAdvanced,

      banner,
      heroVariant,
      sections,

      showProtectionMix,
      showRegionSelector,
      showTwoChainsBanner,
      showAgentCommandCenter,
      showRewards,
      showMarketIntel,
      showSmartTips,
      showInsightAccordion,
      showProtectionScorecard,
      showGuardianChip,

      primaryTip,
      primarySectionId: "protection-mix",
    };
  }, [
    experienceMode,
    profileConfig.userGoal,
    profileConfig.philosophy,
    profileConfig.userRegion,
    profileComplete,
    canClaim,
    hasHoldings,
    isDemo,
    portfolio,
    coldStart?.headline,
    userRegion,
  ]);
}

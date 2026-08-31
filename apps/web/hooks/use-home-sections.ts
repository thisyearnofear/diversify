/**
 * useHomeSections — Centralizes the "what should the home page look like" decision
 * for the Overview tab.
 *
 * Before this hook, `ConnectedOverview.tsx` had `isBeginner`/`isAdvanced` guards
 * scattered through ~660 lines of JSX. That made it hard to reason about what
 * the user would see in each mode, and impossible to test the IA in isolation.
 *
 * The hook returns a single object that describes:
 *   - which contextual banner (if any) is currently the most important one
 *   - whether the holdings dial / zakat inspector / payment-cycle morph apply
 *   - the hero variant (compact vs. detailed)
 *   - the primary tip (one line)
 *
 * `ConnectedOverview` consumes this. Adding a new card section is out of
 * contract — persona morphs the object or the inspector instead.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Region } from "./use-user-region";
import type { MultichainPortfolio } from "./use-multichain-balances";
import type { TabId } from "@/constants/tabs";
import { useExperience } from "../context/app/ExperienceContext";
import { useProtectionProfile } from "./use-protection-profile";
import { useColdStart } from "./use-cold-start";
import { useStreakRewards } from "./use-streak-rewards";
// Deep leaf import — NOT the barrel — keeps the agent-tier stack out of first-load.
import { getBeginnerPrimaryTip, type ProtectionUserGoal } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import { needsApacRailMessaging } from "@/constants/apac-rail";
import { needsCaribbeanRailMessaging } from "@/constants/caribbean-rail";
import { useAdaptiveContext } from "../context/app/AdaptiveContext";

export type HomeMode = "beginner" | "standard" | "advanced";

export type ContextualBannerKind =
  | "cold-start"      // Connected, no holdings → fund or learn
  | "demo"            // Demo mode is on
  | "goal-drift"      // Profile complete but goal is misaligned
  | "apac-rail" // APAC philosophy + Asia region — live or coming-soon copy
  | "caribbean-rail" // Pan-Caribbean philosophy + Caribbean region — lives on Celo
  | "fx-corridor-hint" // SME-graduated user → discover the FX Corridor section
  | "daily-claim"     // GoodDollar reward ready
  | "fx-drag-warning" // Importer: FX drag is eating margins
  | "family-savings"  // Diaspora: family savings context
  | "currency-risk"   // US/EU: currency risk awareness
  | "cycle-alert"     // Importer: payment approaching
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
  /**
   * Number of Smart Tips available. When 0, the entire `smart-tips`
   * section is filtered out of `sections` (0px-when-empty per the
   * density-first pass). When undefined, the section is shown (default
   * behaviour — the caller is opting out of the density check).
   *
   * Tips are computed in `ConnectedOverview` (not in this hook) because
   * they depend on the buildTips() pure function which takes the full
   * portfolio + profile + marketRegime context. We accept the count
   * here so the IA decision stays centralised.
   */
  tipsCount?: number;
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

  /** Holdings dial is the object for non-beginners with funds. */
  showDial: boolean;
  /** Zakat line belongs in the region inspector for Islamic philosophy. */
  showZakat: boolean;
  /** Upcoming payment morphs Home toward Exchange, not a corridor accordion. */
  isPaymentCycle: boolean;

  /** The "next best move" tip for the hero. */
  primaryTip: string | null;

  /**
   * Dismiss the FX Corridor hint banner + persist the dismissal in
   * localStorage. The hint then never reappears on this device.
   * Idempotent: calling it after the hint is already dismissed is a no-op.
   */
  dismissFxCorridorHint: () => void;
}

/** localStorage key for the FX Corridor hint dismissal flag. Stable across
 *  versions so the hint doesn't reappear after a deploy. */
const FX_CORRIDOR_HINT_DISMISSED_KEY = "diversifi.fx_corridor_hint_dismissed";

const COLD_START_PRIORITY = 100;
const DEMO_PRIORITY = 80;
const GOAL_DRIFT_PRIORITY = 60;
const APAC_RAIL_PRIORITY = 55;
const CARIBBEAN_RAIL_PRIORITY = 54; // sibling of apac-rail — only one applies per profile
const FX_CORRIDOR_HINT_PRIORITY = 50; // below apac-rail, above daily-claim
const DAILY_CLAIM_PRIORITY = 40;

export function useHomeSections({
  portfolio,
  isDemo,
  userRegion,
  chainId,
  tipsCount: _tipsCount,
}: UseHomeSectionsInput): HomeSections {
  const { experienceMode } = useExperience();
  const { config: profileConfig, isComplete: profileComplete } = useProtectionProfile();
  const { canClaim } = useStreakRewards();
  const coldStart = useColdStart(chainId);
  const { config: adaptiveConfig } = useAdaptiveContext();

  const hasHoldings = (portfolio?.totalValue ?? 0) > 0;

  // ── FX Corridor hint dismissal (localStorage-backed) ─────────────────
  // Read once on mount; writes are idempotent. The state is local to this
  // hook so the resolution sees the most up-to-date value after the user
  // clicks the banner. The flag persists across reloads so the hint never
  // reappears after dismissal.
  const [fxHintDismissed, setFxHintDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(FX_CORRIDOR_HINT_DISMISSED_KEY) === "true") {
      setFxHintDismissed(true);
    }
  }, []);
  const dismissFxCorridorHint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FX_CORRIDOR_HINT_DISMISSED_KEY, "true");
    }
    setFxHintDismissed(true);
  }, []);

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
    // First-visit SME-graduated users (`moneyPurpose === 'upcoming_payment'`
    // who haven't yet dismissed the FX Corridor hint) get the discovery
    // hint first instead of goal-drift. The hint is a one-time nudge;
    // goal-drift can take over once the hint is dismissed. Without this
    // gate, a persistent goal-drift state would perpetually outrank the
    // 50-priority fx-corridor-hint and the user would never discover the
    // FX Corridor section.
    const isFirstVisitSme =
      profileConfig.moneyPurpose === "upcoming_payment" && !fxHintDismissed;
    if (
      profileComplete &&
      profileConfig.userGoal &&
      profileConfig.userGoal !== "exploring" &&
      hasHoldings &&
      !isFirstVisitSme
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
      banner = "apac-rail";
      bannerPriority = APAC_RAIL_PRIORITY;
    }
    // Caribbean rail: Pan-Caribbean philosophy + Caribbean region settle on the
    // always-on Celo home rail. Exclusive with APAC (a user is one philosophy),
    // so this sits at the same precedence with its own priority value.
    if (
      needsCaribbeanRailMessaging(profileConfig.philosophy, effectiveRegion) &&
      bannerPriority < CARIBBEAN_RAIL_PRIORITY
    ) {
      banner = "caribbean-rail";
      bannerPriority = CARIBBEAN_RAIL_PRIORITY;
    }
    // FX Corridor hint: SME-graduated users (`moneyPurpose ===
    // 'upcoming_payment'`) who haven't yet dismissed the hint get a
    // one-time discovery banner. Below apac-rail so the APAC audience
    // gets the more specific regional rail message first.
    if (
      profileConfig.moneyPurpose === "upcoming_payment" &&
      !fxHintDismissed &&
      bannerPriority < FX_CORRIDOR_HINT_PRIORITY
    ) {
      banner = "fx-corridor-hint";
      bannerPriority = FX_CORRIDOR_HINT_PRIORITY;
    }
    // Persona-driven contextual banners from content routing. These sit
    // below the priority wall (cold-start, demo, goal-drift) so they only
    // render when no higher-priority banner wins — they're ambient
    // persona-aware copy, not interruptive.
    const ADAPTIVE_BANNER_PRIORITY = 20;
    const personaBanner = adaptiveConfig.content.contextualBanner;
    if (
      personaBanner &&
      bannerPriority < ADAPTIVE_BANNER_PRIORITY &&
      !isDemo
    ) {
      banner = personaBanner;
      bannerPriority = ADAPTIVE_BANNER_PRIORITY;
    }

    // Instrument layout: no section catalog. Persona morphs the object
    // (payment cycle → Exchange) or the inspector (zakat). Tips are one line.
    const heroVariant: "compact" | "detailed" = isBeginner
      ? "compact"
      : "detailed";

    const showDial = hasHoldings && !isBeginner;
    const showZakat = hasHoldings && profileConfig.philosophy === "islamic";
    const isPaymentCycle = profileConfig.moneyPurpose === "upcoming_payment";

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
      showDial,
      showZakat,
      isPaymentCycle,
      primaryTip,
      dismissFxCorridorHint,
    };
  }, [
    experienceMode,
    profileConfig.userGoal,
    profileConfig.philosophy,
    profileConfig.userRegion,
    profileConfig.moneyPurpose,
    profileComplete,
    canClaim,
    hasHoldings,
    isDemo,
    portfolio,
    coldStart?.headline,
    userRegion,
    fxHintDismissed,
    adaptiveConfig.content.contextualBanner,
    dismissFxCorridorHint,
  ]);
}

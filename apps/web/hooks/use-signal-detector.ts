/**
 * useSignalDetector — Collects all per-session signals and resolves an
 * AdaptiveSurfaceConfig that determines which experience to surface.
 *
 * This is the single source of truth for "who is visiting right now."
 * All adaptive surfaces read from this hook (via AdaptiveContext).
 *
 * Signals collected:
 * - Geo: country code, region, currency
 * - Wallet: connected? chains? balances?
 * - History: has cycles? previous visits? behavior patterns?
 * - Device: mobile? browser? referrer?
 * - Onboarding: philosophy, user goal, money purpose, risk tolerance
 *
 * The config is returned as a stable reference (useMemo) so consumers
 * don't trigger unnecessary re-renders when signals are unchanged.
 *
 * Phase 1 (shipped): geo + wallet-based personas with content routing
 * Phase 2 (shipped): onboarding persona detection from profile choices
 */

import { useMemo, useState, useEffect } from "react";
import { useAppShellContext } from "../context/app/AppShellContext";
import { useUserRegion } from "./use-user-region";
import { useCurrencyRisk } from "./use-currency-risk";
import { useProtectionProfile } from "./use-protection-profile";

// ─── Types ─────────────────────────────────────────────────────

export type CurrencyCode =
  | "GHS" | "KES" | "NGN" | "PHP" | "INR" | "BRL" | "ZAR"
  | "USD" | "EUR" | "GBP" | "ARS" | "TRY" | "EGP" | "PKR"
  | "LKR" | "VND" | "IDR" | "THB" | "RUB" | "MXN" | "COP"
  | string; // broadened for new corridors

export type DeviceType = "mobile" | "desktop" | "unknown";
export type DetectionMethod = "default" | "locale" | "ip" | "manual" | "none";

/**
 * Raw signals collected from the session.
 */
export interface DetectedSignals {
  geo: {
    countryCode: string | null;
    countryName: string | null;
    region: string | null;
    currency: CurrencyCode;
    flag: string;
  };
  wallet: {
    connected: boolean;
    address: string | null;
    chainId: number | null;
    hasHoldings: boolean;
    totalValueUsd: number;
  };
  history: {
    hasCycles: boolean;
    cycleCount: number;
    hasGuardianAuth: boolean;
    guardianTier: string | null;
    protectionScore: number | null;
  };
  device: {
    isMobile: boolean;
    method: DetectionMethod;
  };
  onboarding: {
    philosophy: string | null;
    userGoal: string | null;
    moneyPurpose: string | null;
    riskTolerance: string | null;
  };
}

// ─── Persona types ─────────────────────────────────────────────

/**
 * Which persona the signals map to. This drives adaptive routing.
 */
export type AdaptivePersona =
  | "ghanaian_importer"     // GH, has cycles, working capital pattern
  | "ghanaian_saver"        // GH, connected wallet, savings pattern
  | "diaspora"              // US/EU, has high-inflation currency exposure
  | "us_saver"              // US, generic retail saver
  | "philippine_bpo"        // PH, has cycles, BPO/trader pattern
  | "apac_user"             // Asia, any persona
  | "latam_user"            // LatAm, any persona
  | "european_user"         // Europe, any persona
  | "generic_user"          // No pattern matched — default retail

// ─── Content routing types ─────────────────────────────────────

/** What the home tab hero looks like for this persona. */
export type HeroType = "cycle" | "protection" | "risk-moment" | "family" | "generic";

/** Home tab hero content — persona-aware headline and subtitle. */
export interface HeroContent {
  type: HeroType;
  /** Main headline shown in the home hero banner */
  headline: string;
  /** Subtitle with supporting context */
  subtitle: string;
  /** Emoji icon for the hero */
  icon: string;
  /** Primary CTA text — null means no action */
  ctaLabel: string | null;
  /** Where the CTA navigates (tab id) */
  ctaTab: string | null;
}

/**
 * What the shield tab focuses on for this persona.
 * Shield sections render in order; persona determines priority.
 */
export type ShieldSection =
  | "cycle-protection"  // Active cycle dashboard, payment countdown
  | "fx-drag"           // FX drag decomposition card
  | "scorecard"         // Protection scorecard (philosophy-aware)
  | "yield"             // Yield vault recommendations
  | "strategy"          // Strategy alignment bar
  | "family";           // Family savings context (diaspora)

/** Contextual banner shown at the top of the home tab. */
export type ContextualBannerKind =
  | "fx-drag-warning"     // Importer: FX drag is eating margins
  | "family-savings"      // Diaspora: family savings context
  | "currency-risk"       // US/EU: currency risk awareness
  | "cycle-alert"         // Importer: payment approaching
  | null;

/**
 * Content routing configuration per persona.
 * This is what makes surfaces adaptive — different personas see
 * different content, layouts, and priorities in the same shell.
 */
export interface ContentRouting {
  /** Hero content for the home tab */
  hero: HeroContent;
  /** Tab display order — first tab is the primary surface */
  tabOrder: string[];
  /** Shield tab focus areas — which sections render first, in priority order */
  shieldSections: ShieldSection[];
  /** Contextual banner for the home tab */
  contextualBanner: ContextualBannerKind;
  /** Whether to show business FX surfaces (FX netting, corridors) */
  showBusiness: boolean;
  /** Whether yield engine is prominent for this persona */
  showYield: boolean;
}

/**
 * Full adaptive config. Replaces the old flat showBusiness/showYield fields
 * with structured content routing.
 */
export interface AdaptiveConfig {
  /** Which persona the system has detected */
  persona: AdaptivePersona;
  /** Guardian mode: savings vs cycle-aware */
  guardianMode: "savings" | "cycle" | "disabled";
  /** Tab label overrides by persona */
  tabLabels: Record<string, string>;
  /** Primary CTA for the current session */
  primaryCTA: "calculate-drag" | "save-cycle" | "enable-guardian" | "connect-wallet" | null;
  /** Currency code used for display formatting */
  displayCurrency: string;
  /** Currency flag emoji */
  currencyFlag: string;
  /** Content routing — the adaptive part that makes surfaces different */
  content: ContentRouting;
}

// ─── Persona resolution rules ──────────────────────────────────

function detectDevice(): { isMobile: boolean; method: DetectionMethod } {
  if (typeof window === "undefined") return { isMobile: false, method: "default" };
  return {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ),
    method: "default",
  };
}

/**
 * Resolve persona from signals.
 *
 * Phase 2 (onboarding): refines geo-based persona with onboarding choices.
 * If the user has completed onboarding, their philosophy + goal + money
 * purpose can override or refine the geo-derived persona.
 *
 * Resolution order:
 *  1. Geo + wallet + history (Phase 1 rules)
 *  2. Onboarding signals refine (Phase 2)
 *  3. Fallback to geo-based default
 */
function resolvePersona(
  signals: DetectedSignals,
): AdaptivePersona {
  const { geo, wallet, history, onboarding } = signals;
  const country = geo.countryCode;
  const currency = geo.currency;

  // ── Phase 1: geo + wallet + history ──────────────────────────
  let persona: AdaptivePersona;

  // GH visitors
  if (country === "GH") {
    if (history.hasCycles) persona = "ghanaian_importer";
    else if (wallet.connected) persona = "ghanaian_saver";
    else persona = "ghanaian_importer";
  }
  // Diaspora: high-inflation currency exposure regardless of current geo
  else if (
    ["GHS", "KES", "NGN", "PHP", "INR", "BRL", "ZAR", "EGP", "TRY"].includes(currency) &&
    (country === "US" || country === "GB" || country === "DE" || country === "FR")
  ) {
    persona = "diaspora";
  }
  else if (country === "US") {
    persona = "us_saver";
  }
  else if (country === "PH") {
    persona = history.hasCycles ? "philippine_bpo" : "apac_user";
  }
  else if (["KE", "NG", "TZ", "UG", "ET"].includes(country ?? "")) {
    persona = "generic_user";
  }
  else if (["AR", "BR", "CO", "CL", "PE"].includes(country ?? "")) {
    persona = "latam_user";
  }
  else if (["GB", "DE", "FR", "IT", "ES", "NL", "SE"].includes(country ?? "")) {
    persona = "european_user";
  }
  else if (["IN", "ID", "TH", "VN", "MY", "SG"].includes(country ?? "")) {
    persona = "apac_user";
  }
  else {
    persona = "generic_user";
  }

  // ── Phase 2: onboarding refinement ───────────────────────────
  // If the user has completed onboarding, their choices can promote
  // a more specific persona (e.g. a US user who picks upcoming_payment
  // money purpose is likely an importer/diaspora).
  if (onboarding.moneyPurpose === "upcoming_payment") {
    // Importer pattern: money purpose = upcoming payment
    if (
      ["GHS", "NGN", "KES", "PHP", "INR", "ZAR", "BRL", "EGP", "TRY", "ARS", "PKR", "LKR", "VND", "IDR", "THB", "MXN", "COP", "TZS", "UGX", "HTG", "JMD", "TTD", "BBD", "XCD"].includes(currency)
    ) {
      // High-inflation currency + payment purpose = importer
      persona = country === "GH" ? "ghanaian_importer"
        : country === "PH" ? "philippine_bpo"
        : "generic_user"; // keep geo-based but show business surfaces
    }
  }
  else if (onboarding.philosophy === "islamic" && onboarding.userGoal === "inflation_protection") {
    // Islamic Finance + inflation protection = conservative saver
    // Can refine us_saver/european_user into a more specific persona
    if (persona === "us_saver" || persona === "european_user") {
      persona = persona; // keep geo, but content routing below will adjust
    }
  }
  else if (onboarding.userGoal === "geographic_diversification" && persona === "generic_user") {
    // Someone who didn't match a geo pattern but chose diversification
    // → treat them as the geo-based generic_user but with active intent
    persona = persona; // no change, but content routing will use the goal
  }

  return persona;
}

/**
 * Determine content routing overrides based on onboarding signals.
 * Returns a partial ContentRouting — only the fields that should be
 * overridden based on profile choices (not geo/wallet).
 *
 * Onboarding signals refine, never replace, geo-based defaults.
 */
function buildOnboardingOverrides(
  onboarding: DetectedSignals["onboarding"],
): Partial<ContentRouting> | null {
  if (!onboarding.moneyPurpose && !onboarding.userGoal && !onboarding.philosophy) {
    return null; // no onboarding data — rely on geo defaults
  }

  const overrides: Partial<ContentRouting> = {};

  // Money purpose drives business surfaces and guardian mode
  if (onboarding.moneyPurpose === "upcoming_payment") {
    overrides.showBusiness = true;
    overrides.contextualBanner = "fx-drag-warning" as ContextualBannerKind;
  }

  // Philosophy-driven overrides
  if (onboarding.philosophy === "islamic") {
    // Islamic Finance — emphasize Sharia-compliant yield options
    // (handled downstream in individual components)
  }

  // User goal drives tab order and hero
  if (onboarding.userGoal === "inflation_protection") {
    // Protection-first ordering
    if (!overrides.shieldSections) {
      overrides.shieldSections = ["scorecard", "yield", "strategy"];
    }
  }
  else if (onboarding.userGoal === "geographic_diversification") {
    // Diversification-first
    if (!overrides.shieldSections) {
      overrides.shieldSections = ["scorecard", "strategy", "yield"];
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : null;
}

// ─── Content routing builders ──────────────────────────────────

function buildHeroContent(persona: AdaptivePersona, walletConnected: boolean): HeroContent {
  switch (persona) {
    case "ghanaian_importer":
      return {
        type: "cycle",
        headline: "Your next cycle",
        subtitle: walletConnected
          ? "FX drag is eating your margins — here's what this cycle costs"
          : "See what your cedi is costing you in FX drag",
        icon: "🔄",
        ctaLabel: walletConnected ? "View cycle" : "Connect wallet",
        ctaTab: walletConnected ? "protect" : null,
      };

    case "ghanaian_saver":
      return {
        type: "protection",
        headline: "Protect your cedi savings",
        subtitle: walletConnected
          ? "Your GHS is losing ~20% annually to inflation"
          : "See how your savings are depreciating against USD, EUR, and gold",
        icon: "🛡️",
        ctaLabel: "Protect savings",
        ctaTab: "protect",
      };

    case "diaspora":
      return {
        type: "family",
        headline: "Protect your family's savings",
        subtitle: walletConnected
          ? "Your home currency is depreciating — here's how to protect what matters"
          : "Your family's savings in the home country are at risk — see the data",
        icon: "🏠",
        ctaLabel: walletConnected ? "View protection" : "Connect wallet",
        ctaTab: walletConnected ? "protect" : null,
      };

    case "us_saver":
      return {
        type: "risk-moment",
        headline: "Currency risk is universal",
        subtitle: walletConnected
          ? "Even strong currencies lose to inflation and concentration risk"
          : "The USD, EUR, and GBP have all lost purchasing power to inflation over the last 5 years",
        icon: "💱",
        ctaLabel: walletConnected ? "View risk" : "Learn more",
        ctaTab: walletConnected ? "protect" : null,
      };

    case "philippine_bpo":
      return {
        type: "cycle",
        headline: "Your next payment",
        subtitle: walletConnected
          ? "PHP exposure is active — monitor FX drag this cycle"
          : "See what the peso is costing you in FX drag",
        icon: "🔄",
        ctaLabel: walletConnected ? "View cycle" : "Connect wallet",
        ctaTab: walletConnected ? "protect" : null,
      };

    default:
      return {
        type: "generic",
        headline: "Your treasury",
        subtitle: walletConnected
          ? "Portfolio overview and protection status"
          : "Understand your currency risk across 200+ currencies",
        icon: "💰",
        ctaLabel: walletConnected ? "Dashboard" : "Get started",
        ctaTab: walletConnected ? "protect" : null,
      };
  }
}

function buildContentRouting(
  persona: AdaptivePersona,
  walletConnected: boolean,
): ContentRouting {
  const hero = buildHeroContent(persona, walletConnected);

  switch (persona) {
    case "ghanaian_importer":
      return {
        hero,
        // Shield first for importers — cycle protection is the primary surface
        tabOrder: ["protect", "overview", "exchange", "agent", "info"],
        shieldSections: ["cycle-protection", "fx-drag", "yield", "strategy"],
        contextualBanner: "fx-drag-warning",
        showBusiness: true,
        showYield: true,
      };

    case "ghanaian_saver":
      return {
        hero,
        tabOrder: ["protect", "overview", "exchange", "agent", "info"],
        shieldSections: ["scorecard", "yield", "strategy"],
        contextualBanner: null,
        showBusiness: false,
        showYield: true,
      };

    case "diaspora":
      return {
        hero,
        // Home first for diaspora — risk moment then protection
        tabOrder: ["overview", "protect", "exchange", "agent", "info"],
        shieldSections: ["scorecard", "family", "strategy"],
        contextualBanner: "family-savings",
        showBusiness: false,
        showYield: true,
      };

    case "us_saver":
      return {
        hero,
        tabOrder: ["overview", "protect", "exchange", "agent", "info"],
        shieldSections: ["scorecard", "yield", "strategy"],
        contextualBanner: "currency-risk",
        showBusiness: false,
        showYield: true,
      };

    case "philippine_bpo":
      return {
        hero,
        tabOrder: ["protect", "overview", "exchange", "agent", "info"],
        shieldSections: ["cycle-protection", "fx-drag", "yield", "strategy"],
        contextualBanner: "fx-drag-warning",
        showBusiness: true,
        showYield: true,
      };

    default:
      return {
        hero,
        tabOrder: ["overview", "protect", "exchange", "agent", "info"],
        shieldSections: ["scorecard", "yield", "strategy"],
        contextualBanner: null,
        showBusiness: false,
        showYield: true,
      };
  }
}

// ─── Config builder ────────────────────────────────────────────

function buildConfig(
  signals: DetectedSignals,
  persona: AdaptivePersona,
): AdaptiveConfig {
  const { currency, flag } = signals.geo;
  const walletConnected = signals.wallet.connected;

  // Default tab labels
  const defaultLabels: Record<string, string> = {
    overview: "Home",
    protect: "Shield",
    exchange: "Exchange",
    agent: "Guardian",
    info: "Learn",
  };

  // Build persona-aware content routing
  const content = buildContentRouting(persona, walletConnected);

  // Merge onboarding overrides into content routing
  const onboardingOverrides = buildOnboardingOverrides(signals.onboarding);
  if (onboardingOverrides) {
    // Onboarding refines geo defaults — merge selectively
    Object.assign(content, onboardingOverrides);
  }

  switch (persona) {
    case "ghanaian_importer":
      return {
        persona,
        guardianMode: "cycle",
        tabLabels: { ...defaultLabels, protect: "Shield" },
        primaryCTA: walletConnected ? "save-cycle" : "connect-wallet",
        displayCurrency: "GHS",
        currencyFlag: flag || "🇬🇭",
        content,
      };

    case "ghanaian_saver":
      return {
        persona,
        guardianMode: "savings",
        tabLabels: defaultLabels,
        primaryCTA: walletConnected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "GHS",
        currencyFlag: flag || "🇬🇭",
        content,
      };

    case "philippine_bpo":
      return {
        persona,
        guardianMode: signals.history.hasCycles ? "cycle" : "savings",
        tabLabels: { ...defaultLabels, protect: "Shield" },
        primaryCTA: walletConnected ? "save-cycle" : "connect-wallet",
        displayCurrency: "PHP",
        currencyFlag: flag || "🇵🇭",
        content,
      };

    case "diaspora":
      return {
        persona,
        guardianMode: "savings",
        tabLabels: defaultLabels,
        primaryCTA: walletConnected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "🇺🇸",
        content,
      };

    case "us_saver":
      return {
        persona,
        guardianMode: "savings",
        tabLabels: defaultLabels,
        primaryCTA: walletConnected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "🇺🇸",
        content,
      };

    default:
      return {
        persona,
        guardianMode: "savings",
        tabLabels: defaultLabels,
        primaryCTA: walletConnected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "💱",
        content,
      };
  }
}

// ─── Hook ──────────────────────────────────────────────────────

export function useSignalDetector() {
  const { address, walletChainId } = useAppShellContext();
  const { countryCode, countryName, region, detectionMethod } = useUserRegion();
  const { riskData } = useCurrencyRisk();
  const { config: profileConfig } = useProtectionProfile();

  // Wallet state
  const [hasHoldings, setHasHoldings] = useState(false);
  const [totalValueUsd, setTotalValueUsd] = useState(0);

  // Phase 1: basic check — if wallet connected and on any chain, likely has something
  const hasWallet = !!address && !!walletChainId;

  useEffect(() => {
    if (!address) {
      setHasHoldings(false);
      setTotalValueUsd(0);
      return;
    }
    if (walletChainId) {
      setHasHoldings(true);
    }
  }, [address, walletChainId]);

  // History signals (Phase 1 stubs, Phase 2 real data)
  const hasCycles = false;
  const cycleCount = 0;
  const hasGuardianAuth = false;
  const guardianTier = null;
  const protectionScore = null;

  // Device detection (stable)
  const [device, setDevice] = useState<{ isMobile: boolean; method: DetectionMethod }>(() =>
    detectDevice(),
  );

  // Resolve the signals
  const signals: DetectedSignals = useMemo(() => ({
    geo: {
      countryCode,
      countryName,
      region,
      currency: riskData?.code ?? "GHS",
      flag: riskData?.flag ?? "",
    },
    wallet: {
      connected: !!address,
      address: address ?? null,
      chainId: walletChainId ?? null,
      hasHoldings,
      totalValueUsd,
    },
    history: {
      hasCycles,
      cycleCount,
      hasGuardianAuth,
      guardianTier,
      protectionScore,
    },
    device,
    onboarding: profileConfig,
  }), [
    address, walletChainId, countryCode, countryName, region,
    riskData?.code, riskData?.flag,
    hasHoldings, totalValueUsd, device,
    profileConfig,
  ]);

  // Resolve persona and config
  const persona = useMemo(
    () => resolvePersona(signals),
    [signals],
  );

  const config = useMemo(
    () => buildConfig(signals, persona),
    [signals, persona],
  );

  return {
    signals,
    persona,
    config,
    isMobile: device.isMobile,
    detectionMethod,
    currencyCode: riskData?.code ?? null,
  };
}

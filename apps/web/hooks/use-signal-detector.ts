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
 *
 * The config is returned as a stable reference (useMemo) so consumers
 * don't trigger unnecessary re-renders when signals are unchanged.
 *
 * Phase 1 (now): geo + wallet connected state
 * Phase 2 (next): cycle history + behavioral patterns
 */

import { useMemo, useState, useEffect } from "react";
import { useAppShellContext } from "../context/app/AppShellContext";
import { useUserRegion } from "./use-user-region";
import { useCurrencyRisk } from "./use-currency-risk";
import { useSharedMultichainBalances } from "../context/app/PortfolioContext";
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
}

/**
 * Which persona the signals map to. This drives adaptive routing.
 */
export type AdaptivePersona =
  | "ghanaian_importer"     // GH, has cycles, working capital pattern
  | "ghanaian_saver"        // GH, connected wallet, savings pattern
  | "diaspora"              // US/EU, has Ghana/currency risk data
  | "us_saver"              // US, generic retail
  | "philippine_bpo"        // PH, has cycles, BPO/trader pattern
  | "apac_user"             // Asia, any persona
  | "latam_user"            // LatAm, any persona
  | "european_user"         // Europe, any persona
  | "generic_user"          // No pattern matched — default retail

export interface AdaptiveConfig {
  /** Which persona the system has detected */
  persona: AdaptivePersona;
  /** Whether to show business FX surfaces */
  showBusiness: boolean;
  /** Whether to show yield engine (true for most, false for pure FX users) */
  showYield: boolean;
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

function resolvePersona(
  signals: DetectedSignals,
): AdaptivePersona {
  const { geo, wallet, history } = signals;
  const country = signals.geo.countryCode;
  const address = signals.wallet.connected ? signals.wallet.address ?? null : null;
  const walletChainId = signals.wallet.chainId;

  // Phase 1: geo + wallet-based personas
  if (country === "GH") {
    if (history.hasCycles) return "ghanaian_importer";
    if (wallet.connected) return "ghanaian_saver";
    return "ghanaian_importer"; // default to importer for GH visitors
  }

  if (country === "US") {
    // US visitor — could be diaspora or generic saver
    return "us_saver";
  }

  if (country === "PH") {
    if (history.hasCycles) return "philippine_bpo";
    return "apac_user";
  }

  if (["KE", "NG", "TZ", "UG", "ET"].includes(country ?? "")) {
    return "generic_user";
  }

  if (["AR", "BR", "CO", "CL", "PE"].includes(country ?? "")) {
    return "latam_user";
  }

  if (["GB", "DE", "FR", "IT", "ES", "NL", "SE"].includes(country ?? "")) {
    return "european_user";
  }

  if (["IN", "ID", "TH", "VN", "MY", "SG"].includes(country ?? "")) {
    return "apac_user";
  }

  if (country === "US") {
    // US visitor with diaspora signals could be detected here
    // Phase 2: check wallet history for international patterns
    return "us_saver";
  }

  return "generic_user";
}

// ─── Config builder ────────────────────────────────────────────

function buildConfig(
  signals: DetectedSignals,
  persona: AdaptivePersona,
): AdaptiveConfig {
  const { currency, flag } = signals.geo;

  // Default tab labels
  const defaultLabels = {
    overview: "Home",
    protect: "Shield",
    exchange: "Exchange",
    agent: "Agent",
    info: "Learn",
  };

  const labels = { ...defaultLabels };

  switch (persona) {
    case "ghanaian_importer":
      labels.protect = "Shield";
      return {
        persona,
        showBusiness: true,
        showYield: true,
        guardianMode: "cycle",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "save-cycle" : "connect-wallet",
        displayCurrency: "GHS",
        currencyFlag: flag || "🇬🇭",
      };

    case "ghanaian_saver":
      return {
        persona,
        showBusiness: false,
        showYield: true,
        guardianMode: "savings",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "GHS",
        currencyFlag: flag || "🇬🇭",
      };

    case "philippine_bpo":
      labels.protect = "Shield";
      return {
        persona,
        showBusiness: signals.history.hasCycles,
        showYield: true,
        guardianMode: signals.history.hasCycles ? "cycle" : "savings",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "save-cycle" : "connect-wallet",
        displayCurrency: "PHP",
        currencyFlag: flag || "🇵🇭",
      };

    case "us_saver":
      return {
        persona,
        showBusiness: false,
        showYield: true,
        guardianMode: "savings",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "🇺🇸",
      };

    case "diaspora":
      return {
        persona,
        showBusiness: false,
        showYield: true,
        guardianMode: "savings",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "🇺🇸",
      };

    default:
      return {
        persona,
        showBusiness: false,
        showYield: true,
        guardianMode: "savings",
        tabLabels: labels,
        primaryCTA: signals.wallet.connected ? "enable-guardian" : "connect-wallet",
        displayCurrency: "USD",
        currencyFlag: flag || "💱",
      };
  }
}

// ─── Hook ──────────────────────────────────────────────────────

export function useSignalDetector() {
  const { address, walletChainId } = useAppShellContext();
  const { countryCode, countryName, region, detectionMethod } = useUserRegion();
  const { riskData } = useCurrencyRisk();

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
  }), [
    address, walletChainId, countryCode, countryName, region,
    riskData?.code, riskData?.flag,
    hasHoldings, totalValueUsd, device,
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

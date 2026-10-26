import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGuardianInteraction } from "../use-guardian-interaction";

const nav = vi.hoisted(() => ({
  navigation: null as null | Record<string, unknown>,
}));
vi.mock("@/context/app/NavigationContext", () => ({ useNavigationOptional: () => nav.navigation }));
vi.mock("@/context/app/ExperienceContext", () => ({ useExperienceOptional: () => null }));
vi.mock("@/lib/exchange-view", () => ({ readExchangePair: () => ({ fromToken: "USDm", toToken: "NGNm" }) }));
vi.mock("@/lib/demo-session", () => ({ getDemoToken: () => null }));
vi.mock("@/hooks/use-allowance", () => ({ reportAllowance: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackFunnelEvent: vi.fn() }));
vi.mock("@diversifi/shared/src/services/ai/intent-discovery.service", () => ({
  IntentDiscoveryService: { discoverInteraction: vi.fn(() => null) },
}));

const navBase = () => ({
  activeTab: "exchange",
  exchangeNetwork: "stellar:testnet" as const,
  setExchangeNetwork: vi.fn(),
  setActiveTab: vi.fn(),
  swapPrefill: null,
  currencyView: null,
  currencyReading: null,
  currencyClarification: null,
  clearSwapPrefill: vi.fn(),
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("open_stellar apply", () => {
  it("navigates to Stellar testnet when enabled, no wallet or signing involved", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    nav.navigation = { ...navBase(), exchangeNetwork: "evm" };
    const { result } = renderHook(() => useGuardianInteraction());
    const applied = result.current.apply({ kind: "open_stellar" });
    expect(applied).toEqual({
      message: "Stellar testnet is open. Use test funds and review the exchange before approving it in your wallet.",
      revealSurface: true,
    });
    expect(nav.navigation!.setExchangeNetwork).toHaveBeenCalledWith("stellar:testnet");
    expect(nav.navigation!.setActiveTab).toHaveBeenCalledWith("exchange");
  });

  it("disabled flag fails closed without navigation", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "");
    nav.navigation = { ...navBase(), exchangeNetwork: "evm" };
    const { result } = renderHook(() => useGuardianInteraction());
    const applied = result.current.apply({ kind: "open_stellar" });
    expect(applied).toEqual({ message: "Stellar testnet is not enabled in this build.", revealSurface: false });
    expect(nav.navigation!.setExchangeNetwork).not.toHaveBeenCalled();
    expect(nav.navigation!.setActiveTab).not.toHaveBeenCalled();
  });

  it("getView omits the EVM pair while Stellar is selected", () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    nav.navigation = navBase();
    const { result } = renderHook(() => useGuardianInteraction());
    const view = result.current.getView?.();
    expect(JSON.stringify(view)).not.toContain("USDm");
    // cancel_draft on Stellar doesn't clear EVM state
    nav.navigation = { ...navBase(), swapPrefill: { fromToken: "A", toToken: "B" } };
    const cancelled = result.current.apply({ kind: "cancel_draft" });
    expect(cancelled?.message).toContain("Stellar review");
    expect(nav.navigation!.clearSwapPrefill).not.toHaveBeenCalled();
  });
});

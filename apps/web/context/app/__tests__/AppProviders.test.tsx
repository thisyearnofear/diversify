/**
 * Regression test: provider ordering in AppProviders.
 *
 * Bug (2026-09): PortfolioProvider consumed useWalletContext() while
 * WalletProvider was mounted BELOW AppProviders (in ProviderTree). React
 * context only flows downward, so PortfolioProvider silently resolved the
 * DEFAULT wallet context — address: null — and useMultichainBalances never
 * fetched. Every portfolio consumer (Home via useAppShell, chat, swaps)
 * shared that permanently-empty instance, and OverviewTab waited forever
 * on a balance snapshot that never arrived after connecting a wallet.
 *
 * These tests pin the contract:
 *  1. A consumer at the bottom of AppProviders (where AppShell/Home render)
 *     sees the REAL wallet context, and PortfolioProvider passes the
 *     connected address into useMultichainBalances.
 *  2. The old broken ordering reproduces the exact failure signature —
 *     proving the probe above actually detects the regression (not vacuous).
 *
 * useWallet and useMultichainBalances are mocked: the first so no Privy /
 * injected-wallet machinery runs in jsdom, the second to capture the address
 * PortfolioProvider hands down — that capture IS the assertion surface.
 */

// @vitest-environment jsdom

import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const h = vi.hoisted(() => ({
  // Realistic 20-byte hex address. Non-null on purpose: the default wallet
  // context (what the bug leaked) has address: null, so the assertions below
  // must not be able to pass against the default value.
  SENTINEL_ADDRESS: "0xfeedfacefeedfacefeedfacefeedfacefeedface",
  walletSentinel: {
    address: "0xfeedfacefeedfacefeedfacefeedfacefeedface",
    isConnected: true,
    isConnecting: false,
    error: null as string | null,
    chainId: 42220,
    isMiniPay: false,
    isFarcaster: false,
    farcasterContext: null,
    connect: async () => {},
    disconnect: async () => {},
    switchNetwork: async () => {},
    connectFarcasterWallet: async () => {},
    getFarcasterErrorMessage: () => null,
    signMessage: async () => "",
    formatAddress: (addr: string) => addr,
  },
  /** Every address passed into useMultichainBalances, in call order. */
  multichainAddresses: [] as unknown[],
  /** What a consumer at the bottom of the tree saw, captured in effects. */
  probe: {
    walletAddress: null as string | null,
    hasPortfolio: false,
  },
}));

vi.mock("../../../hooks/use-wallet", () => ({
  useWallet: () => h.walletSentinel,
}));

vi.mock("../../../hooks/use-multichain-balances", () => ({
  useMultichainBalances: (address: unknown) => {
    h.multichainAddresses.push(address);
    // Only `refresh` (plus the spread) is consumed by PortfolioContext;
    // the rest keeps the shape honest for any portfolio reader.
    return {
      totalValue: 0,
      lastUpdated: null,
      isLoading: false,
      isStale: false,
      hasEstimates: false,
      errors: [],
      chains: [],
      allTokens: [],
      tokenMap: {},
      regionData: [],
      chainCount: 0,
      refresh: async () => {},
    };
  },
}));

import { AppProviders } from "../AppProviders";
import { useWalletContext, WalletProvider } from "../../../components/wallet/WalletProvider";
import { PortfolioProvider, usePortfolio } from "../PortfolioContext";
import { NavigationProvider } from "../NavigationContext";
import { ProtectionProfileProvider } from "../../../hooks/use-protection-profile";

/** Sits exactly where AppShell renders — the bottom of AppProviders. */
function Probe() {
  const wallet = useWalletContext();
  const portfolio = usePortfolio();
  useEffect(() => {
    h.probe.walletAddress = wallet.address;
    h.probe.hasPortfolio = portfolio != null;
  });
  return null;
}

beforeEach(() => {
  h.multichainAddresses.length = 0;
  h.probe.walletAddress = null;
  h.probe.hasPortfolio = false;
  window.localStorage.clear();
});

describe("AppProviders — wallet context reaches PortfolioProvider", () => {
  it("delivers the real wallet context to consumers at the bottom of the tree", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    // The probe must see the WalletProvider value, not the context default
    // (whose address is null). This is what was silently broken before.
    expect(h.probe.walletAddress).toBe(h.SENTINEL_ADDRESS);
    expect(h.probe.hasPortfolio).toBe(true);
  });

  it("passes the connected address into useMultichainBalances so balances fetch", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    // PortfolioProvider's own useWalletContext() resolved above WalletProvider:
    // the address flows into the portfolio hook (the bug sent null here and
    // the fetch effect bailed, so lastUpdated never got set).
    expect(h.multichainAddresses.length).toBeGreaterThan(0);
    expect(h.multichainAddresses).toContain(h.SENTINEL_ADDRESS);
    expect(h.multichainAddresses).not.toContain(null);
  });

  it("reproduces the shipped bug when WalletProvider mounts below PortfolioProvider", () => {
    // The old (broken) ordering, reconstructed minimally: the portfolio
    // consumer sits ABOVE WalletProvider, exactly as ProviderTree mounted it.
    render(
      <NavigationProvider>
        <ProtectionProfileProvider>
          <PortfolioProvider>
            <WalletProvider>
              <Probe />
            </WalletProvider>
          </PortfolioProvider>
        </ProtectionProfileProvider>
      </NavigationProvider>,
    );

    // The probe sits BELOW WalletProvider, so it sees the wallet fine…
    expect(h.probe.walletAddress).toBe(h.SENTINEL_ADDRESS);
    expect(h.probe.hasPortfolio).toBe(true);
    // …but PortfolioProvider resolved the DEFAULT wallet context (address
    // null) and passed null down — the exact production failure signature.
    expect(h.multichainAddresses).toContain(null);
    expect(h.multichainAddresses).not.toContain(h.SENTINEL_ADDRESS);
  });
});

/**
 * WalletButton — Stellar family coverage.
 *
 * A Stellar-only session (no EVM wallet) must still read as connected —
 * that's the whole point of the multi-wallet picker. Disconnect tears down
 * both families; pending Stellar records are session-independent and survive.
 */
// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WalletButton from "../WalletButton";
import { useWalletContext } from "../WalletProvider";
import { NETWORKS } from "../../../config";

const stellar = vi.hoisted(() => ({
  account: null as { account: string } | null,
  connect: vi.fn(),
  restore: vi.fn(),
  refresh: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("../WalletProvider", () => ({ useWalletContext: vi.fn() }));
vi.mock("../../../config/features", () => ({
  WALLET_FEATURES: { PRIVY_ENABLED: true, PRIVY_APP_ID: "" },
}));
vi.mock("@/context/PrivyProvider", () => ({ usePrivy: () => ({ authenticated: false, user: null }) }));
vi.mock("@/context/app/PortfolioContext", () => ({ usePortfolio: () => null }));
vi.mock("../../onramp", () => ({
  SmartBuyCryptoButton: () => null,
  SmartSellCryptoButton: () => null,
}));
vi.mock("@/components/shared/StatusBadge", () => ({ default: () => null }));
vi.mock("@/lib/analytics", () => ({ trackFunnelEvent: vi.fn() }));
vi.mock("@/hooks/use-stellar-session", () => ({ useStellarSession: () => stellar }));
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigationOptional: () => null,
}));

const ACCOUNT = "GDGS4WMBIDH2Y4TUOEKKHJSFOUVB75XL6TY7Q2M56BLQOQW4ALKIOO5N";

function mockWallet(overrides: Partial<ReturnType<typeof useWalletContext>> = {}) {
  vi.mocked(useWalletContext).mockReturnValue({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    isMiniPay: false,
    isFarcaster: false,
    chainId: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    formatAddress: (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`,
    switchNetwork: vi.fn(),
    connectFarcasterWallet: vi.fn(),
    getFarcasterErrorMessage: () => null,
    signMessage: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useWalletContext>);
}

beforeEach(() => {
  stellar.account = null;
  stellar.disconnect.mockClear();
});
afterEach(cleanup);

describe("WalletButton — Stellar session", () => {
  it("a Stellar-only session renders connected with the G-address and Stellar tag", () => {
    mockWallet();
    stellar.account = { account: ACCOUNT };
    render(<WalletButton />);
    const button = screen.getByRole("button", { name: /On Stellar/i });
    expect(button).toHaveTextContent("✦");
    expect(button).toHaveTextContent("GDGS…OO5N");
    expect(button).toHaveTextContent("Stellar");
  });

  it("without either family it stays a plain connect control", () => {
    mockWallet();
    render(<WalletButton />);
    expect(screen.queryByRole("button", { name: /On Stellar/i })).toBeNull();
  });

  it("disconnect tears down both families and pending records are untouched", async () => {
    const evmDisconnect = vi.fn().mockResolvedValue(undefined);
    mockWallet({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      isConnected: true,
      chainId: NETWORKS.CELO_MAINNET.chainId,
      disconnect: evmDisconnect,
    });
    stellar.account = { account: ACCOUNT };
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1 }));

    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /Disconnect wallet/i }));

    await waitFor(() => expect(evmDisconnect).toHaveBeenCalled());
    expect(stellar.disconnect).toHaveBeenCalled();
    expect(localStorage.getItem("diversifi.stellar.pending.v1")).not.toBeNull();
    localStorage.removeItem("diversifi.stellar.pending.v1");
  });

  it("stellar-only disconnect works with no EVM wallet at all", async () => {
    mockWallet();
    stellar.account = { account: ACCOUNT };
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /Disconnect wallet/i }));
    await waitFor(() => expect(stellar.disconnect).toHaveBeenCalled());
  });
});

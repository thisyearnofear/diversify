/**
 * The connected wallet button shows its current chain on its own face
 * (icon + short name) — merged in 2026-09-28 from the removed header
 * ChainPill so "see the chain without hunting" (2026-09-03 tester
 * feedback) survives on the ONE control that owns chain state, instead
 * of two controls doing the same job.
 */
// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WalletButton from "../WalletButton";
import { useWalletContext } from "../WalletProvider";
import { NETWORKS } from "../../../config";

vi.mock("../WalletProvider", () => ({ useWalletContext: vi.fn() }));
vi.mock("@/context/PrivyProvider", () => ({ usePrivy: () => ({ authenticated: false, user: null }) }));
vi.mock("@/context/app/PortfolioContext", () => ({ usePortfolio: () => null }));
vi.mock("../../onramp", () => ({
  SmartBuyCryptoButton: () => null,
  SmartSellCryptoButton: () => null,
}));
vi.mock("@/components/shared/StatusBadge", () => ({ default: () => null }));

afterEach(() => cleanup());

function mockWallet(overrides: Partial<ReturnType<typeof useWalletContext>> = {}) {
  vi.mocked(useWalletContext).mockReturnValue({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    isConnected: true,
    isConnecting: false,
    error: null,
    isMiniPay: false,
    isFarcaster: false,
    chainId: NETWORKS.CELO_MAINNET.chainId,
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

describe("WalletButton — chain on the closed face", () => {
  it("shows the current chain's icon and short name beside the address", () => {
    mockWallet({ chainId: NETWORKS.CELO_MAINNET.chainId });
    render(<WalletButton />);
    const button = screen.getByRole("button", { name: /On Celo/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("🌱");
    expect(button).toHaveTextContent("Celo");
  });

  it("updates when the chain changes", () => {
    mockWallet({ chainId: NETWORKS.ARBITRUM_ONE.chainId });
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /On Arbitrum/i })).toHaveTextContent("Arbitrum");
  });

  it("degrades gracefully with no chain (no crash, no stale chain name)", () => {
    mockWallet({ chainId: null });
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /On an unknown network/i })).toBeInTheDocument();
  });
});

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
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import WalletButton from "../WalletButton";
import { useWalletContext } from "../WalletProvider";
import { NETWORKS } from "../../../config";

const mockWalletFeatures = vi.hoisted(() => ({
  PRIVY_ENABLED: true,
  PRIVY_APP_ID: "",
}));

vi.mock("../WalletProvider", () => ({ useWalletContext: vi.fn() }));
vi.mock("../../../config/features", () => ({
  WALLET_FEATURES: mockWalletFeatures,
}));
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

function mockUnconnected(error: string | null, connect?: ReturnType<typeof vi.fn>) {
  vi.mocked(useWalletContext).mockReturnValue({
    address: null,
    isConnected: false,
    isConnecting: false,
    error,
    isMiniPay: false,
    isFarcaster: false,
    chainId: null,
    connect: connect ?? vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    formatAddress: (a: string) => a,
    switchNetwork: vi.fn(),
    connectFarcasterWallet: vi.fn(),
    getFarcasterErrorMessage: () => null,
    signMessage: vi.fn(),
  } as unknown as ReturnType<typeof useWalletContext>);
}

describe("WalletButton — connect feedback ownership", () => {
  afterEach(() => {
    delete (window as { ethereum?: unknown }).ethereum;
    mockWalletFeatures.PRIVY_APP_ID = "";
  });

  it("the attempted button alone shows one status panel; its sibling shows none", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    mockUnconnected(
      "No wallet found. Please install a wallet extension or enable social login.",
      connect,
    );
    render(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /connect/i })[0]);
    const panels = await screen.findAllByRole("status");
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent("Choose a wallet to continue");
    expect(panels[0]).toHaveTextContent(/browser wallet extension/);
    expect(panels[0]).not.toHaveTextContent(/enable social login/i);
    expect(panels[0].className).not.toMatch(/text-red/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("Dismiss wallet guidance and Escape each hide the panel", async () => {
    mockUnconnected("No wallet found.");
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss wallet guidance" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    await screen.findByRole("status");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("classifies a cancelled connection without echoing raw error text", async () => {
    mockUnconnected("User rejected the request. code=4001");
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    const panel = await screen.findByRole("status");
    expect(panel).toHaveTextContent("Connection cancelled");
    expect(panel).toHaveTextContent("Nothing changed");
    expect(panel).not.toHaveTextContent("4001");
  });

  it("falls back to a safe generic message for unknown errors", async () => {
    mockUnconnected("Something odd happened upstream");
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /connect/i }));
    const panel = await screen.findByRole("status");
    expect(panel).toHaveTextContent("Couldn’t connect");
    expect(panel).not.toHaveTextContent("Something odd happened upstream");
  });

  it("the tooltip states the path actually configured", () => {
    mockUnconnected(null);
    const { unmount } = render(<WalletButton />);
    expect(screen.getByRole("button", { name: /connect/i })).toHaveAttribute(
      "title",
      "Connect with a browser wallet or open this page in your wallet app",
    );
    unmount();

    mockWalletFeatures.PRIVY_APP_ID = "test-app-id";
    const { unmount: u2 } = render(<WalletButton />);
    expect(screen.getByRole("button", { name: /connect/i })).toHaveAttribute(
      "title",
      "Connect with email, social login, or a supported wallet",
    );
    u2();
    mockWalletFeatures.PRIVY_APP_ID = "";

    (window as { ethereum?: unknown }).ethereum = {};
    render(<WalletButton />);
    expect(screen.getByRole("button", { name: /connect/i })).toHaveAttribute(
      "title",
      "Connect with MetaMask/Coinbase or other browser wallet",
    );
  });

  it("no panel renders before an attempt even when the global error is set", () => {
    mockUnconnected("No wallet found.");
    render(<WalletButton />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("a second button's attempt takes ownership — only B shows feedback after B fails", async () => {
    const error = "No wallet found.";
    const connectA = vi.fn().mockResolvedValue(undefined);
    let resolveB: (() => void) | null = null;
    const connectB = vi.fn(
      () => new Promise<void>((r) => { resolveB = r; }),
    );
    const setWalletState = (connecting: boolean, connect = connectB) => {
      vi.mocked(useWalletContext).mockReturnValue({
        address: null, isConnected: false, isConnecting: connecting,
        error, isMiniPay: false, isFarcaster: false, chainId: null,
        connect, disconnect: vi.fn(), formatAddress: (a: string) => a,
        switchNetwork: vi.fn(), connectFarcasterWallet: vi.fn(),
        getFarcasterErrorMessage: () => null, signMessage: vi.fn(),
      } as unknown as ReturnType<typeof useWalletContext>);
    };

    setWalletState(false, connectA);
    const { rerender } = render(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /connect/i })[0]);
    await screen.findByRole("status");

    setWalletState(false);
    rerender(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /connect/i })[1]);
    setWalletState(true);
    rerender(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    setWalletState(false);
    rerender(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    resolveB?.();
    const panels = await screen.findAllByRole("status");
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent("Choose a wallet to continue");
    expect(connectB).toHaveBeenCalledTimes(1);
  });
});

describe("WalletButton — dropdown dismissal", () => {
  it("Copy Address inside the menu still works and closes the dropdown", async () => {
    mockWallet();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet menu/i }));
    fireEvent.click(screen.getByRole("button", { name: "Copy wallet address" }));
    expect(writeText).toHaveBeenCalledWith("0x1234567890abcdef1234567890abcdef12345678");
    expect(
      screen.queryByRole("button", { name: "Copy wallet address" }),
    ).not.toBeInTheDocument();
  });

  it("a pointerdown outside the wrapper closes the dropdown", () => {
    mockWallet();
    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet menu/i }));
    expect(screen.getByRole("button", { name: "Copy wallet address" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("button", { name: "Copy wallet address" }),
    ).not.toBeInTheDocument();
  });
});

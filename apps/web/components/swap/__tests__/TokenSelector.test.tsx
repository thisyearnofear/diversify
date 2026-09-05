import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

/**
 * TokenSelector balance-line honesty:
 * a walletless visitor has no balances, so the balance line must not
 * render at all — "Balance: 0.0000 X" would fabricate a state that
 * cannot become true (§ honesty rails).
 */

const { mockUseReducedMotion } = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => true),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_t, prop) =>
      function MockedMotion({ children, ...rest }: { children?: React.ReactNode }) {
        return React.createElement(prop as string, rest, children);
      },
  }),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: mockUseReducedMotion,
}));

vi.mock("../../config", () => ({
  REGION_COLORS: {},
  TOKEN_METADATA: {},
  EXCHANGE_RATES: {},
}));

vi.mock("@diversifi/shared/src/services/strategy/strategy.service", () => ({
  StrategyService: {
    getCompliance: vi.fn(() => null),
  },
}));

import TokenSelector from "../TokenSelector";

const TOKENS = [
  { symbol: "cUSD", name: "Celo Dollar", icon: "", region: "Africa" },
  { symbol: "KESm", name: "Kenya Shilling (Mento)", icon: "", region: "Africa" },
];

const baseProps = {
  label: "From" as const,
  selectedToken: "cUSD",
  onTokenChange: () => {},
  amount: "10",
  availableTokens: TOKENS,
};

describe("TokenSelector — walletless balance honesty", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the balance line when a wallet is connected", () => {
    render(
      <TokenSelector
        {...baseProps}
        hasWallet
        tokenBalances={{ cUSD: { formattedBalance: "12.5", value: 12.5 } }}
      />,
    );
    expect(screen.getByText("Balance:")).toBeInTheDocument();
    expect(screen.getByText(/12\.5000 cUSD/)).toBeInTheDocument();
  });

  it("suppresses the balance line entirely when no wallet is connected", () => {
    render(
      <TokenSelector
        {...baseProps}
        hasWallet={false}
        tokenBalances={{}}
      />,
    );
    expect(screen.queryByText("Balance:")).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.0000/)).not.toBeInTheDocument();
  });

  it("still defaults hasWallet=true so connected callers are unaffected", () => {
    render(
      <TokenSelector
        {...baseProps}
        tokenBalances={{ cUSD: { formattedBalance: "3", value: 3 } }}
      />,
    );
    expect(screen.getByText("Balance:")).toBeInTheDocument();
  });
});

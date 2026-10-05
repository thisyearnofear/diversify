import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The strategy/profile hooks drive the persona banners. Default: no
// philosophy set — the common first-visit path. Tests override via this
// holder before render (no doMock gymnastics needed).
const mockState = {
  financialStrategy: null as string | null,
  userRegion: null as string | null,
  detectedRegion: "USA" as string,
  riskTolerance: "Balanced" as "Conservative" | "Balanced" | "Aggressive",
  setFinancialStrategy: vi.fn(),
  setRiskTolerance: vi.fn(),
};

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: mockState.financialStrategy,
    setFinancialStrategy: mockState.setFinancialStrategy,
  }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: {
      philosophy: mockState.financialStrategy,
      userRegion: mockState.userRegion,
      riskTolerance: mockState.riskTolerance,
    },
    setRiskTolerance: mockState.setRiskTolerance,
  }),
}));

vi.mock("@/hooks/use-user-region", () => ({
  useUserRegion: () => ({ region: mockState.detectedRegion }),
}));

vi.mock("@/components/tabs/protect/PhilosophyCoinRail", () => ({
  PhilosophyCoinRail: ({
    onSelect,
  }: {
    selected?: string | null;
    onSelect: (id: string) => void;
    onTapPoint?: (x: number, y: number) => void;
  }) => (
    <div data-testid="philosophy-coin-rail">
      <button
        type="button"
        data-testid="coin-buen_vivir"
        onClick={() => onSelect("buen_vivir")}
      >
        Buen Vivir
      </button>
    </div>
  ),
  FocusedPlanLine: ({ strategyId }: { strategyId: string | null }) => (
    <p data-testid="focused-plan-line">{strategyId ?? "none"}</p>
  ),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: ({ connectLabel }: { connectLabel?: string }) => (
    <button type="button">{connectLabel ?? "Connect wallet"}</button>
  ),
}));

vi.mock("@/components/shared/ApacRailHonestyBanner", () => ({
  ApacRailHonestyBanner: () => <div data-testid="apac-banner" />,
}));

vi.mock("@/components/shared/CaribbeanRailHonestyBanner", () => ({
  CaribbeanRailHonestyBanner: () => <div data-testid="caribbean-banner" />,
}));

vi.mock("@/components/shared/VerifiedEvidence", () => ({
  VerifiedEvidence: () => <div data-testid="verified-evidence">Verified</div>,
}));

import { ProtectionNotConnected } from "../ProtectionNotConnected";

describe("ProtectionNotConnected — Shield's unconnected morph", () => {
  it("keeps the philosophy picker as the object with the connect CTA attached", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

    // The picker renders walletless — compact ring + coin rail, choosing
    // a lens needs no funds.
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    // Two buttons total besides coins: the connect CTA + the demo
    // text link. No other actions exist.
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("data-testid")?.startsWith("coin-"));
    expect(buttons.length).toBe(2);
  });

  it("drops the marketing stack — no hero card, no how-it-works, no scrollytelling card", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(screen.queryByText(/Shield your purchasing power/)).not.toBeInTheDocument();
    expect(screen.queryByText("Protection Setup Steps")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-Saver Status")).not.toBeInTheDocument();
  });

  it("keeps trust + demo as quiet status-tier lines (shared tier) — no proof ticker", () => {
    const onEnableDemo = vi.fn();
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={onEnableDemo} />);

    expect(screen.getByTestId("verified-evidence")).toBeInTheDocument();
    // Home and Exchange carry no proof card; Shield's unconnected tier
    // doesn't either — the Verified line covers proof.
    expect(screen.queryByTestId("proof-ticker")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore a sample plan" }));
    expect(onEnableDemo).toHaveBeenCalledTimes(1);
  });

  it("persona morphs the status tier: APAC philosophy from Asia shows the APAC banner", () => {
    // Both signals required by isApacRailProfile: philosophy AND region.
    mockState.financialStrategy = "confucian";
    mockState.userRegion = "asia";
    mockState.detectedRegion = "asia";
    try {
      render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("apac-banner")).toBeInTheDocument();
      expect(screen.queryByTestId("caribbean-banner")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
      mockState.userRegion = null;
      mockState.detectedRegion = "USA";
    }
  });

  it("with a philosophy, the ghost ring IS the object — the picker waits behind the plan badge", async () => {
    mockState.financialStrategy = "africapitalism";
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

      const ring = screen.getByTestId("shield-ring");
      expect(ring).toHaveAttribute("data-walletless");
      // Empty-hole morph states the plan's reserve; the connect ask lives
      // only on the button and the plan name only on the badge.
      expect(within(ring).getByText("dollar reserve")).toBeInTheDocument();
      expect(within(screen.getByTestId("ring-hole")).queryByText(/connect/i)).not.toBeInTheDocument();
      // One mention only — the badge ("Africapitalism ▾").
      expect(within(ring).getAllByText(/Africapitalism/)).toHaveLength(1);
      expect(within(ring).getByTestId("plan-badge")).toHaveTextContent("Africapitalism");
      // The rail is not stacked under the ring — the badge morphs the
      // same object into compare.
      expect(screen.queryByTestId("philosophy-coin-rail")).not.toBeInTheDocument();
      expect(screen.queryByText("Choose a philosophy")).not.toBeInTheDocument();

      // Walletless legend says funding status once — no per-row "Not funded".
      expect(screen.queryByText("Not funded")).not.toBeInTheDocument();
      // Canonical tickers, not legacy cUSD/cEUR.
      expect(within(ring).getByText("Dollar")).toBeInTheDocument();
      expect(within(ring).queryByText("cUSD")).not.toBeInTheDocument();

      // The plan badge is the morph control — the compare affordance.
      expect(within(ring).getByTestId("plan-badge")).toBeInTheDocument();
      expect(within(ring).getByTestId("ring-hole")).toBeInTheDocument();
      fireEvent.click(within(ring).getByTestId("plan-badge"));
      // Compare transforms the same ring — it goes compact and stays
      // mounted, the coin rail slides in beneath.
      expect(screen.getByTestId("shield-ring")).toHaveAttribute(
        "data-comparing",
        "true",
      );
      expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
      expect(screen.getByTestId("back-to-plan")).toBeInTheDocument();
      expect(screen.getByTestId("ghost-plan-outline")).toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("the hole tap enters compare; a coin previews and 'Use this plan' commits", async () => {
    mockState.financialStrategy = "africapitalism";
    mockState.setFinancialStrategy.mockClear();
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

      fireEvent.click(screen.getByTestId("ring-hole"));
      expect(await screen.findByTestId("philosophy-coin-rail")).toBeInTheDocument();

      // ← Your plan returns without committing.
      fireEvent.click(screen.getByTestId("back-to-plan"));
      expect(screen.getByTestId("shield-ring")).not.toHaveAttribute(
        "data-comparing",
        "true",
      );
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();

      // A coin tap only previews — nothing commits until the CTA.
      fireEvent.click(screen.getByTestId("ring-hole"));
      fireEvent.click(await screen.findByTestId("coin-buen_vivir"));
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
      expect(screen.getByTestId("ring-hole")).toHaveTextContent("Buen Vivir");

      fireEvent.click(screen.getByTestId("walletless-commit"));
      expect(mockState.setFinancialStrategy).toHaveBeenCalledWith("buen_vivir");
      expect(screen.queryByTestId("philosophy-coin-rail")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("the connect CTA says the verb — the plan name is not repeated on it", () => {
    mockState.financialStrategy = "africapitalism";
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Connect to use/ }),
      ).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("committed walletless puts the connect CTA inside the controls slot — before the legend, never below it", () => {
    mockState.financialStrategy = "africapitalism";
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      const cta = screen.getByRole("button", { name: "Connect wallet" });
      const legend = screen.getByTestId("shield-legend");
      expect(
        cta.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        screen.getAllByRole("button", { name: "Connect wallet" }),
      ).toHaveLength(1);
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("with no philosophy the picker IS the compact ring + coin rail", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(screen.getByTestId("shield-ring")).toBeInTheDocument();
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(screen.getByText("Choose a philosophy")).toBeInTheDocument();
    // The empty track ghosts nothing — there is no current plan.
    expect(screen.queryByTestId("ghost-plan-outline")).not.toBeInTheDocument();
  });

  it("preview then commit re-slices the ghost ring", async () => {
    mockState.financialStrategy = "africapitalism";
    mockState.setFinancialStrategy.mockClear();
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("plan-badge")).toHaveTextContent("Africapitalism");

      fireEvent.click(screen.getByTestId("ring-hole"));
      fireEvent.click(await screen.findByTestId("coin-buen_vivir"));
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("walletless-commit"));
      expect(mockState.setFinancialStrategy).toHaveBeenCalledWith("buen_vivir");

      mockState.financialStrategy = "buen_vivir";
      rerender(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByTestId("plan-badge")).toHaveTextContent("Buen Vivir"),
      );
      expect(screen.getByTestId("shield-ring")).not.toHaveTextContent("Africapitalism");
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("walletless balance preview: draft re-slices targets, gallery and Connect step aside, Keep restores", async () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve 25% → 40%",
      );
      expect(screen.queryByTestId("philosophy-coin-rail")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use this balance" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve · 25% — dollar-pegged, not risk-free",
      );
      expect(await screen.findByTestId("shield-ring")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("Use this balance commits the tolerance walletless — no wallet, no signature", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      fireEvent.click(screen.getByRole("button", { name: "Use this balance" }));
      expect(mockState.setRiskTolerance).toHaveBeenCalledTimes(1);
      expect(mockState.setRiskTolerance).toHaveBeenCalledWith("Conservative");
    } finally {
      mockState.financialStrategy = null;
      mockState.riskTolerance = "Balanced";
    }
  });

  it("walletless slice selection answers the target in the hole — no held fiction", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /Shilling — plan: 60%/ }));
      expect(screen.getByText("60%")).toBeInTheDocument();
      expect(screen.getByText("Target only · not funded")).toBeInTheDocument();
      expect(screen.queryByText(/\d+% held/)).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("changing philosophy discards the draft without mutating the profile", async () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      expect(screen.queryByTestId("philosophy-coin-rail")).not.toBeInTheDocument();

      mockState.financialStrategy = "buen_vivir";
      rerender(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      // A committed philosophy returns the object to the ring re-sliced.
      expect(await screen.findByTestId("shield-ring")).toBeInTheDocument();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve · 20%",
      );
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("the external inspector steps aside during a draft and returns on Keep", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      render(
        <ProtectionNotConnected
          experienceMode="simple"
          onEnableDemo={vi.fn()}
          inspector={<div data-testid="external-inspector">existing</div>}
        />,
      );
      expect(screen.getByTestId("external-inspector")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      expect(screen.queryByTestId("external-inspector")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
      expect(screen.getByTestId("external-inspector")).toBeInTheDocument();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve · 25%",
      );
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("the sleeve teaser is a quiet wedge in the ring — tap opens the lens, no status link", () => {
    mockState.financialStrategy = "africapitalism";
    const onOpenSleeve = vi.fn();
    try {
      render(
        <ProtectionNotConnected
          experienceMode="simple"
          onEnableDemo={vi.fn()}
          onOpenSleeve={onOpenSleeve}
          onCloseSleeve={vi.fn()}
        />,
      );

      // Object grammar, not chrome: the invite rides inside the ring as
      // one hatched wedge — there is no action-hue text link anymore.
      expect(screen.queryByTestId("rwa-sleeve-entry")).not.toBeInTheDocument();
      const wedge = screen.getByRole("button", {
        name: /Tokenized assets — tap to look inside/,
      });
      fireEvent.click(wedge);
      expect(onOpenSleeve).toHaveBeenCalledTimes(1);
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("a balance preview quiets the status tier to trust — handoffs and demo step out", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    try {
      render(
        <ProtectionNotConnected
          experienceMode="simple"
          onEnableDemo={vi.fn()}
          onOpenSleeve={vi.fn()}
          onCloseSleeve={vi.fn()}
        />,
      );

      // Resting: the teaser wedge + demo link are present.
      expect(
        screen.getByRole("button", { name: /Tokenized assets — tap to look inside/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Explore a sample plan" }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));

      // The commit owns the screen: only the commit pair + trust remain.
      expect(
        screen.getByRole("button", { name: "Use this balance" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Explore a sample plan" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Tokenized assets — tap to look inside/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("verified-evidence")).toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("business morph: onOpenCycle renders the cycle entry instead of the tokenized link", () => {
    const onOpenCycle = vi.fn();
    render(
      <ProtectionNotConnected
        experienceMode="simple"
        onEnableDemo={vi.fn()}
        onOpenCycle={onOpenCycle}
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("rwa-sleeve-entry")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cycle-entry"));
    expect(onOpenCycle).toHaveBeenCalledTimes(1);
  });

  it("business morph: the sleeve back button still owns the open lens", () => {
    render(
      <ProtectionNotConnected
        experienceMode="simple"
        onEnableDemo={vi.fn()}
        onOpenCycle={vi.fn()}
        sleeveOpen
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rwa-sleeve-back")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-entry")).not.toBeInTheDocument();
  });

  it("persona morphs the status tier: Caribbean philosophy shows the Caribbean banner", () => {
    mockState.financialStrategy = "pan_caribbean";
    mockState.userRegion = "caribbean";
    mockState.detectedRegion = "caribbean";
    try {
      render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("caribbean-banner")).toBeInTheDocument();
      expect(screen.queryByTestId("apac-banner")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
      mockState.userRegion = null;
      mockState.detectedRegion = "USA";
    }
  });
});

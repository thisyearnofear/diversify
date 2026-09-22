import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

vi.mock("@/components/tabs/protect/ProtectionPlanGallery", () => ({
  ProtectionPlanGallery: () => (
    <div data-testid="plan-gallery">
      <button
        type="button"
        data-testid="plan-card-buen_vivir"
        onClick={() => mockState.setFinancialStrategy("buen_vivir")}
      >
        Buen Vivir
      </button>
    </div>
  ),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: () => <button type="button">Connect wallet</button>,
}));

vi.mock("@/components/shared/LiveProofCard", () => ({
  LiveProofTicker: ({ limit }: { limit?: number }) => (
    <div data-testid="proof-ticker" data-limit={limit ?? null} />
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
    render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);

    // The picker renders walletless — choosing a lens needs no funds.
    expect(screen.getByTestId("plan-gallery")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    // Two buttons total besides plan cards: the connect CTA + the demo
    // text link. No other actions exist.
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("data-testid")?.startsWith("plan-card-"));
    expect(buttons.length).toBe(2);
  });

  it("drops the marketing stack — no hero card, no how-it-works, no scrollytelling card", () => {
    render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(screen.queryByText(/Shield your purchasing power/)).not.toBeInTheDocument();
    expect(screen.queryByText("Protection Setup Steps")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-Saver Status")).not.toBeInTheDocument();
  });

  it("keeps trust + demo as quiet status-tier lines (shared tier)", () => {
    const onEnableDemo = vi.fn();
    render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={onEnableDemo} />);

    expect(screen.getByTestId("verified-evidence")).toBeInTheDocument();
    expect(screen.getByTestId("proof-ticker")).toBeInTheDocument();
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
        <ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("apac-banner")).toBeInTheDocument();
      expect(screen.queryByTestId("caribbean-banner")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
      mockState.userRegion = null;
      mockState.detectedRegion = "USA";
    }
  });

  it("with a philosophy, the ghost ring leads the object — 'Connect to fund' hole, connect CTA stays the only action", () => {
    mockState.financialStrategy = "africapitalism";
    try {
      render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);

      const ring = screen.getByTestId("shield-ring");
      expect(ring).toHaveAttribute("data-walletless");
      // Empty-hole morph speaks walletless: label asks to connect, the
      // hint still names the plan.
      expect(within(ring).getByText("Connect to fund")).toBeInTheDocument();
      expect(within(ring).getAllByText("Africapitalism").length).toBeGreaterThan(0);
      // The ring sits above the picker; the picker line is unchanged.
      expect(ring.compareDocumentPosition(screen.getByTestId("shield-picker")) & 4).toBeTruthy();
      expect(screen.getByText("Choose a protection philosophy")).toBeInTheDocument();

      // Outside the ring's own slice rows and the plan cards, only the
      // connect CTA + demo link exist. No compare hole, no extra actions.
      const buttons = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            !ring.contains(b) &&
            !b.getAttribute("data-testid")?.startsWith("plan-card-"),
        );
      expect(buttons.length).toBe(2);
      expect(screen.queryByTestId("ring-hole")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("with no philosophy the picker alone is the object — no ring", () => {
    render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);
    expect(screen.queryByTestId("shield-ring")).not.toBeInTheDocument();
    expect(screen.getByTestId("shield-picker")).toBeInTheDocument();
  });

  it("tapping a plan card commits and re-slices the ghost ring", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.setFinancialStrategy.mockClear();
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />,
      );
      expect(
        within(screen.getByTestId("shield-ring")).getAllByText("Africapitalism").length,
      ).toBeGreaterThan(0);

      fireEvent.click(screen.getByTestId("plan-card-buen_vivir"));
      expect(mockState.setFinancialStrategy).toHaveBeenCalledWith("buen_vivir");

      mockState.financialStrategy = "buen_vivir";
      rerender(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);
      expect(
        within(screen.getByTestId("shield-ring")).getAllByText("Buen Vivir").length,
      ).toBeGreaterThan(0);
      expect(
        within(screen.getByTestId("shield-ring")).queryByText("Africapitalism"),
      ).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("walletless balance preview: draft re-slices targets, gallery and Connect step aside, Keep restores", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);

      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve 25% → 40% · other exposure 75% → 60%",
      );
      expect(screen.queryByTestId("plan-gallery")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use this balance" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Keep current balance" }));
      expect(mockState.setRiskTolerance).not.toHaveBeenCalled();
      expect(screen.getByTestId("balance-consequence")).toHaveTextContent(
        "Dollar reserve · 25%",
      );
      expect(screen.getByTestId("plan-gallery")).toBeInTheDocument();
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
      render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);
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
      render(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: /KESm — plan: 60%/ }));
      expect(screen.getByText("60%")).toBeInTheDocument();
      expect(screen.getByText("Target only · not funded")).toBeInTheDocument();
      expect(screen.queryByText(/\d+% held/)).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("changing philosophy discards the draft without mutating the profile", () => {
    mockState.financialStrategy = "africapitalism";
    mockState.riskTolerance = "Balanced";
    mockState.setRiskTolerance.mockClear();
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("radio", { name: "More reserve" }));
      expect(screen.queryByTestId("plan-gallery")).not.toBeInTheDocument();

      mockState.financialStrategy = "buen_vivir";
      rerender(<ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />);
      expect(screen.getByTestId("plan-gallery")).toBeInTheDocument();
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
          experienceMode="beginner"
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

  it("persona morphs the status tier: Caribbean philosophy shows the Caribbean banner", () => {
    mockState.financialStrategy = "pan_caribbean";
    mockState.userRegion = "caribbean";
    mockState.detectedRegion = "caribbean";
    try {
      render(
        <ProtectionNotConnected experienceMode="beginner" onEnableDemo={vi.fn()} />,
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

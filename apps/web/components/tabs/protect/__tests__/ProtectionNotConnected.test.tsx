import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The strategy/profile hooks drive the persona banners. Default: no
// philosophy set — the common first-visit path. Tests override via this
// holder before render (no doMock gymnastics needed).
const mockState = {
  financialStrategy: null as string | null,
  userRegion: null as string | null,
  detectedRegion: "USA" as string,
};

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: mockState.financialStrategy,
    setFinancialStrategy: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-protection-profile", () => ({
  useProtectionProfile: () => ({
    config: { philosophy: mockState.financialStrategy, userRegion: mockState.userRegion },
  }),
}));

vi.mock("@/hooks/use-user-region", () => ({
  useUserRegion: () => ({ region: mockState.detectedRegion }),
}));

vi.mock("@/components/tabs/protect/ProtectionPlanGallery", () => ({
  ProtectionPlanGallery: () => <div data-testid="plan-gallery" />,
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
    // Two buttons total: the connect CTA + the demo text link. No other
    // actions exist — the gallery's own selection state is internal.
    expect(screen.getAllByRole("button").length).toBe(2);
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

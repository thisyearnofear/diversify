import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The strategy/profile hooks drive the persona banners. Default: no
// philosophy set — the common first-visit path. Tests override via this
// holder before render (no doMock gymnastics needed).
const mockState = {
  financialStrategy: null as string | null,
  userRegion: null as string | null,
  detectedRegion: "USA" as string,
  riskTolerance: "Balanced" as "Conservative" | "Balanced" | "Aggressive",
  valuesPhilosophy: null as string | null,
  customPlan: null as unknown,
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
      valuesPhilosophy: mockState.valuesPhilosophy,
      customPlan: mockState.customPlan,
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
  FocusedPlanLine: ({
    strategyId,
    legs,
  }: {
    strategyId: string | null;
    legs?: { label?: string; token: string; percent: number }[];
  }) => (
    <p data-testid="focused-plan-line">
      {`${strategyId ?? "none"}${
        legs?.length
          ? ` | ${legs.map((l) => `${l.label ?? l.token} ${l.percent}%`).join(", ")}`
          : ""
      }`}
    </p>
  ),
}));

vi.mock("@/components/wallet/WalletButton", () => ({
  default: ({ connectLabel, variant }: { connectLabel?: string; variant?: string }) => (
    <button type="button" data-variant={variant}>{connectLabel ?? "Connect wallet"}</button>
  ),
}));

const navState = {
  pendingIntent: null as {
    tab: string;
    intent: { source: string; lens?: string; currencyCode?: string; example?: boolean };
  } | null,
  consumeIntent: vi.fn(),
  navigateToGuardian: vi.fn(),
};
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => navState,
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

// The live line's beats come from the proof feed — a holder the tests
// fill before render (null → only the watch cadence resolves).
const feedHolder = { data: null as { recent: unknown[] } | null };
vi.mock("@/hooks/use-proof-feed", () => ({
  useProofFeed: () => ({ data: feedHolder.data }),
}));

import { ProtectionNotConnected } from "../ProtectionNotConnected";

describe("ProtectionNotConnected — Shield's unconnected morph", () => {
  beforeEach(() => {
    navState.pendingIntent = null;
    navState.consumeIntent.mockClear();
    navState.navigateToGuardian.mockClear();
    mockState.setFinancialStrategy.mockClear();
  });

  it("keeps the philosophy picker as the object, instructs the coin tap, and quiets connect to the minimal affordance", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

    // The picker renders walletless — compact ring + coin rail, choosing
    // a lens needs no funds.
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(
      screen.getByText("Tap a philosophy coin to preview its plan"),
    ).toBeInTheDocument();
    // Choosing a plan is the next action — no extra Connect in the object
    // (the header Connect remains the wallet door).
    expect(
      screen.queryByRole("button", { name: "Connect wallet" }),
    ).not.toBeInTheDocument();
    // One button besides coins: the demo text link.
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("data-testid")?.startsWith("coin-"));
    expect(buttons.length).toBe(1);
  });

  it("planless: the first coin tap only previews — 'Use starting mix' is the primary commit", () => {
    mockState.setFinancialStrategy.mockClear();
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("walletless-commit"));
    expect(mockState.setFinancialStrategy).toHaveBeenCalledWith("buen_vivir");
  });

  it("the planless instruction leaves once a coin has been previewed", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(screen.getByTestId("picker-instruction")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    expect(screen.queryByTestId("picker-instruction")).not.toBeInTheDocument();
  });

  it("a previewed coin opens a sample outcome that closes back to the plan without committing", async () => {
    mockState.setFinancialStrategy.mockClear();
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(screen.queryByTestId("walletless-outcome-open")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    fireEvent.click(screen.getByTestId("walletless-outcome-open"));
    expect(screen.getByText(/· sample outcome/)).toBeInTheDocument();
    expect(screen.getByText("Example savings amount")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to plan" }));
    // The sheet leaves through its exit animation; wait for it to unmount.
    await waitFor(() =>
      expect(screen.queryByText("Example savings amount")).not.toBeInTheDocument(),
    );
    expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
  });

  it("a committed plan at rest offers one quiet bridge to Guardian's walletless example", () => {
    mockState.financialStrategy = "africapitalism";
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      const link = screen.getByTestId("guardian-plan-link");
      expect(link).toHaveTextContent("See an example Guardian decision");
      fireEvent.click(link);
      expect(navState.navigateToGuardian).toHaveBeenCalledWith(
        expect.objectContaining({ example: true }),
      );

      fireEvent.click(screen.getByTestId("plan-badge"));
      expect(screen.queryByTestId("guardian-plan-link")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
    }
  });

  it("no planless Guardian link and none while the sleeve lens owns the moment", () => {
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(screen.queryByTestId("guardian-plan-link")).not.toBeInTheDocument();
  });

  it("a Home compare intent opens the walletless compare and anchors its example context", () => {
    mockState.financialStrategy = "africapitalism";
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare", currencyCode: "NGN", example: true },
    };
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("shield-ring")).toHaveAttribute("data-comparing", "true");
      expect(screen.getByTestId("shield-intent-context")).toHaveTextContent(
        "From Home’s NGN example",
      );
      rerender(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      expect(navState.consumeIntent).toHaveBeenCalledTimes(1);
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
    } finally {
      mockState.financialStrategy = null;
      navState.pendingIntent = null;
    }
  });

  it("a confirmed Home compare intent names the visitor's own reading, not an example", () => {
    mockState.financialStrategy = "africapitalism";
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare", currencyCode: "NGN" },
    };
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      expect(screen.getByTestId("shield-intent-context")).toHaveTextContent(
        "From your NGN reading",
      );
    } finally {
      mockState.financialStrategy = null;
      navState.pendingIntent = null;
    }
  });

  it("a compare intent with no plan stays in the picker and keeps the context line", () => {
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare", currencyCode: "NGN", example: true },
    };
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(screen.getByTestId("philosophy-coin-rail")).toBeInTheDocument();
    expect(screen.getByTestId("shield-ring")).not.toHaveAttribute("data-comparing", "true");
    expect(screen.getByTestId("shield-intent-context")).toHaveTextContent(
      "From Home’s NGN example",
    );
    expect(navState.consumeIntent).toHaveBeenCalledTimes(1);
  });

  it("a plan change exits the intent compare and drops the hand-off context", () => {
    mockState.financialStrategy = "africapitalism";
    navState.pendingIntent = {
      tab: "protect",
      intent: { source: "home", lens: "compare", currencyCode: "NGN", example: true },
    };
    try {
      const { rerender } = render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      expect(screen.getByTestId("shield-intent-context")).toBeInTheDocument();
      mockState.financialStrategy = "buen_vivir";
      rerender(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      expect(screen.getByTestId("shield-ring")).not.toHaveAttribute("data-comparing", "true");
      expect(screen.queryByTestId("shield-intent-context")).not.toBeInTheDocument();
    } finally {
      mockState.financialStrategy = null;
      navState.pendingIntent = null;
    }
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
      const holeText = within(ring).getByText("dollar reserve").closest("div")!;
      expect(within(holeText).queryByText(/connect/i)).not.toBeInTheDocument();
      // The unfunded center is a static readout — the badge is the one
      // compare entry, not a second door in the hole.
      expect(within(ring).queryByTestId("ring-hole")).not.toBeInTheDocument();
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

      // The plan badge is the morph control — the compare affordance; the
      // resting hole stays a static readout (no second compare door).
      expect(within(ring).getByTestId("plan-badge")).toBeInTheDocument();
      expect(within(ring).queryByTestId("ring-hole")).not.toBeInTheDocument();
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

  it("the badge enters compare; a coin previews, the hole exits, 'Use starting mix' commits", async () => {
    mockState.financialStrategy = "africapitalism";
    mockState.setFinancialStrategy.mockClear();
    try {
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);

      fireEvent.click(screen.getByTestId("plan-badge"));
      expect(await screen.findByTestId("philosophy-coin-rail")).toBeInTheDocument();

      // The explicit exit affordance keeps the hole tappable — tapping it
      // leaves compare without committing.
      const hole = screen.getByTestId("ring-hole");
      expect(hole).toHaveAccessibleName("Exit compare");
      fireEvent.click(hole);
      expect(screen.getByTestId("shield-ring")).not.toHaveAttribute(
        "data-comparing",
        "true",
      );
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();

      // ← Your plan is the other exit, also without committing.
      fireEvent.click(screen.getByTestId("plan-badge"));
      fireEvent.click(screen.getByTestId("back-to-plan"));
      expect(screen.getByTestId("shield-ring")).not.toHaveAttribute(
        "data-comparing",
        "true",
      );
      expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();

      // A coin tap only previews — nothing commits until the CTA.
      fireEvent.click(screen.getByTestId("plan-badge"));
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

      fireEvent.click(screen.getByTestId("plan-badge"));
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

  it("the open lens owns the moment — the picker rail rests and the ring keeps its full size", () => {
    // Planless picker with the tokenized-asset lens open: the rail must
    // not squeeze beside the inspector, and the lens's ring anchor keeps
    // the full 200px stage (the 130px compact form is the picker's own
    // grammar, not the lens's).
    const ring = () =>
      document.querySelector('svg[aria-label="Allocation ring"]');
    const { rerender } = render(
      <ProtectionNotConnected
        experienceMode="simple"
        onEnableDemo={vi.fn()}
        sleeveOpen
        onCloseSleeve={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("shield-philosophy-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("rwa-sleeve-back")).toBeInTheDocument();
    expect(ring()).toHaveAttribute("width", "200");

    // Back to plan — the picker returns exactly as it was, teaser and all.
    rerender(
      <ProtectionNotConnected
        experienceMode="simple"
        onEnableDemo={vi.fn()}
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );
    expect(screen.getByTestId("shield-philosophy-rail")).toBeInTheDocument();
    expect(ring()).toHaveAttribute("width", "130");
    expect(
      screen.getByRole("button", { name: /Tokenized assets — tap to look inside/ }),
    ).toBeInTheDocument();
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

  it("the beat lands on the ring — a plan-leg signal tremors it, the cadence breathes it", () => {
    vi.useFakeTimers();
    mockState.financialStrategy = "africapitalism";
    feedHolder.data = {
      recent: [
        {
          action: "MACRO_SIGNAL:macro",
          targetToken: "KESm",
          reasoning:
            "Central bank held the benchmark rate. Source: https://reuters.example/a",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      ],
    };
    try {
      render(
        <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />,
      );
      const impulse = screen.getByTestId("beat-impulse");
      // Beat 0 (the fresh signal) is silent — the ring's arrival owns it.
      expect(impulse).toHaveAttribute("data-impulse", "none");
      // The cadence — one slow breath on the standing watch.
      act(() => vi.advanceTimersByTime(7500));
      expect(impulse).toHaveAttribute("data-impulse", "watch");
      // Wrapping back to the signal — the shock now lands on the plan.
      act(() => vi.advanceTimersByTime(7500));
      expect(impulse).toHaveAttribute("data-impulse", "signal");
    } finally {
      vi.useRealTimers();
      mockState.financialStrategy = null;
      feedHolder.data = null;
    }
  });
});

describe("ProtectionNotConnected — shape-the-mix handoffs", () => {
  it("'Shape this mix' hands the focused philosophy to the shared editor without committing", () => {
    mockState.setFinancialStrategy.mockClear();
    const onShapePlan = vi.fn();
    render(
      <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} onShapePlan={onShapePlan} />,
    );
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    fireEvent.click(screen.getByTestId("walletless-shape"));
    expect(onShapePlan).toHaveBeenCalledWith("buen_vivir");
    expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
  });

  it("'Build my mix' opens the standalone editor path from the planless picker", () => {
    const onShapePlan = vi.fn();
    render(
      <ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} onShapePlan={onShapePlan} />,
    );
    fireEvent.click(screen.getByTestId("build-my-mix"));
    expect(onShapePlan).toHaveBeenCalledWith(null);
    expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
  });
});

describe("ProtectionNotConnected — values identity vs plan composition", () => {
  beforeEach(() => {
    navState.pendingIntent = null;
    mockState.financialStrategy = null;
    mockState.valuesPhilosophy = null;
    mockState.customPlan = null;
  });

  it("a committed Custom mix keeps its named values as shell pattern and ring badge", () => {
    mockState.financialStrategy = "custom";
    mockState.valuesPhilosophy = "buen_vivir";
    mockState.customPlan = {
      from: "buen_vivir",
      rules: {},
      slices: [
        { exposure: "USD", target: 60 },
        { exposure: "XAU", target: 40 },
      ],
    };
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(
      document.querySelector(".shields-pattern--buen_vivir"),
    ).not.toBeNull();
    expect(document.querySelector(".shields-pattern--custom")).toBeNull();
    const badge = screen.getByTestId("plan-badge");
    expect(badge.textContent).toContain("Custom · Buen Vivir values");
    expect(badge).toHaveStyle("border-color: #0d9488");
  });

  it("a standalone Custom mix is quiet — no pattern, neutral badge, no custom violet", () => {
    mockState.financialStrategy = "custom";
    mockState.valuesPhilosophy = null;
    mockState.customPlan = {
      from: null,
      rules: {},
      slices: [
        { exposure: "USD", target: 60 },
        { exposure: "XAU", target: 40 },
      ],
    };
    render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
    expect(document.querySelector(".shields-pattern-layer")).toBeNull();
    const badge = screen.getByTestId("plan-badge");
    expect(badge.textContent).toContain("Custom");
    expect(badge.textContent).not.toContain("values");
    expect(badge).toHaveStyle("border-color: #64748b");
  });

  it("planless picker with nothing focused: the ghost ring names no plan", () => {
    render(
      <ProtectionNotConnected
        experienceMode="simple"
        sleeveOpen
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );
    expect(screen.queryByText("Africapitalism")).not.toBeInTheDocument();
    expect(document.querySelector(".shields-pattern-layer")).toBeNull();
  });

  it("a focused coin preview recolors only the ring — the shell stays quiet until commit", () => {
    const { rerender } = render(
      <ProtectionNotConnected
        experienceMode="simple"
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("coin-buen_vivir"));
    rerender(
      <ProtectionNotConnected
        experienceMode="simple"
        sleeveOpen
        onOpenSleeve={vi.fn()}
        onCloseSleeve={vi.fn()}
      />,
    );
    expect(
      screen
        .getAllByText("Buen Vivir")
        .some((el) => el.style.borderColor === "rgb(13, 148, 136)"),
    ).toBe(true);
    expect(document.querySelector(".shields-pattern-layer")).toBeNull();
    expect(mockState.setFinancialStrategy).not.toHaveBeenCalled();
  });

  it("Caribbean values surface the honesty banner even while the plan is Custom", () => {
    mockState.financialStrategy = "custom";
    mockState.valuesPhilosophy = "pan_caribbean";
    mockState.userRegion = "Caribbean";
    try {
      mockState.customPlan = {
        from: "pan_caribbean",
        rules: {},
        slices: [
          { exposure: "USD", target: 60 },
          { exposure: "XAU", target: 40 },
        ],
      };
      render(<ProtectionNotConnected experienceMode="simple" onEnableDemo={vi.fn()} />);
      expect(screen.getByTestId("caribbean-banner")).toBeInTheDocument();
    } finally {
      mockState.userRegion = null;
    }
  });
});

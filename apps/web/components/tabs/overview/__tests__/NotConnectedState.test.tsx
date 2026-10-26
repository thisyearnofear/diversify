import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The moment hook drives which object renders — mock it with overridable
// state so every branch (moment / inflation / detecting / detection-failed)
// is testable in isolation.
const hookState = vi.hoisted(() => ({
  moment: { currencyCode: "NGN", benchmark: "XAU" } as Record<string, unknown> | null,
  inflationMoment: null as Record<string, unknown> | null,
  isLoading: false,
  countryCode: null as string | null,
  countryIsDefault: false,
  onChangeCountry: vi.fn(),
}));

vi.mock("@/hooks/use-currency-moment", () => ({
  useCurrencyMoment: () => {
    const [inspectedCurrency, setInspectedCurrency] = React.useState<string | null>(null);
    return ({
    inspectedCurrency,
    setInspectedCurrency,
    moment: hookState.moment,
    inflationMoment: hookState.inflationMoment,
    isLoading: hookState.isLoading,
    countryCode: hookState.countryCode,
    countryIsDefault: hookState.countryIsDefault,
    benchmarks: [],
    horizons: [],
    setBenchmark: vi.fn(),
    setHorizon: vi.fn(),
    setSavingsAmount: vi.fn(),
    onChangeCountry: hookState.onChangeCountry,
    frame: null,
  }); },
}));

vi.mock("@/components/tabs/overview/CurrencyMomentCard", () => ({
  CurrencyMomentCard: ({
    rememberVisit,
    countryIsDefault,
    onInspectCurrency,
    currencySelected,
    onProtect,
    protectLabel,
  }: {
    rememberVisit?: boolean;
    countryIsDefault?: boolean;
    onInspectCurrency?: () => void;
    currencySelected?: boolean;
    onProtect?: () => void;
    protectLabel?: string;
  }) => (
    <div
      data-testid="moment-card"
      data-remember-visit={String(rememberVisit)}
      data-country-is-default={String(countryIsDefault)}
    >
      {onInspectCurrency ? (
        <button
          type="button"
          aria-label="Story of the currency"
          aria-pressed={currencySelected}
          onClick={onInspectCurrency}
        >
          Story
        </button>
      ) : null}
      {onProtect ? (
        <button type="button" onClick={onProtect}>
          {protectLabel ?? "Protect"}
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("@/components/tabs/overview/CurrencyStoryInspector", async () => {
  const { InspectorSheet } = await vi.importActual<typeof import("@/components/shared/InspectorSheet")>(
    "@/components/shared/InspectorSheet",
  );
  return {
    CurrencyStoryInspector: ({
      code,
      onClose,
      presentation,
    }: {
      code: string | null;
      onClose: () => void;
      presentation?: "sheet" | "stage";
    }) => (
      <InspectorSheet
        selectedId={code}
        onClose={onClose}
        title={code ?? "Currency"}
        presentation={presentation}
      >
        <p data-testid="story-body">story for {code}</p>
      </InspectorSheet>
    ),
  };
});
vi.mock("@/components/tabs/overview/InflationMomentCard", () => ({
  InflationMomentCard: ({
    onProtect,
    protectLabel,
  }: {
    onProtect?: () => void;
    protectLabel?: string;
  }) => (
    <div data-testid="inflation-card">
      {onProtect ? (
        <button type="button" onClick={onProtect}>
          {protectLabel ?? "Protect"}
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("@/components/wallet/WalletButton", () => ({
  default: ({ variant }: { variant?: string }) => (
    <button type="button" data-variant={variant}>Connect wallet</button>
  ),
}));

const mockTrack = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackFunnelEvent: mockTrack }));

const navState = {
  navigateWithIntent: vi.fn(),
};
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => navState,
  useNavigationOptional: () => navState,
}));
vi.mock("@/components/shared/TabComponents", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { NotConnectedState } from "../NotConnectedState";
import { CountryPicker } from "../CountryPicker";

describe("NotConnectedState — Home's unconnected morph", () => {
  beforeEach(() => {
    hookState.moment = { currencyCode: "NGN", benchmark: "XAU" };
    hookState.inflationMoment = null;
    hookState.isLoading = false;
    hookState.countryCode = null;
    hookState.countryIsDefault = false;
    hookState.onChangeCountry.mockReset();
    navState.navigateWithIntent.mockReset();
  });

  it("keeps the moment card as the object with the connect CTA attached", () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    // The Risk Theater object renders walletless — it is geo data, not
    // wallet data.
    expect(screen.getByTestId("moment-card")).toBeInTheDocument();
    // One CTA, attached to the object — no card wrapper, no second button.
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toHaveAttribute("data-variant", "minimal");
  });

  it("the moment's one primary explores a plan for its currency — carrying the walletless compare intent", () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    const cta = screen.getByRole("button", { name: "Explore plans from this reading" });
    fireEvent.click(cta);
    expect(navState.navigateWithIntent).toHaveBeenCalledWith("protect", {
      source: "home",
      lens: "compare",
      currencyCode: "NGN",
      example: false,
    });
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toHaveAttribute("data-variant", "minimal");
  });

  it("a default/shared currency is handed off as an example, never the visitor's own reading", () => {
    hookState.countryIsDefault = true;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Explore plans from this reading" }));
    expect(navState.navigateWithIntent).toHaveBeenCalledWith("protect", {
      source: "home",
      lens: "compare",
      currencyCode: "NGN",
      example: true,
    });
  });

  it("inflation-only fallback offers generic plan exploration — no invented currency", () => {
    hookState.moment = null;
    hookState.inflationMoment = { currencyCode: "NGN" };
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Explore protection plans" }));
    expect(navState.navigateWithIntent).toHaveBeenCalledWith("protect", {
      source: "home",
      lens: "compare",
    });
  });

  it("with no moment at all, connect stays the one primary affordance", () => {
    hookState.moment = null;
    hookState.isLoading = false;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toHaveAttribute("data-variant", "primary");
  });

  it("drops the marketing stack — no how-it-works, no proof card", () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    expect(screen.queryByText("How It Works")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Connect a wallet to protect what matters/),
    ).not.toBeInTheDocument();
  });

  it("keeps demo as a quiet status-tier line — no generic Verified on Home", () => {
    const onEnableDemo = vi.fn();
    render(<NotConnectedState onEnableDemo={onEnableDemo} />);

    expect(screen.queryByText(/Verified|Evidence mirrored/i)).not.toBeInTheDocument();
    // Demo entry is a text link, not a competing button strip.
    fireEvent.click(
      screen.getByRole("button", { name: "Explore a sample plan" }),
    );
    expect(onEnableDemo).toHaveBeenCalledTimes(1);
  });

  it("renders a quiet detecting state while geo resolves — never a premature failure", () => {
    hookState.moment = null;
    hookState.isLoading = true;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    expect(screen.getByText(/Detecting your region/i)).toBeInTheDocument();
    // Not a dead end, not a lie: no "could not detect" while still loading.
    expect(
      screen.queryByText(/could not detect/i),
    ).not.toBeInTheDocument();
  });

  it("when detection fails, the fallback card carries the country picker — the instruction and the affordance travel together", () => {
    hookState.moment = null;
    hookState.isLoading = false;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    // Honest copy + a working control (§5: selection rewrites the artefact).
    expect(screen.getByText(/could not detect your country/i)).toBeInTheDocument();
    const trigger = screen.getByRole('button', {
      name: /Change the country where your savings live/,
    });
    expect(trigger).toBeInTheDocument();
    // Placeholder state — no country silently pre-selected, no native select.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a country…')).toBeInTheDocument();
  });

  it("forwards isActive to the moment card's visit memory", () => {
    const { rerender } = render(
      <NotConnectedState isActive={false} onEnableDemo={vi.fn()} />,
    );
    expect(screen.getByTestId("moment-card")).toHaveAttribute(
      "data-remember-visit",
      "false",
    );
    rerender(<NotConnectedState isActive={true} onEnableDemo={vi.fn()} />);
    expect(screen.getByTestId("moment-card")).toHaveAttribute(
      "data-remember-visit",
      "true",
    );
  });

  it("geo failed → the moment object still renders as a display-only default and stays out of visit memory", () => {
    hookState.moment = { currencyCode: "NGN", benchmark: "USD" };
    hookState.countryIsDefault = true;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    const card = screen.getByTestId("moment-card");
    // The object stays alive — the card renders instead of a picker-only
    // dead end — but the default is honest: flagged as default and kept
    // out of visit memory (default views never read or write memory).
    expect(card).toHaveAttribute("data-country-is-default", "true");
    expect(card).toHaveAttribute("data-remember-visit", "false");
  });

  it("picking a country from the fallback re-points the moment (judge path: geo blocked → still lands on their currency)", () => {
    hookState.moment = null;
    hookState.isLoading = false;
    render(<NotConnectedState onEnableDemo={vi.fn()} />);

    const trigger = screen.getByRole('button', {
      name: /Change the country where your savings live/,
    });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Where is your money?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Jamaica \(JMD\)/ }));
    expect(hookState.onChangeCountry).toHaveBeenCalledWith("JM");
  });

  it("opens the currency story as an inline stage — comparison stays mounted but unreachable and the wallet CTA is not a rival", async () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);
    const comparison = screen.getByTestId("home-comparison");
    const storyButton = screen.getByRole("button", { name: "Story of the currency" });
    storyButton.focus();
    fireEvent.click(storyButton);

    const sheet = await screen.findByTestId("inspector-sheet");
    expect(sheet).toHaveAttribute("data-selected-id", "NGN");
    expect(comparison).toHaveAttribute("hidden");
    expect(
      screen.queryByRole("button", { name: "Connect wallet" }),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".instrument-inspector")).toBeNull();
    expect(
      sheet.closest(".instrument-shell")?.querySelector(".instrument-object")
        ?.contains(sheet),
    ).toBe(true);
  });

  it("closing the stage restores the same mounted comparison and the single CTA", async () => {
    render(<NotConnectedState onEnableDemo={vi.fn()} />);
    const comparison = screen.getByTestId("home-comparison");
    const storyButton = screen.getByRole("button", { name: "Story of the currency" });
    storyButton.focus();
    fireEvent.click(storyButton);
    await screen.findByTestId("inspector-sheet");

    fireEvent.keyDown(document.body, { key: "Escape" });
    await vi.waitFor(() =>
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("home-comparison")).toBe(comparison);
    expect(comparison).not.toHaveAttribute("hidden");
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("moment-card")).toHaveAttribute(
      "data-remember-visit",
      "true",
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(storyButton));
  });

  it("tracks currency_story_opened once per actual open — never on mount, rerender, or close", async () => {
    mockTrack.mockClear();
    const opened = () =>
      mockTrack.mock.calls.filter(([name]) => name === "currency_story_opened");
    const { rerender } = render(
      <React.StrictMode>
        <NotConnectedState onEnableDemo={vi.fn()} />
      </React.StrictMode>,
    );
    rerender(
      <React.StrictMode>
        <NotConnectedState onEnableDemo={vi.fn()} />
      </React.StrictMode>,
    );
    expect(opened()).toHaveLength(0);

    const storyButton = screen.getByRole("button", { name: "Story of the currency" });
    fireEvent.click(storyButton);
    await screen.findByTestId("inspector-sheet");
    expect(opened()).toEqual([
      ["currency_story_opened", { currency: "NGN", source: "home_walletless" }],
    ]);

    fireEvent.keyDown(document.body, { key: "Escape" });
    await vi.waitFor(() =>
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
    );
    expect(opened()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Story of the currency" }));
    await screen.findByTestId("inspector-sheet");
    expect(opened()).toHaveLength(2);
  });
});

describe("CountryPicker — no-country placeholder state", () => {
  it("renders the full country directory in the shared sheet behind a placeholder when no country is known", () => {
    render(
      <CountryPicker
        currentCountryCode=""
        currentCountryName=""
        onChange={vi.fn()}
      />,
    );
    // Trigger names the placeholder; the list lives behind the dialog.
    expect(screen.getByText("Choose a country…")).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: /Change the country where your savings live/,
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Where is your money?' })).toBeInTheDocument();
    // Curated corridors present (Caribbean + Africa + benchmarks).
    expect(
      screen.getByRole("button", { name: /Jamaica \(JMD\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Barbados \(BBD\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ghana \(GHS\)/ }),
    ).toBeInTheDocument();
    // The directory is the full ISO list, not only curated corridors —
    // a country with no researched history still appears, honestly
    // labeled by name alone (no invented currency code).
    expect(
      screen.getByRole("button", { name: "Afghanistan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\d+ countries · detection is location, risk is personal/),
    ).toBeInTheDocument();
  });

  it("fires onChange only for a real selection — dismissing without choosing is inert", async () => {
    const onChange = vi.fn();
    render(
      <CountryPicker
        currentCountryCode=""
        currentCountryName=""
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Change the country where your savings live/,
      }),
    );
    // Dismiss via the close button without choosing anything.
    fireEvent.click(screen.getByRole('button', { name: 'Close country picker' }));
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
    // A real row commits its ISO2 and closes the sheet.
    fireEvent.click(
      screen.getByRole('button', {
        name: /Change the country where your savings live/,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Jamaica \(JMD\)/ }));
    expect(onChange).toHaveBeenCalledWith("JM");
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
  });
});

/**
 * HomeRiskTheater — Home's Tier-1 marquee, coin motif restored.
 *
 * The coin stage (CurrencyMomentCard) is the one expressive object.
 * Holdings are a quiet coin row beneath it (HomeHoldingsStrip) — one coin
 * per region, sized by share — never a second ring. This keeps Home (coins)
 * distinct from Shield (AllocationRing + ghost/hatch) and Exchange (ticket)
 * per design-language §5.
 *
 * Selection dims the other coins and opens the region inspector; the
 * coin stage itself never swaps out. The strip is 0px when there are
 * no holdings.
 *
 * Home's `Verify` band does swap it out — for HomeLedgerStage, the same
 * grid reading the ledger instead of the currency — and keeps the strip
 * mounted.
 */

import React from "react";
import { CurrencyMomentCard } from "./CurrencyMomentCard";
import { HomeHoldingsStrip } from "./HomeHoldingsStrip";
import { InflationMomentCard } from "./InflationMomentCard";
import type { NarrativeMoment, InflationMoment } from "@/lib/narrative/currency-moment";
import type { MomentFrame } from "@/lib/narrative/moment-framing";

interface HomeRiskTheaterProps {
  moment: NarrativeMoment | null;
  inflationMoment: InflationMoment | null;
  onAmountChange: (amount: number) => void;
  /** The one action. Omitted while a region selection owns inspection. */
  onProtect?: () => void;
  /** Philosophy-aware label for the protect CTA; defaults to "Protect this". */
  protectLabel?: string;
  onChangeCountry?: (code: string) => void;
  frame: MomentFrame | null;
  /** Tap the stage's local coin → open the currency story inspector. */
  onInspectCurrency?: () => void;
  /** The currency story sheet is open — the coin rests on its back. */
  currencySelected?: boolean;
  /** A shared-card view (?currency=) — shows the in-object return line. */
  viewingShared?: boolean;
  onClearSharedView?: () => void;
  // Holdings context — quiet strip, not a hero swap
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  focusedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  isDemo?: boolean;
  isActive?: boolean;
  /** Region whose destination token a settled swap landed in — the coin
   *  wears a seal until the user selects a coin. */
  sealedRegion?: string | null;
  inspection?: React.ReactNode;
}

export function HomeRiskTheater({
  moment,
  inflationMoment,
  onAmountChange,
  onProtect,
  protectLabel,
  onChangeCountry,
  frame,
  onInspectCurrency,
  currencySelected = false,
  viewingShared = false,
  onClearSharedView,
  regionData,
  totalValue,
  focusedRegion,
  onSelectRegion,
  isDemo,
  isActive = true,
  sealedRegion = null,
  inspection,
}: HomeRiskTheaterProps) {
  const hasHoldings = totalValue > 0 && regionData.length > 0;

  const holdingsStrip = (
    <HomeHoldingsStrip
      regionData={regionData}
      totalValue={totalValue}
      focusedRegion={focusedRegion}
      onSelectRegion={onSelectRegion}
      isDemo={isDemo}
      sealedRegion={sealedRegion}
    />
  );

  const inspecting = focusedRegion !== null || currencySelected;

  // Concentration lens — the same coins, staged larger, with the fact as
  // the headline. Entered through the transition slot, left via the
  // in-object ←. Same selection/dim/seal/inspector behaviour as the strip.
  if (moment) {
    return (
      <section id="home-hero" aria-labelledby="home-hero-title" data-testid="home-risk-theater">
        <h2 id="home-hero-title" className="sr-only">Your currency this year</h2>
        {isDemo && !hasHoldings && (
          <p className="text-2xs text-gray-400 dark:text-gray-500 mb-1">Sample data</p>
        )}
        <div className="relative">
        <div hidden={inspecting} data-testid="home-comparison">
          <CurrencyMomentCard
            moment={moment}
            onAmountChange={onAmountChange}
            onProtect={onProtect}
            protectLabel={protectLabel}
            onChangeCountry={onChangeCountry}
            frame={frame}
            onInspectCurrency={onInspectCurrency}
            currencySelected={currencySelected}
            viewingShared={viewingShared}
            onClearSharedView={onClearSharedView}
            rememberVisit={isActive && !isDemo && !viewingShared}
            liveAlive={isActive && focusedRegion === null}
          />
        </div>
        {inspection}
        </div>
        {holdingsStrip}
      </section>
    );
  }

  if (inflationMoment) {
    return (
      <section id="home-hero" aria-labelledby="home-hero-title" data-testid="home-risk-theater">
        <h2 id="home-hero-title" className="sr-only">Your currency this year</h2>
        <div className="relative">
        <div hidden={inspecting} data-testid="home-comparison">
          <InflationMomentCard
            moment={inflationMoment}
            onAmountChange={onAmountChange}
            onChangeCountry={onChangeCountry}
            onProtect={onProtect}
            protectLabel={protectLabel}
          />
        </div>
        {inspection}
        </div>
        {holdingsStrip}
      </section>
    );
  }

  return null;
}

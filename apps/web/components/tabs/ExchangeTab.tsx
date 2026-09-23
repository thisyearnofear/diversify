import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import SwapTab from "./SwapTab";
import { useNavigation } from "@/context/app/NavigationContext";
import { usePortfolio } from "@/context/app/PortfolioContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useDemoMode } from "@/context/app/DemoModeContext";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useStrategy } from "@/context/app/StrategyContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { FxNettingRail } from "@/components/business/FxNettingRail";
import { corridorSideFor } from "@/lib/corridor-context";
import { pairCardContent } from "@/lib/pair-card";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import RouteSchematic from "../swap/RouteSchematic";
import {
  CorridorDetail,
  leadForStrategy,
  type ProvenanceLead,
} from "../swap/CorridorContext";
import { UnconnectedStatusTier } from "../shared/UnconnectedStatusTier";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { useCapitalHistory } from "@/hooks/use-capital-history";
import { explorerTxUrl } from "@/lib/explorer-url";
import type { CapitalHistory } from "@diversifi/shared/src/services/capital-history";

/** What the inspector is bound to: a selected pair (route + corridor +
 *  the netting rail prefilled from the pair's fiat legs), the netting
 *  rail alone when the user came to match currencies directly, or the
 *  wallet's capital journey (settled legs, read from the chain). */
type InspectorSel =
  | { kind: "pair"; fromToken: string; toToken: string }
  | { kind: "netting" }
  | { kind: "journey" }
  | null;

function fmtAmount(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The journey inspector body — settled legs, newest first, each linked
 *  to the explorer. Amounts are settled on-chain, so no "at quote". */
function JourneyBody({
  history,
  readOnly = false,
}: {
  history: CapitalHistory | null;
  readOnly?: boolean;
}) {
  const legs = history?.legs ?? [];
  return (
    <div data-testid="journey-inspector">
      {legs.length === 0 ? (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          No swaps between currencies found in this history.
        </p>
      ) : (
        <ul className="space-y-2">
          {legs.map((leg) => (
            <li
              key={leg.txHash}
              className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300"
            >
              <span className="tabular-nums">
                {fmtDay(leg.at)} · {fmtAmount(leg.amountIn)} {leg.from} →{" "}
                {fmtAmount(leg.amountOut)} {leg.to}
              </span>
              <a
                href={explorerTxUrl(42220, leg.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-600 hover:underline dark:text-blue-400"
              >
                View ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        Read from Celo via Blockscout · as of{" "}
        {history ? new Date(history.asOf).toLocaleString("en-US") : "—"}
        {history && !history.complete
          ? " · Showing your most recent transfers"
          : ""}
        {readOnly ? " · read-only view of a public address" : ""}
      </p>
    </div>
  );
}

/** The pair is public knowledge — shareable via a card whose numbers
 *  are derived from the symbols alone. Receipts and journeys are
 *  personal and never get this affordance. */
function PairShareLine({ from, to }: { from: string; to: string }) {
  const [copied, setCopied] = useState(false);
  const content = pairCardContent(from, to);
  if (!content) return null;

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pair/${content.from}/${content.to}`;
  const headline = content.headline;
  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: headline, url });
        return;
      } catch {
        return; // dismissed sheet — nothing to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — quiet no-op
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="mt-2 min-h-11 px-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {copied ? "Link copied" : "Share this pair ↗"}
    </button>
  );
}

/** The pair inspector — route schematic plus the corridor context: what
 *  these two currencies are and how they've treated each other. The
 *  netting rail rides here too: counterparty matching is a settlement
 *  option of the selected pair, not a separate surface. */
function PairInspector({
  selection,
  userRegion,
  onClose,
  lead,
  journey,
  journeyReadOnly = false,
}: {
  selection: InspectorSel;
  userRegion: Region;
  onClose: () => void;
  lead: ProvenanceLead;
  journey: CapitalHistory | null;
  /** Walletless public-address lookup — labelled, never held-marked. */
  journeyReadOnly?: boolean;
}) {
  const pair = selection?.kind === "pair" ? selection : null;
  const isJourney = selection?.kind === "journey";
  // The pair's fiat legs prefill the intent form when they exist —
  // USDm→KESm becomes USD→KES. Tokens without a fiat mirror leave the
  // rail on its own defaults.
  const sellCode = pair ? corridorSideFor(pair.fromToken)?.code : undefined;
  const buyCode = pair ? corridorSideFor(pair.toToken)?.code : undefined;

  return (
    <InspectorSheet
      selectedId={
        selection?.kind === "pair"
          ? `${selection.fromToken}-${selection.toToken}`
          : selection?.kind === "netting"
            ? "netting"
            : selection?.kind === "journey"
              ? "journey"
              : null
      }
      onClose={onClose}
      title={
        pair
          ? "Route and settlement"
          : isJourney
            ? "Your capital's journey"
            : "Counterparty matching"
      }
    >
      {isJourney ? (
        <JourneyBody history={journey} readOnly={journeyReadOnly} />
      ) : null}
      {pair ? (
        <>
          <RouteSchematic
            fromToken={pair.fromToken}
            toToken={pair.toToken}
            caption={userRegion}
          />
          <CorridorDetail
            fromToken={pair.fromToken}
            toToken={pair.toToken}
            lead={lead}
          />
          <PairShareLine from={pair.fromToken} to={pair.toToken} />
        </>
      ) : null}
      {!isJourney && (
      <FxNettingRail
        initialSell={sellCode}
        initialBuy={buyCode}
        leadIn={
          pair
            ? "This pair can also settle peer-to-peer — match a counterparty at mid-market instead of taking the DEX route."
            : undefined
        }
      />
      )}
    </InspectorSheet>
  );
}

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
  portfolio?: MultichainPortfolio;
}

export default function ExchangeTab({
  userRegion,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
  portfolio,
}: ExchangeTabProps) {
  const { address } = useWalletContext();
  const { enableDemoMode } = useDemoMode();
  const router = useRouter();
  const { setSwapPrefill, swapPrefill, nettingRequested, consumeNettingRequest } = useNavigation();
  const { financialStrategy } = useStrategy();
  const { config } = useProtectionProfile();
  const sharedPortfolio = usePortfolio();
  const previousAddress = useRef(address);
  const [inspectorSel, setInspectorSel] = useState<InspectorSel>(null);
  // Walletless public-address lookup — never persisted, cleared the
  // moment a wallet connects.
  const [lookupAddress, setLookupAddress] = useState<string | null>(null);
  // One fetch per address — the journey rail reads it and a settled
  // receipt triggers refresh(20000) because the indexer lags.
  const capitalHistory = useCapitalHistory(address ?? lookupAddress);

  useEffect(() => {
    if (previousAddress.current !== address) {
      setInspectorSel(null);
      if (address) setLookupAddress(null);
      previousAddress.current = address;
    }
  }, [address]);

  // Persona morph (§5 rail 4): pan-Caribbean / upcoming-payment users
  // open with the counterparty rail already unfolded — netting IS their
  // exchange. The ticket remains the object underneath; a swap prefill
  // always wins.
  const nettingPersona =
    (financialStrategy === "pan_caribbean" || config.moneyPurpose === "upcoming_payment") &&
    !swapPrefill;
  const personaOpenedRef = useRef(false);
  useEffect(() => {
    if (nettingPersona && !personaOpenedRef.current) {
      personaOpenedRef.current = true;
      setInspectorSel({ kind: "netting" });
    }
  }, [nettingPersona]);

  // Chat deep-link hand-off: navigateToNetting() lands here — unfold the
  // netting rail once, then clear the transient flag.
  useEffect(() => {
    if (!nettingRequested) return;
    consumeNettingRequest();
    setInspectorSel((sel) => (sel?.kind === "netting" ? sel : { kind: "netting" }));
  }, [nettingRequested, consumeNettingRequest]);

  useEffect(() => {
    if (!router.isReady) return;
    const { from, to, amount, reason, netting } = router.query;
    if (netting === "1" || netting === "true") {
      setInspectorSel({ kind: "netting" });
    }
    if (from || to || amount) {
      setSwapPrefill({
        fromToken: from as string | undefined,
        toToken: to as string | undefined,
        amount: amount as string | undefined,
        reason: reason as string | undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const nettingButton = (
    <button
      type="button"
      onClick={() => setInspectorSel({ kind: "netting" })}
      className="min-h-11 px-3 py-1.5 -my-1.5 rounded-full text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
    >
      FX netting: match currencies directly →
    </button>
  );

  // Connected status rail — trust parity with Home and Shield (§7) plus
  // the netting hand-off. Walletless, UnconnectedStatusTier already owns
  // the Verified line, so it gets the button alone — never doubled.
  const nettingLink = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <VerifiedEvidence />
      {nettingButton}
    </div>
  );

  if (!address) {
    // Unconnected morph (§5): the ticket stays the object — SwapTab
    // renders it walletless and its execute CTA becomes the connect button.
    // No hero card, no proof card, no how-it-works stack: trust is one
    // quiet line, demo entry is a text link, and the FX netting hand-off
    // sits beside them (the rail works walletless in observer mode).
    return (
      <InstrumentShell
        object={
          <div data-testid="exchange-swap-object" className="w-full">
            <SwapTab
              userRegion={userRegion}
              inflationData={inflationData}
              instrument
              onInspectQuote={(fromToken, toToken) =>
                setInspectorSel({ kind: "pair", fromToken, toToken })
              }
              quoteInspected={inspectorSel?.kind === "pair"}
              capitalHistory={capitalHistory}
              onInspectJourney={() => setInspectorSel({ kind: "journey" })}
              lookupAddress={lookupAddress}
              onLookupAddress={setLookupAddress}
            />
          </div>
        }
        inspector={
          <PairInspector
            selection={inspectorSel}
            userRegion={userRegion}
            onClose={() => setInspectorSel(null)}
            lead={leadForStrategy(financialStrategy)}
            journey={capitalHistory.data}
            journeyReadOnly={Boolean(lookupAddress)}
          />
        }
        status={
          <UnconnectedStatusTier onEnableDemo={enableDemoMode}>
            {nettingButton}
          </UnconnectedStatusTier>
        }
      />
    );
  }

  const freshnessPortfolio = portfolio ?? sharedPortfolio;
  const freshness = freshnessPortfolio
    ? {
        ...freshnessPortfolio,
        isLoading: freshnessPortfolio.isLoading || Boolean(isBalancesLoading),
      }
    : undefined;

  return (
    <InstrumentShell
      object={
        <div data-testid="exchange-swap-object" className="w-full">
          <SwapTab
            userRegion={userRegion}
            inflationData={inflationData}
            refreshBalances={refreshBalances}
            refreshChainId={refreshChainId}
            isBalancesLoading={isBalancesLoading}
            instrument
            onInspectQuote={(fromToken, toToken) =>
              setInspectorSel({ kind: "pair", fromToken, toToken })
            }
            quoteInspected={inspectorSel?.kind === "pair"}
            capitalHistory={capitalHistory}
            onInspectJourney={() => setInspectorSel({ kind: "journey" })}
          />
        </div>
      }
      inspector={
        <PairInspector
          selection={inspectorSel}
          userRegion={userRegion}
          onClose={() => setInspectorSel(null)}
          lead={leadForStrategy(financialStrategy)}
          journey={capitalHistory.data}
        />
      }
      portfolio={freshness}
      onRefresh={refreshBalances}
      // The netting rail is reachable from the connected ticket too —
      // it lives inside the pair inspector, not behind an object flip.
      status={nettingLink}
    />
  );
}

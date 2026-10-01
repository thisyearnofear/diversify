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
import { corridorFor, corridorSideFor } from "@/lib/corridor-context";
import { pairCardContent } from "@/lib/pair-card";
import { stampsForPair } from "@/lib/stamps";
import StampSheet from "../swap/StampSheet";
import { provenanceFor } from "@diversifi/shared/src/constants/token-provenance";
import { useAdvisor } from "@/hooks/use-advisor";
import { trackFunnelEvent } from "@/lib/analytics";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import RouteSchematic from "../swap/RouteSchematic";
import {
  CorridorDetail,
  leadForStrategy,
  type ProvenanceLead,
} from "../swap/CorridorContext";
import { UnconnectedStatusTier } from "../shared/UnconnectedStatusTier";
import { useCorridorSignals } from "@/hooks/use-corridor-signals";
import { useLensOffered } from "@/hooks/use-lens-offered";
import { StatusTier } from "../shared/StatusTier";
import { VerifiedEvidence } from "../shared/VerifiedEvidence";
import { useCapitalHistory } from "@/hooks/use-capital-history";
import { explorerTxUrl } from "@/lib/explorer-url";
import { useArcArrival } from "@/hooks/use-arc-arrival";
import { ArcArrivalBody, ArcArrivalPrompt } from "../swap/ArcArrival";
import type { CapitalHistory } from "@diversifi/shared/src/services/capital-history";

/** What the inspector is bound to: a selected pair (route + corridor +
 *  the netting rail prefilled from the pair's fiat legs), the netting
 *  rail alone when the user came to match currencies directly, or the
 *  wallet's capital journey (settled legs, read from the chain). */
type InspectorSel =
  | { kind: "pair"; fromToken: string; toToken: string; view?: "story" | "route" }
  | { kind: "netting" }
  | { kind: "journey" }
  | { kind: "arc" }
  | { kind: "stamps"; fromToken: string; toToken: string }
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

/** The journey inspector body — settled moves, newest first. A tx that
 *  sent one currency and received another reads as a swap and links to
 *  its /receipt page; a bare one-sided move is labeled a transfer. Both
 *  link the chain they settled on — never a Celo URL for an Arb tx. */
function JourneyBody({
  history,
  readOnly = false,
}: {
  history: CapitalHistory | null;
  readOnly?: boolean;
}) {
  const legs = history?.legs ?? [];
  // `chains` names every chain actually read — absent on older shapes.
  const chains = history?.chains ?? [history?.chainId ?? 42220];
  const chainsLabel = chains
    .map((id) => (id === 42161 ? "Arbitrum" : id === 42220 ? "Celo" : `chain ${id}`))
    .join(" + ");
  return (
    <div data-testid="journey-inspector">
      {legs.length === 0 ? (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          No swaps between currencies found in this history.
        </p>
      ) : (
        <ul className="space-y-2">
          {legs.map((leg) => {
            const kind = leg.kind ?? "swap";
            const legChain = leg.chainId ?? 42220;
            const text =
              kind === "swap"
                ? `${fmtDay(leg.at)} · ${fmtAmount(leg.amountIn)} ${leg.from} → ${fmtAmount(leg.amountOut)} ${leg.to}`
                : kind === "sent"
                  ? `${fmtDay(leg.at)} · Sent ${fmtAmount(leg.amountIn)} ${leg.from}`
                  : `${fmtDay(leg.at)} · Received ${fmtAmount(leg.amountOut)} ${leg.to}`;
            return (
              <li
                key={`${legChain}:${leg.txHash}`}
                className="flex items-center justify-between gap-3 text-xs text-gray-700 dark:text-gray-300"
              >
                <span className="tabular-nums">{text}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/receipt/${legChain}/${leg.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {kind === "swap" ? "receipt →" : "transfer →"}
                  </a>
                  <a
                    href={explorerTxUrl(legChain, leg.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View ↗
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-2xs text-gray-400 dark:text-gray-500">
        Read from {chainsLabel} via Blockscout · as of{" "}
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
    trackFunnelEvent("share_open", { source: "pair_card" });
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
      className="mt-2 min-h-11 px-1 text-2xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {copied ? "Link copied" : "Share this pair ↗"}
    </button>
  );
}

/** The pair is public knowledge — the question travels as two symbols
 *  and the server grounds the answer in the same curated registry the
 *  screen renders. Journeys and receipts never get this affordance. */
function PairAskLine({
  from,
  to,
  onClose,
}: {
  from: string;
  to: string;
  onClose: () => void;
}) {
  const { askAdvisor } = useAdvisor();
  if (!corridorFor(from, to) && !provenanceFor(from) && !provenanceFor(to)) {
    return null;
  }

  const ask = () => {
    onClose();
    askAdvisor(
      `Tell me the story of ${from} → ${to}: what has happened between these currencies, who controls each token, and what should I watch?`,
      { pair: { from, to } },
    );
  };

  return (
    <button
      type="button"
      onClick={ask}
      className="mt-2 min-h-11 px-1 text-2xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      Ask Guardian about this pair →
    </button>
  );
}

/** The pair inspector is a single workbench with mutually exclusive
 *  Story, Route, and Match views. Journey and standalone netting remain
 *  separate selections because they answer different questions. */
function PairInspector({
  selection,
  userRegion,
  onClose,
  lead,
  journey,
  journeyReadOnly = false,
  onStampWatch,
}: {
  selection: InspectorSel;
  userRegion: Region;
  onClose: () => void;
  lead: ProvenanceLead;
  journey: CapitalHistory | null;
  /** Walletless public-address lookup — labelled, never held-marked. */
  journeyReadOnly?: boolean;
  onStampWatch?: (fromToken: string, toToken: string) => void;
}) {
  const pair = selection?.kind === "pair" ? selection : null;
  const isJourney = selection?.kind === "journey";
  // The pair's fiat legs prefill the intent form when they exist —
  // USDm→KESm becomes USD→KES. Tokens without a fiat mirror leave the
  // rail on its own defaults.
  const sellCode = pair ? corridorSideFor(pair.fromToken)?.code : undefined;
  const buyCode = pair ? corridorSideFor(pair.toToken)?.code : undefined;
  const [pairView, setPairView] = useState<"story" | "route" | "match">(
    pair?.view ?? "story",
  );
  useEffect(() => {
    setPairView(pair?.view ?? "story");
  }, [pair?.fromToken, pair?.toToken, pair?.view]);

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
          <div
            role="group"
            aria-label="Pair detail"
            className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800"
          >
            {(["story", "route", "match"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={pairView === v}
                onClick={() => setPairView(v)}
                className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                  pairView === v
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {v === "story" ? "Story" : v === "route" ? "Route" : "Match"}
              </button>
            ))}
          </div>
          {pairView === "story" ? (
            <>
              <CorridorDetail
                fromToken={pair.fromToken}
                toToken={pair.toToken}
                lead={lead}
              />
              <PairShareLine from={pair.fromToken} to={pair.toToken} />
              {onStampWatch && stampsForPair(pair.fromToken, pair.toToken).length > 0 && (
                // Stamps — seal what you're watching onto a postcard. Same
                // quiet line grammar as Share/Ask; absent when the pair has
                // no facts to stamp.
                <button
                  type="button"
                  data-testid="stamp-watching"
                  onClick={() => onStampWatch(pair.fromToken, pair.toToken)}
                  className="mt-2 min-h-11 px-1 text-2xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Stamp what you&rsquo;re watching ✦
                </button>
              )}
              <PairAskLine
                from={pair.fromToken}
                to={pair.toToken}
                onClose={onClose}
              />
            </>
          ) : pairView === "route" ? (
            <RouteSchematic
              fromToken={pair.fromToken}
              toToken={pair.toToken}
              caption={userRegion}
            />
          ) : (
            <FxNettingRail
              initialSell={sellCode}
              initialBuy={buyCode}
              leadIn="Match this pair directly with another currency need."
            />
          )}
        </>
      ) : null}
      {selection?.kind === "netting" && <FxNettingRail />}
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
  const { demoMode, enableDemoMode, disableDemoMode } = useDemoMode();
  const router = useRouter();
  const { setSwapPrefill, swapPrefill, pendingIntent, consumeIntent } = useNavigation();
  const { financialStrategy } = useStrategy();
  const { config } = useProtectionProfile();
  const sharedPortfolio = usePortfolio();
  const previousAddress = useRef(address);
  const [inspectorSel, setInspectorSel] = useState<InspectorSel>(null);
  // The live pair rides up from the swap object so the status tier can
  // offer the decision-window lens (fresh dated macro beats only —
  // never a forward calendar).
  const [pair, setPair] = useState<{ from: string; to: string } | null>(null);
  const [decisionWindow, setDecisionWindow] = useState(false);
  const pairSignals = useCorridorSignals(pair?.from ?? "", pair?.to ?? "");
  const freshSignal = pair
    ? pairSignals.from && pairSignals.to
      ? pairSignals.from.timestamp >= pairSignals.to.timestamp
        ? pairSignals.from
        : pairSignals.to
      : pairSignals.from ?? pairSignals.to
    : null;
  const hasFreshSignal = Boolean(freshSignal);
  // Offered = the prompt actually occupies the transition slot (both
  // connected and walletless surfaces), never in demo.
  useLensOffered(
    "exchange",
    "decision_window",
    hasFreshSignal && !decisionWindow && !demoMode.isActive,
  );
  useEffect(() => {
    setDecisionWindow(false);
  }, [pair?.from, pair?.to]);
  useEffect(() => {
    if (!hasFreshSignal) setDecisionWindow(false);
  }, [hasFreshSignal]);
  // Walletless public-address lookup — never persisted, cleared the
  // moment a wallet connects.
  const [lookupAddress, setLookupAddress] = useState<string | null>(null);
  // One fetch per address — the journey rail reads it and a settled
  // receipt triggers refresh(20000) because the indexer lags.
  const capitalHistory = useCapitalHistory(address ?? lookupAddress);
  // Arc arrival: USDC on Arc → CCTP → the user's wallet on Arbitrum. Only
  // offered when there's real USDC on Arc (or a transfer in flight).
  const arcArrival = useArcArrival({
    onArrived: () => {
      void refreshBalances?.();
      capitalHistory.refresh(20000);
    },
  });

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

  // Cross-tab intent (e.g. navigateToNetting from chat or Home): unfold
  // the netting rail once, then consume — an exchange intent never goes
  // stale.
  useEffect(() => {
    if (pendingIntent?.tab !== "exchange") return;
    if (pendingIntent.intent.lens === "netting") {
      trackFunnelEvent("intent_handoff", {
        source: pendingIntent.intent.source,
        target: "exchange",
        outcome: "netting",
      });
      setInspectorSel((sel) => (sel?.kind === "netting" ? sel : { kind: "netting" }));
    }
    consumeIntent();
  }, [pendingIntent, consumeIntent]);

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

  // Decision-window prompt — same quiet link grammar as the netting
  // button. While it's offered it owns the transition slot and netting
  // drops to the rail; nothing stacks.
  const decisionPrompt = freshSignal ? (
    <button
      type="button"
      data-testid="decision-window-prompt"
      onClick={() => {
        setDecisionWindow(true);
        if (!demoMode.isActive) {
          trackFunnelEvent("lens_open", {
            tab: "exchange",
            lens: "decision_window",
          });
        }
      }}
      className="min-h-11 px-3 py-1.5 -my-1.5 rounded-full text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
    >
      New on this pair · {freshSignal.dateLabel} — open the decision window →
    </button>
  ) : null;

  // Connected status rail — trust parity with Home and Shield (§7) plus
  // the netting hand-off. Walletless, UnconnectedStatusTier already owns
  // the Verified line, so it gets the button alone — never doubled.
  if (!address) {
    // Unconnected morph (§5): the ticket stays the object — SwapTab
    // renders it walletless and its execute CTA becomes the connect button.
    // No hero card, no proof card, no how-it-works stack: trust is one
    // quiet line, demo entry is a text link, and the FX netting hand-off
    // sits beside them (the rail works walletless in observer mode).
    return (
      <InstrumentShell
        inspectorOpen={Boolean(inspectorSel)}
        object={
          <div data-testid="exchange-swap-object" className="w-full">
            <SwapTab
              userRegion={userRegion}
              inflationData={inflationData}
              instrument
              onInspectQuote={(fromToken, toToken, view) =>
                setInspectorSel({ kind: "pair", fromToken, toToken, view })
              }
              quoteInspected={inspectorSel?.kind === "pair"}
              capitalHistory={capitalHistory}
              onInspectJourney={() => setInspectorSel({ kind: "journey" })}
              lookupAddress={lookupAddress}
              onLookupAddress={setLookupAddress}
              onPairChange={(from, to) => setPair({ from, to })}
              decisionWindow={decisionWindow}
              onExitDecisionWindow={() => setDecisionWindow(false)}
            />
          </div>
        }
        inspector={
          inspectorSel?.kind === "stamps" ? (
            <StampSheet
              fromToken={inspectorSel.fromToken}
              toToken={inspectorSel.toToken}
              mode="watching"
              entry="inspector"
              open
              onClose={() => setInspectorSel(null)}
            />
          ) : (
            <PairInspector
              selection={inspectorSel}
              userRegion={userRegion}
              onClose={() => setInspectorSel(null)}
              lead={leadForStrategy(financialStrategy)}
              journey={capitalHistory.data}
              journeyReadOnly={Boolean(lookupAddress)}
              onStampWatch={(f, t) =>
                setInspectorSel({ kind: "stamps", fromToken: f, toToken: t })
              }
            />
          )
        }
        status={
          <UnconnectedStatusTier
            onEnableDemo={enableDemoMode}
            demoActive={demoMode.isActive}
            onDisableDemo={disableDemoMode}
          >
            {hasFreshSignal && !decisionWindow ? decisionPrompt : nettingButton}
          </UnconnectedStatusTier>
        }
      />
    );
  }

  // Arc arrival owns the transition slot while it's offered; whatever held
  // it drops to the rail — one prompt, one rail, nothing stacks.
  const arcPrompt = arcArrival.offered ? (
    <ArcArrivalPrompt arrival={arcArrival} onOpen={() => setInspectorSel({ kind: "arc" })} />
  ) : null;
  const defaultTransition = hasFreshSignal && !decisionWindow ? decisionPrompt : nettingButton;
  const defaultRail = hasFreshSignal && !decisionWindow ? nettingButton : undefined;

  const freshnessPortfolio = portfolio ?? sharedPortfolio;
  const freshness = freshnessPortfolio
    ? {
        ...freshnessPortfolio,
        isLoading: freshnessPortfolio.isLoading || Boolean(isBalancesLoading),
      }
    : undefined;

  return (
    <InstrumentShell
      inspectorOpen={Boolean(inspectorSel)}
      object={
        <div data-testid="exchange-swap-object" className="w-full">
          <SwapTab
            userRegion={userRegion}
            inflationData={inflationData}
            refreshBalances={refreshBalances}
            refreshChainId={refreshChainId}
            isBalancesLoading={isBalancesLoading}
            instrument
            onInspectQuote={(fromToken, toToken, view) =>
              setInspectorSel({ kind: "pair", fromToken, toToken, view })
            }
            quoteInspected={inspectorSel?.kind === "pair"}
            capitalHistory={capitalHistory}
            onInspectJourney={() => setInspectorSel({ kind: "journey" })}
            onPairChange={(from, to) => setPair({ from, to })}
            decisionWindow={decisionWindow}
            onExitDecisionWindow={() => setDecisionWindow(false)}
          />
        </div>
      }
      inspector={
        inspectorSel?.kind === "arc" ? (
          <InspectorSheet
            selectedId="arc"
            onClose={() => setInspectorSel(null)}
            title="Bring USDC from Arc"
          >
            <ArcArrivalBody
              arrival={arcArrival}
              onDone={() => {
                arcArrival.dismiss();
                setInspectorSel(null);
              }}
              onProtect={(amount) => {
                // Arrived USDC → the ticket, prefilled on Arbitrum. The
                // amount forces the ticket (stage never swallows a prefill).
                setSwapPrefill({
                  fromToken: "USDC",
                  toToken: "PAXG",
                  amount,
                  fromChainId: 42161,
                  toChainId: 42161,
                });
                arcArrival.dismiss();
                setInspectorSel(null);
              }}
            />
          </InspectorSheet>
        ) : inspectorSel?.kind === "stamps" ? (
          <StampSheet
            fromToken={inspectorSel.fromToken}
            toToken={inspectorSel.toToken}
            mode="watching"
            entry="inspector"
            open
            onClose={() => setInspectorSel(null)}
          />
        ) : (
          <PairInspector
            selection={inspectorSel}
            userRegion={userRegion}
            onClose={() => setInspectorSel(null)}
            lead={leadForStrategy(financialStrategy)}
            journey={capitalHistory.data}
            onStampWatch={(f, t) =>
              setInspectorSel({ kind: "stamps", fromToken: f, toToken: t })
            }
          />
        )
      }
      portfolio={freshness}
      onRefresh={refreshBalances}
      // The netting rail is reachable from the connected ticket too —
      // it lives inside the pair inspector, not behind an object flip.
      // While a fresh beat offers the decision window it owns the
      // transition slot and netting drops to the rail — nothing stacks.
      status={
        <StatusTier
          trust={<VerifiedEvidence />}
          transition={arcPrompt ?? defaultTransition}
          rail={arcPrompt ? defaultTransition : defaultRail}
        />
      }
    />
  );
}

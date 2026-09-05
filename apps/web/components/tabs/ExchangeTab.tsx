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
import { CaribbeanFxNetCard } from "@/components/business/CaribbeanFxNetCard";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import RouteSchematic from "../swap/RouteSchematic";
import { UnconnectedStatusTier } from "../shared/UnconnectedStatusTier";

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
  const { setSwapPrefill, swapPrefill } = useNavigation();
  const { financialStrategy } = useStrategy();
  const { config } = useProtectionProfile();
  const sharedPortfolio = usePortfolio();
  const previousAddress = useRef(address);
  const [inspectedPair, setInspectedPair] = useState<{
    fromToken: string;
    toToken: string;
  } | null>(null);

  useEffect(() => {
    if (previousAddress.current !== address) {
      setInspectedPair(null);
      previousAddress.current = address;
    }
  }, [address]);

  const morphNetting =
    (financialStrategy === "pan_caribbean" || config.moneyPurpose === "upcoming_payment") &&
    !swapPrefill;

  // The FX netting card is the Future Caribbean track's core artifact. The
  // persona morph (§5 rail 4) decides the DEFAULT object: pan-Caribbean /
  // upcoming-payment users — connected or not — open on the netting card;
  // everyone else opens on the swap ticket and can flip to netting via the
  // status-rail link. A swap prefill always wins (Swaps from Shield open
  // the ticket), matching the original morphNetting contract.
  const [nettingOverride, setNettingOverride] = useState<boolean | null>(null);
  const nettingActive = nettingOverride ?? morphNetting;

  useEffect(() => {
    if (!router.isReady) return;
    const { from, to, amount, reason } = router.query;
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

  if (nettingActive) {
    return (
      <InstrumentShell
        object={<div data-testid="exchange-netting"><CaribbeanFxNetCard /></div>}
        status={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Match a currency need with a counterparty — netted and settled on-chain, no USD bridge.
            </p>
            <button
              type="button"
              onClick={() => setNettingOverride(false)}
              className="min-h-11 px-3 py-1.5 -my-1.5 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60"
            >
              Swap ticket →
            </button>
          </div>
        }
      />
    );
  }

  const nettingLink = (
    <button
      type="button"
      onClick={() => setNettingOverride(true)}
      className="min-h-11 px-3 py-1.5 -my-1.5 rounded-full text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
    >
      FX netting: match currencies directly →
    </button>
  );

  if (!address) {
    // Unconnected morph (§5): the ticket is still the object — SwapTab
    // renders it walletless and its execute CTA becomes the connect button.
    // No hero card, no proof card, no how-it-works stack: trust is one
    // quiet line, demo entry is a text link, and the FX netting hand-off
    // sits beside them (the card works walletless in observer mode).
    return (
      <InstrumentShell
        object={
          <div data-testid="exchange-swap-object" className="w-full">
            <SwapTab
              userRegion={userRegion}
              inflationData={inflationData}
              instrument
            />
          </div>
        }
        status={
          <UnconnectedStatusTier onEnableDemo={enableDemoMode}>
            {nettingLink}
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
              setInspectedPair({ fromToken, toToken })
            }
            quoteInspected={Boolean(inspectedPair)}
          />
        </div>
      }
      inspector={
        <InspectorSheet
          selectedId={inspectedPair ? `${inspectedPair.fromToken}-${inspectedPair.toToken}` : null}
          onClose={() => setInspectedPair(null)}
          title="Route and settlement"
        >
          {inspectedPair ? (
            <RouteSchematic
              fromToken={inspectedPair.fromToken}
              toToken={inspectedPair.toToken}
              caption={userRegion}
            />
          ) : null}
        </InspectorSheet>
      }
      portfolio={freshness}
      onRefresh={refreshBalances}
      // Non-Caribbean personas reach the netting card from the connected
      // ticket too — the object switch rides in the status rail.
      status={nettingLink}
    />
  );
}

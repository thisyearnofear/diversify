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

  if (!address) {
    // Unconnected morph (§5): the ticket is still the object — SwapTab
    // renders it walletless and its execute CTA becomes the connect button.
    // No hero card, no proof card, no how-it-works stack: trust is one
    // quiet line and demo entry is a text link in the status tier.
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
        status={<UnconnectedStatusTier onEnableDemo={enableDemoMode} />}
      />
    );
  }

  if (morphNetting) {
    return (
      <InstrumentShell
        object={<div data-testid="exchange-netting"><CaribbeanFxNetCard /></div>}
        status={<p className="text-xs text-gray-500 dark:text-gray-400">Token swaps from Shield still open the ticket when you review a move.</p>}
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
    />
  );
}

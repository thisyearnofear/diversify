import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import SwapTab from "./SwapTab";
import { useNavigation } from "@/context/app/NavigationContext";
import { usePortfolio } from "@/context/app/PortfolioContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useDemoMode } from "@/context/app/DemoModeContext";
import WalletButton from "../wallet/WalletButton";
import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useStrategy } from "@/context/app/StrategyContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { CaribbeanFxNetCard } from "@/components/business/CaribbeanFxNetCard";
import { InstrumentShell } from "../shared/InstrumentShell";
import { InspectorSheet } from "../shared/InspectorSheet";
import { DataFreshnessIndicator } from "../shared/DataFreshnessIndicator";

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
  portfolio?: MultichainPortfolio;
}

const HOW_IT_WORKS: HowItWorksStep[] = [
  { icon: "💱", title: "Compare Rates", text: "See live exchange rates across supported stablecoins and networks." },
  { icon: "🛡️", title: "Choose Safer Assets", text: "Pick currencies with lower inflation rates than your local currency." },
  { icon: "✅", title: "Execute the Swap", text: "Connect your wallet and confirm the swap in one transaction." },
];

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
  const [focusedSwap, setFocusedSwap] = useState(false);

  useEffect(() => {
    if (previousAddress.current !== address) {
      setFocusedSwap(false);
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
    const heroCard = (
      <div className="text-gray-900 dark:text-white">
        <h2 className="text-lg font-black">Protect your savings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-md leading-relaxed">
          Use stablecoin swaps to reduce inflation exposure and move toward your protection plan.
        </p>
        <div className="mt-4"><WalletButton variant="primary" className="w-full" /></div>
      </div>
    );
    return (
      <UnconnectedStateShell
        heroCard={heroCard}
        showProofCard={true}
        showDemoCta={true}
        onEnableDemo={enableDemoMode}
        howItWorks={HOW_IT_WORKS}
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
          />
          <button
            type="button"
            onClick={() => setFocusedSwap(true)}
            className="mt-2 min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Inspect route and settlement
          </button>
        </div>
      }
      inspector={
        <InspectorSheet
          selectedId={focusedSwap ? "swap" : null}
          onClose={() => setFocusedSwap(false)}
          title="Swap details"
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Review the selected pair, available balance, route, and settlement chain before confirming.
          </p>
        </InspectorSheet>
      }
      status={(portfolio ?? sharedPortfolio) ? (
        <DataFreshnessIndicator
          lastUpdated={(portfolio ?? sharedPortfolio)!.lastUpdated}
          isStale={(portfolio ?? sharedPortfolio)!.isStale}
          hasEstimates={(portfolio ?? sharedPortfolio)!.hasEstimates}
          isLoading={(portfolio ?? sharedPortfolio)!.isLoading || Boolean(isBalancesLoading)}
          error={(portfolio ?? sharedPortfolio)!.errors?.[0] ?? null}
          onRefresh={refreshBalances}
        />
      ) : undefined}
    />
  );
}

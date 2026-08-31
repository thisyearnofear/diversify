import React, { useEffect } from "react";
import { useRouter } from "next/router";
import SwapTab from "./SwapTab";
import { useNavigation } from "@/context/app/NavigationContext";
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

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
  portfolio?: MultichainPortfolio;
}

const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    icon: "💱",
    title: "Compare Rates",
    text: "See live exchange rates across supported stablecoins and networks.",
  },
  {
    icon: "🛡️",
    title: "Choose Safer Assets",
    text: "Pick currencies with lower inflation rates than your local currency.",
  },
  {
    icon: "✅",
    title: "Execute the Swap",
    text: "Connect your wallet and confirm the swap in one transaction.",
  },
];

export default function ExchangeTab({
  userRegion,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
}: ExchangeTabProps) {
  const { address } = useWalletContext();
  const { enableDemoMode } = useDemoMode();
  const router = useRouter();
  const { setSwapPrefill, swapPrefill } = useNavigation();
  const { financialStrategy } = useStrategy();
  const { config } = useProtectionProfile();

  const morphNetting =
    (financialStrategy === "pan_caribbean" ||
      config.moneyPurpose === "upcoming_payment") &&
    !swapPrefill;

  useEffect(() => {
    if (!router.isReady) return;
    const params = router.query;
    const from = params.from as string | undefined;
    const to = params.to as string | undefined;
    const amount = params.amount as string | undefined;
    const reason = params.reason as string | undefined;

    if (from || to || amount) {
      setSwapPrefill({
        fromToken: from || undefined,
        toToken: to || undefined,
        amount: amount || undefined,
        reason: reason || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  if (!address) {
    const heroCard = (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-white">
          Protect your savings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-md leading-relaxed">
          Use stablecoin swaps to reduce inflation exposure and move toward your
          protection plan.
        </p>
        <div className="mt-4">
          <WalletButton variant="primary" className="w-full" />
        </div>
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
        object={
          <div data-testid="exchange-netting">
            <CaribbeanFxNetCard />
          </div>
        }
        status={
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Token swaps from Shield still open the ticket when you review a move.
          </p>
        }
      />
    );
  }

  return (
    <InstrumentShell
      object={
        <SwapTab
          userRegion={userRegion}
          inflationData={inflationData}
          refreshBalances={refreshBalances}
          refreshChainId={refreshChainId}
          isBalancesLoading={isBalancesLoading}
        />
      }
    />
  );
}

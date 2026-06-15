import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import SwapTab from "./SwapTab";
import BitsoJunoCard from "../agent/BitsoJunoCard";
import { useNavigation } from "@/context/app/NavigationContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useDemoMode } from "@/context/app/DemoModeContext";
import WalletButton from "../wallet/WalletButton";
import { Section } from "../shared/TabComponents";
import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
  portfolio?: MultichainPortfolio;
}

const STORAGE_KEY = "exchangeMode";

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
  portfolio,
}: ExchangeTabProps) {
  const { address } = useWalletContext();
  const { experienceMode } = useExperience();
  const { enableDemoMode } = useDemoMode();
  const isBeginner = experienceMode === "beginner";

  const router = useRouter();
  const { setSwapPrefill, navigateToSwap } = useNavigation();

  const prepareMxnbSwap = () => {
    const amount = portfolio?.totalValue
      ? Math.max(10, Math.min(250, portfolio.totalValue * 0.2)).toFixed(2)
      : "100.00";

    navigateToSwap({
      fromToken: "USDC",
      toToken: "MXNB",
      amount,
      fromChainId: 42161,
      toChainId: 42161,
      reason: "Bitso/Juno MXNB hedge: Mexican peso exposure on Arbitrum with Juno support for balances, SPEI issuance, USD stablecoin conversion, and redemption.",
    });
  };

  // PERFORMANT: Deep linking — parse URL params once on mount to restore user intent
  // Supports: ?exchange=swap&from=USDm&to=KESm&amount=100
  useEffect(() => {
    if (!router.isReady) return;
    const params = router.query;

    // Prefill swap params for shareable links
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

  // ── Unconnected state (all hooks are declared before this return) ──
  if (!address) {
    const heroCard = (
      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-gray-900 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl p-5 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 shadow-sm">
              <span className="size-1.5 rounded-full bg-blue-500" />
              Protect Flow
            </div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Protect your savings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-md leading-relaxed">
              Use stablecoin swaps to reduce inflation exposure and move toward your protection plan.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 p-3 shadow-sm">
            <span className="text-xl" aria-hidden="true">🛡️</span>
          </div>
        </div>
        <div className="mt-4">
          <WalletButton variant="primary" className="w-full" />
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 text-center">
          🔒 Secure connection • No signup required • Free to use
        </p>
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

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-gray-900 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl p-5 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 shadow-sm">
              <span className="size-1.5 rounded-full bg-blue-500" />
              Protect Flow
            </div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">
              Protect your savings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-md leading-relaxed">
              Use stablecoin swaps to reduce inflation exposure and move toward your protection plan.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 p-3 shadow-sm">
            <span className="text-xl" aria-hidden="true">🛡️</span>
          </div>
        </div>
      </div>

      {isBeginner && (
        <Section>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Beginner mode keeps this flow focused on protection.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Advanced features stay hidden until you are ready for a more complex experience.
          </p>
        </Section>
      )}

      <SwapTab
        userRegion={userRegion}
        inflationData={inflationData}
        refreshBalances={refreshBalances}
        refreshChainId={refreshChainId}
        isBalancesLoading={isBalancesLoading}
      />

      <BitsoJunoCard
        walletConnected={!!address}
        onPrepareSwap={prepareMxnbSwap}
      />
    </div>
  );
}

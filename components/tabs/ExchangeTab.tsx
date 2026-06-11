import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import SwapTab from "./SwapTab";
import TradeTab from "./TradeTab";
import { useNavigation } from "@/context/app/NavigationContext";
import { useExperience } from "@/context/app/ExperienceContext";
import { useWalletContext } from "../wallet/WalletProvider";
import { useDemoMode } from "@/context/app/DemoModeContext";
import WalletButton from "../wallet/WalletButton";
import { UnconnectedStateShell } from "../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../shared/UnconnectedStateShell";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";

interface ExchangeTabProps {
  userRegion: Region;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
}

type ExchangeMode = "swap" | "trade";

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
}: ExchangeTabProps) {
  const { address } = useWalletContext();
  const { experienceMode } = useExperience();
  const { enableDemoMode } = useDemoMode();
  const isBeginner = experienceMode === "beginner";

  // ── Hooks before early return (React hooks rule: all hooks must be called
  //     unconditionally before any return) ──
  const [mode, setMode] = useState<ExchangeMode>(() => {
    if (typeof window === "undefined") return "swap";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "trade" ? "trade" : "swap";
  });

  const router = useRouter();
  const { setSwapPrefill } = useNavigation();

  // PERFORMANT: Deep linking — parse URL params once on mount to restore user intent
  // Supports: ?exchange=swap&from=USDm&to=KESm&amount=100
  useEffect(() => {
    if (!router.isReady) return;
    const params = router.query;

    // Restore mode from URL (overrides localStorage if present)
    const urlMode = params.exchange as string;
    if (urlMode === "swap" || (urlMode === "trade" && !isBeginner)) {
      setMode(urlMode);
    }

    // Prefill swap params for shareable links
    if (urlMode === "swap" || !urlMode) {
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, isBeginner]);

  useEffect(() => {
    if (isBeginner && mode !== "swap") {
      setMode("swap");
    }
  }, [isBeginner, mode]);

  // Persist mode selection across sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // ── Unconnected state (all hooks are declared before this return) ──
  if (!address) {
    const heroCard = (
      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-900/20 dark:via-gray-900 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl p-5 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 shadow-sm">
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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-900/80 border border-blue-100 dark:border-blue-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 shadow-sm">
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

      {isBeginner ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Beginner mode keeps this flow focused on protection.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Advanced markets stay hidden until you are ready for a more complex experience.
          </p>
        </div>
      ) : (
        <>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 shadow-inner">
            <button
              onClick={() => setMode("swap")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                mode === "swap"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Protect
              </span>
              <span className="block text-[10px] font-medium opacity-60 mt-0.5">Stablecoin swaps</span>
            </button>
            <button
              onClick={() => setMode("trade")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                mode === "trade"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Advanced
              </span>
              <span className="block text-[10px] font-medium opacity-60 mt-0.5">Stocks & commodities</span>
            </button>
          </div>

          {mode === "trade" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Advanced markets are separate from your core protection flow.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                DiversiFi&apos;s main job is protecting savings through stablecoin diversification. Use advanced markets only if you want extra complexity.
              </p>
            </div>
          )}
        </>
      )}

      {/* Mode Content */}
      <AnimatePresence mode="wait">
        {mode === "swap" ? (
          <motion.div
            key="swap"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <SwapTab
              userRegion={userRegion}
              inflationData={inflationData}
              refreshBalances={refreshBalances}
              refreshChainId={refreshChainId}
              isBalancesLoading={isBalancesLoading}
            />
          </motion.div>
        ) : (
          <motion.div
            key="trade"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <TradeTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from "react";
import type { Region } from "@/hooks/use-user-region";
import RegionalIconography from "../../regional/RegionalIconography";
import WalletButton from "../../wallet/WalletButton";
import { Card } from "../../shared/TabComponents";
import { UnconnectedStateShell } from "../../shared/UnconnectedStateShell";
import type { HowItWorksStep } from "../../shared/UnconnectedStateShell";

interface NotConnectedStateProps {
  userRegion: Region;
  regionalInflation: number;
  onEnableDemo: () => void;
}

export function NotConnectedState({
  userRegion,
  regionalInflation,
  onEnableDemo,
}: NotConnectedStateProps) {
  const [savingsAmount, setSavingsAmount] = useState(1000);
  const monthlyLoss = ((savingsAmount * (regionalInflation / 100)) / 12).toFixed(2);
  const yearlyLoss = (savingsAmount * (regionalInflation / 100)).toFixed(0);

  const HOW_IT_WORKS: HowItWorksStep[] = [
    {
      icon: "👛",
      title: "Connect in Seconds",
      text: "Link your wallet and see your starting point right away.",
    },
    {
      icon: "📊",
      title: "See Your Inflation Risk",
      text: "Understand how much local inflation is reducing your purchasing power.",
    },
    {
      icon: "🛡️",
      title: "Move Into Protection",
      text: "Follow a simple plan to spread savings across stronger stable currencies.",
    },
  ];

  // InlineOnboarding removed — consolidated into GuidedTour (Phase 3).
  // The tour now handles region/goal selection as an interactive step.

  // ── Calculator hero card ──
  const heroCard = (
    <Card
      padding="p-0"
      className="overflow-hidden border-2 border-emerald-200 dark:border-emerald-900"
    >
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🛡️</span>
              <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100">
                Protect Your Savings
              </h3>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              A calmer way to protect savings in {userRegion} (
              {regionalInflation.toFixed(1)}% inflation)
            </p>
          </div>
          <RegionalIconography region={userRegion} size="md" />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 border-2 border-emerald-100 dark:border-emerald-900">
          <div className="text-center mb-3">
            <label htmlFor="savings-input" className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-bold block">
              If you protect
            </label>
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-lg text-emerald-600 dark:text-emerald-400 font-bold">$</span>
              <input
                id="savings-input"
                type="number"
                min="0"
                max="10000000"
                value={savingsAmount}
                onChange={(e) => setSavingsAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-28 text-center text-2xl font-black text-emerald-900 dark:text-emerald-100 bg-transparent border-b-2 border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
            <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
              Save ${yearlyLoss}/year
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                Per month
              </div>
              <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                ${monthlyLoss}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                lost to inflation
              </div>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg border border-teal-100 dark:border-teal-800">
              <div className="text-xs text-teal-600 dark:text-teal-400 font-bold mb-1">
                Per year
              </div>
              <div className="text-xl font-black text-teal-900 dark:text-teal-100">
                ${yearlyLoss}
              </div>
              <div className="text-xs text-teal-600 dark:text-teal-400">
                protected value
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <WalletButton variant="primary" className="w-full" />
          <p className="text-center text-xs text-emerald-700 dark:text-emerald-300">
            Connect a wallet to personalize your protection, or try demo mode first.
          </p>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <UnconnectedStateShell
        heroCard={heroCard}
        howItWorks={HOW_IT_WORKS}
        onEnableDemo={onEnableDemo}
      />
    </div>
  );
}

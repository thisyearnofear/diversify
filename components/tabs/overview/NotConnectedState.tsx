import React from "react";
import type { Region } from "@/hooks/use-user-region";
import RegionalIconography from "../../regional/RegionalIconography";
import WalletButton from "../../wallet/WalletButton";
import { Card } from "../../shared/TabComponents";

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
  const monthlyLoss = ((1000 * (regionalInflation / 100)) / 12).toFixed(2);
  const yearlyLoss = (1000 * (regionalInflation / 100)).toFixed(0);

  const HOW_IT_WORKS = [
    {
      icon: "🌍",
      title: "Connect Your Wallet",
      text: "Link MetaMask, Coinbase, or any Web3 wallet in seconds.",
    },
    {
      icon: "📊",
      title: "See Your Exposure",
      text: "Instantly see how much inflation is eating your savings.",
    },
    {
      icon: "🛡️",
      title: "Diversify & Protect",
      text: "Swap into stable currencies across 5 global regions.",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Hope-first: show value before fear */}
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
                  Protect Your Savings from Inflation
                </h3>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Smart diversification for {userRegion} (
                {regionalInflation.toFixed(1)}% inflation)
              </p>
            </div>
            <RegionalIconography region={userRegion} size="md" />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 border-2 border-emerald-100 dark:border-emerald-900">
            <div className="text-center mb-3">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-bold">
                Protect $1,000 →
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
                  currently lost
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
                  you could save
                </div>
              </div>
            </div>
          </div>

          <WalletButton variant="primary" className="w-full" />
        </div>
      </Card>

      {/* Demo Mode CTA */}
      <Card padding="p-4" className="border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-gray-900 dark:text-white">
              🎮 Try Demo Mode
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Explore with sample data — no wallet needed
            </p>
          </div>
          <button
            onClick={onEnableDemo}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
          >
            Try Demo
          </button>
        </div>
      </Card>

      {/* How it works */}
      <Card padding="p-4">
        <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">
          How It Works
        </h3>
        <div className="space-y-3">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-base flex-shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-xs font-black text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

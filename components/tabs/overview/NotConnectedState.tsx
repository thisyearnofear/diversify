import React, { useState, useMemo } from "react";
import type { Region } from "@/hooks/use-user-region";
import { useCurrencyRisk } from "@/hooks/use-currency-risk";
import { useStrategy } from "@/context/app/StrategyContext";
import {
  BENCHMARKS,
  type Benchmark,
} from "@/constants/currency-risk";
import { ARCHETYPES, strategyToArchetype } from "@/components/protection-cards/tokens";
import RegionalIconography from "../../regional/RegionalIconography";
import { TokenIcon } from "../../shared/TokenIcon";
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
  const {
    riskData,
    getDepreciation,
    calculateCounterfactual,
  } = useCurrencyRisk();
  const { financialStrategy } = useStrategy();
  const archetypeId = strategyToArchetype(financialStrategy);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

  const [savingsAmount, setSavingsAmount] = useState(10000);
  const [shieldPercentage, setShieldPercentage] = useState(20);

  // Calculate counterfactual using gold benchmark (universal hedge)
  const totalPreserved = useMemo(() => {
    if (!riskData) return 0;
    return calculateCounterfactual(savingsAmount, shieldPercentage, 'XAU', '5yr');
  }, [riskData, savingsAmount, shieldPercentage, calculateCounterfactual]);

  const HOW_IT_WORKS: HowItWorksStep[] = [
    {
      icon: "📊",
      title: "See Your Currency Risk",
      text: "Understand how much your local currency has depreciated against global benchmarks.",
    },
    {
      icon: "🌍",
      title: "Choose Your Approach",
      text: "Pick a protection philosophy that matches your values — from Africapitalism to Islamic Finance.",
    },
    {
      icon: "🛡️",
      title: "Act on Your Terms",
      text: "No lock-ups. No subscriptions. Protect what matters, your way.",
    },
  ];

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
                Understand Your Risk
              </h3>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              {riskData
                ? `${riskData.flag} ${riskData.countryName} — ${riskData.code}`
                : `${userRegion} (${regionalInflation.toFixed(1)}% inflation)`}
            </p>
          </div>
          <RegionalIconography region={userRegion} size="md" />
        </div>

        {riskData ? (
          <>
            {/* Multi-benchmark depreciation */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 border-2 border-emerald-100 dark:border-emerald-900">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-3">
                {riskData.code} has lost value against:
              </p>
              <div className="space-y-2 mb-4">
                {(['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench) => {
                  const dep = getDepreciation(bench, '5yr');
                  const b = BENCHMARKS[bench];
                  // Skip 0% benchmarks (self-comparison, e.g., USD vs USD)
                  if (dep === 0) return null;
                  return (
                    <div key={bench} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {b.flag} {b.label}
                      </span>
                      <span className={`text-sm font-black ${Math.abs(dep) >= 25 ? 'text-red-500' : 'text-orange-500'}`}>
                        {dep.toFixed(0)}% (5yr)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Counterfactual calculator */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="text-center mb-3">
                  <label className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-bold block">
                    Your savings
                  </label>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <span className="text-lg text-emerald-600 dark:text-emerald-400 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      max="10000000"
                      value={savingsAmount}
                      onChange={(e) => setSavingsAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-28 text-center text-xl font-black text-emerald-900 dark:text-emerald-100 bg-transparent border-b-2 border-emerald-300 dark:border-emerald-700 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">If {shieldPercentage}% had been protected</label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={shieldPercentage}
                      onChange={(e) => setShieldPercentage(Number(e.target.value))}
                      className="w-20 accent-emerald-500"
                    />
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/40">
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-1">
                    You would have preserved
                  </p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">
                    ${totalPreserved.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-red-400 dark:text-red-500 mt-1">
                    over 5 years — that&apos;s ~${(totalPreserved / (365 * 5)).toFixed(1)}/day gone. Every day you wait.
                  </p>
                </div>
              </div>
            </div>

            {/* Philosophy-aware framing */}
            {archetype ? (
              <div
                className="rounded-xl p-3 mb-4 border"
                style={{
                  borderColor: `${archetype.accent}40`,
                  background: `${archetype.surface.start}15`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                    style={{ background: archetype.accent }}
                  >
                    {archetype.name[0]}
                  </div>
                  <p className="text-xs font-bold" style={{ color: archetype.accent }}>
                    Your philosophy: {archetype.name}
                  </p>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  {archetype.philosophy}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {archetype.allocation.map((asset, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: `${archetype.accentSoft}20`,
                        color: archetype.accent,
                      }}
                    >
                      <TokenIcon symbol={asset} size={11} />
                      {asset}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 mb-4 border border-emerald-100 dark:border-emerald-900/40">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                  Different communities respond differently
                </p>
                <p className="text-[11px] text-emerald-500 dark:text-emerald-300">
                  Choose a protection philosophy that matches your values — from Africapitalism to Islamic Finance.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Fallback: inflation-only calculator (for benchmark currencies) */
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4 border-2 border-emerald-100 dark:border-emerald-900">
            <div className="text-center mb-3">
              <label className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 font-bold block">
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
                Save ${(savingsAmount * regionalInflation / 100).toFixed(0)}/year
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                  Per month
                </div>
                <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                  ${((savingsAmount * regionalInflation / 100) / 12).toFixed(2)}
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
                  ${(savingsAmount * regionalInflation / 100).toFixed(0)}
                </div>
                <div className="text-xs text-teal-600 dark:text-teal-400">
                  protected value
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <WalletButton variant="primary" className="w-full" />
          <p className="text-center text-xs text-emerald-700 dark:text-emerald-300">
            Connect a wallet to choose your protection philosophy, or try demo mode first.
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

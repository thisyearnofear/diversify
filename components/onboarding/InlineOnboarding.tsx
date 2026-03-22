/**
 * InlineOnboarding — Compact 3-step onboarding for first-time users.
 * Shown at the top of Overview tab instead of StrategyModal.
 *
 * ENHANCEMENT FIRST: Reuses existing selection patterns from StrategyModal.
 * PERFORMANT: Dismissible, localStorage-tracked, minimal re-renders.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { REGIONS, type Region } from "@/hooks/use-user-region";
import { useWalletContext } from "@/components/wallet/WalletProvider";
import { useAnalytics } from "@/hooks/use-analytics";

const STORAGE_KEY = "inlineOnboardingDismissed";
const STEP_KEY = "inlineOnboardingStep";

const GOAL_OPTIONS = [
  { id: "inflation_protection", label: "Protect Savings", icon: "🛡️", desc: "Hedge against currency devaluation" },
  { id: "geographic_diversification", label: "Global Diversity", icon: "🌍", desc: "Spread wealth across economies" },
  { id: "rwa_access", label: "Real-World Assets", icon: "🥇", desc: "Access tokenized gold & yields" },
  { id: "exploring", label: "Just Exploring", icon: "🔍", desc: "See what DiversiFi can do" },
];

interface InlineOnboardingProps {
  onComplete: () => void;
}

export default function InlineOnboarding({ onComplete }: InlineOnboardingProps) {
  const { isConnected, connect } = useWalletContext();
  const { config, setMultipleConfig } = useProtectionProfile();
  const { trackOnboardingStep } = useAnalytics();

  const [step, setStep] = useState<"region" | "goal" | "cta">(() => {
    if (typeof window === "undefined") return "region";
    const saved = localStorage.getItem(STEP_KEY);
    return (saved as "region" | "goal" | "cta") || "region";
  });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(config.userRegion || null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(config.userGoal || null);

  // Persist step and track step views
  useEffect(() => {
    localStorage.setItem(STEP_KEY, step);
    trackOnboardingStep(step, 'view');
  }, [step, trackOnboardingStep]);

  const handleDismiss = () => {
    trackOnboardingStep(step, 'skip');
    localStorage.setItem(STORAGE_KEY, "1");
    onComplete();
  };

  const handleComplete = () => {
    trackOnboardingStep('cta', 'complete');
    setMultipleConfig({
      userRegion: selectedRegion as any,
      userGoal: selectedGoal as any,
    });
    handleDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white">
              Welcome to DiversiFi
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              3 quick steps to personalize your protection
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Progress dots */}
      <div className="px-4 flex gap-1.5 mb-3">
        {(["region", "goal", "cta"] as const).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              ["region", "goal", "cta"].indexOf(step) >= i ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === "region" && (
          <motion.div
            key="region"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 pb-4"
          >
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-3">
              Where are you based? (affects inflation data)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    selectedRegion === region
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg block">
                    {region === "Africa" ? "🌍" : region === "LatAm" ? "🌋" : region === "Asia" ? "⛩️" : region === "Europe" ? "🏰" : "🗽"}
                  </span>
                  <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 block mt-0.5">{region}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("goal")}
              disabled={!selectedRegion}
              className={`w-full mt-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                selectedRegion
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
            >
              Continue →
            </button>
          </motion.div>
        )}

        {step === "goal" && (
          <motion.div
            key="goal"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 pb-4"
          >
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-3">
              What's your primary goal?
            </p>
            <div className="space-y-2">
              {GOAL_OPTIONS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                    selectedGoal === goal.id
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{goal.icon}</span>
                  <div>
                    <div className="text-xs font-black text-gray-900 dark:text-white">{goal.label}</div>
                    <div className="text-[10px] text-gray-500">{goal.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setStep("region")}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep("cta")}
                disabled={!selectedGoal}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                  selectedGoal
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                Continue →
              </button>
            </div>
          </motion.div>
        )}

        {step === "cta" && (
          <motion.div
            key="cta"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-4 pb-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 mb-3 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {REGIONS.indexOf(selectedRegion as Region) >= 0
                    ? ["🌍", "🌋", "⛩️", "🏰", "🗽"][REGIONS.indexOf(selectedRegion as Region)]
                    : "🌍"}
                </span>
                <span className="text-xs font-black text-gray-900 dark:text-white">{selectedRegion}</span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-xs font-bold text-gray-500">
                  {GOAL_OPTIONS.find((g) => g.id === selectedGoal)?.icon} {GOAL_OPTIONS.find((g) => g.id === selectedGoal)?.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your experience will be tailored to {selectedRegion} inflation data with a focus on{" "}
                {GOAL_OPTIONS.find((g) => g.id === selectedGoal)?.label.toLowerCase()}.
              </p>
            </div>
            <div className="flex gap-2">
              {!isConnected ? (
                <>
                  <button
                    onClick={connect}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all"
                  >
                    🔗 Connect Wallet
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                  >
                    Explore Demo →
                  </button>
                </>
              ) : (
                <button
                  onClick={handleComplete}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all"
                >
                  Start Protecting →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
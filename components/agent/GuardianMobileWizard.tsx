/**
 * GuardianMobileWizard - Multi-step setup for Guardian vault
 *
 * Steps:
 * 1. Strategy selection (africapitalism, islamic, global, etc.)
 * 2. Set limits (daily budget, allowed tokens)
 * 3. Review & sign (EIP-712 permission)
 * 4. Deposit (show smart account address, copy)
 *
 * Follows Core Principles:
 *   - ENHANCEMENT FIRST: Enhances existing wizard, not a new component
 *   - CLEAN: Uses useVault + useSessionKey hooks (single source of truth)
 *   - ORGANIZED: Steps map to vault lifecycle
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";
import { LiveProofCard } from "../shared/LiveProofCard";

// ─── Types ─────────────────────────────────────────────────────────────────

type WizardStep = "strategy" | "limits" | "sign" | "deposit";

interface Strategy {
  id: string;
  name: string;
  icon: string;
  description: string;
  regions: string[];
}

const STRATEGIES: Strategy[] = [
  {
    id: "africapitalism",
    name: "Africapitalism",
    icon: "🌍",
    description: "Keep wealth in African economies. Prioritize KESm.",
    regions: ["KE", "US", "EU"],
  },
  {
    id: "islamic",
    name: "Islamic Finance",
    icon: "☪️",
    description: "Sharia-compliant. No interest-bearing assets.",
    regions: ["US", "EU", "KE"],
  },
  {
    id: "global",
    name: "Global Diversification",
    icon: "🌐",
    description: "Maximum geographic spread across all regions.",
    regions: ["US", "EU", "BR", "KE", "CO", "PH"],
  },
  {
    id: "buen-vivir",
    name: "Buen Vivir",
    icon: "🌎",
    description: "Balance material wealth with community well-being.",
    regions: ["BR", "CO", "US"],
  },
];

const TOKENS = [
  { symbol: "cUSD", region: "US" },
  { symbol: "cEUR", region: "EU" },
  { symbol: "KESm", region: "Kenya" },
  { symbol: "COPm", region: "Colombia" },
  { symbol: "PHPm", region: "Philippines" },
  { symbol: "cREAL", region: "Brazil" },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface GuardianMobileWizardProps {
  userAddress: string;
  vaultAddress?: string;
  onComplete: () => void;
  onCancel: () => void;
  onCreateVault: (strategy: string) => Promise<boolean>;
  onRequestPermission: (dailyLimit: number, tokens: string[]) => Promise<boolean>;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function GuardianMobileWizard({
  userAddress,
  vaultAddress,
  onComplete,
  onCancel,
  onCreateVault,
  onRequestPermission,
}: GuardianMobileWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("strategy");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("global");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [allowedTokens, setAllowedTokens] = useState<string[]>(["cUSD", "cEUR", "KESm"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMobile();

  const steps: WizardStep[] = ["strategy", "limits", "sign", "deposit"];
  const currentIndex = steps.indexOf(currentStep);

  const stepConfig: Record<WizardStep, { title: string; icon: string }> = {
    strategy: { title: "Pick Strategy", icon: "🎯" },
    limits: { title: "Set Limits", icon: "📊" },
    sign: { title: "Grant Permission", icon: "✍️" },
    deposit: { title: "Deposit", icon: "💰" },
  };

  const goNext = async () => {
    setError(null);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) {
      onComplete();
      return;
    }

    const nextStep = steps[nextIndex];

    // Create vault when moving from strategy → limits
    if (nextStep === "limits") {
      setLoading(true);
      const ok = await onCreateVault(selectedStrategy);
      setLoading(false);
      if (!ok) {
        setError("Failed to create vault");
        return;
      }
    }

    // Request permission when moving from sign → deposit
    if (nextStep === "deposit") {
      setLoading(true);
      const ok = await onRequestPermission(dailyLimit, allowedTokens);
      setLoading(false);
      if (!ok) {
        setError("Failed to grant permission");
        return;
      }
    }

    setCurrentStep(nextStep);
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    } else {
      onCancel();
    }
  };

  // ─── Step 1: Strategy ────────────────────────────────────────────────

  const StrategyStep = () => (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose Your Strategy</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          This shapes how the Guardian diversifies your stablecoins
        </p>
      </div>

      {STRATEGIES.map((s) => (
        <button
          key={s.id}
          onClick={() => setSelectedStrategy(s.id)}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selectedStrategy === s.id
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1">
              <div className="font-bold text-gray-900 dark:text-white">{s.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.description}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {s.regions.map((r) => (
                  <span key={r} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            {selectedStrategy === s.id && (
              <span className="text-purple-600 text-lg">✓</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  // ─── Step 2: Limits ──────────────────────────────────────────────────

  const LimitsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Set Your Limits</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          How much can the Guardian trade per day?
        </p>
      </div>

      <div>
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Daily Budget (USD)</label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-gray-500 text-lg">$</span>
          <input
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Math.max(1, Number(e.target.value)))}
            className="flex-1 px-3 py-3 min-h-[48px] border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-lg font-bold"
            inputMode="decimal"
            min={1}
            max={10000}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Maximum the Guardian can swap in 24 hours</p>
      </div>

      <div>
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Allowed Tokens</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TOKENS.map((t) => (
            <button
              key={t.symbol}
              onClick={() => {
                setAllowedTokens((prev) =>
                  prev.includes(t.symbol)
                    ? prev.filter((s) => s !== t.symbol)
                    : [...prev, t.symbol]
                );
              }}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-bold transition-all ${
                allowedTokens.includes(t.symbol)
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {t.symbol}
              <span className="text-xs opacity-70 ml-1">({t.region})</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Only these tokens can be swapped by the Guardian
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500 space-y-1">
          <div>Permission valid for 7 days</div>
          <div>Can be revoked anytime from the Guardian card</div>
        </div>
      </div>
    </div>
  );

  // ─── Step 3: Sign ────────────────────────────────────────────────────

  const SignStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review & Sign</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          You'll sign a permission in your wallet
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Strategy</span>
          <span className="font-bold text-gray-900 dark:text-white capitalize">{selectedStrategy}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Daily Limit</span>
          <span className="font-bold text-gray-900 dark:text-white">${dailyLimit}/day</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Allowed Tokens</span>
          <span className="font-bold text-gray-900 dark:text-white">{allowedTokens.join(", ")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Valid For</span>
          <span className="font-bold text-gray-900 dark:text-white">7 days</span>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <div className="flex gap-2">
          <span>⚠️</span>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            The Guardian can swap your stablecoins within these limits. Your funds stay in your
            smart account — the Guardian cannot withdraw. You can revoke anytime.
          </p>
        </div>
      </div>
    </div>
  );

  // ─── Step 4: Deposit ─────────────────────────────────────────────────

  const DepositStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <motion.span
          className="text-5xl inline-block"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
        >
          🎉
        </motion.span>
        <motion.h3
          className="text-lg font-bold mt-2 text-gray-900 dark:text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Guardian Active
        </motion.h3>
        <motion.p
          className="text-sm text-gray-500 dark:text-gray-400 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Send stablecoins to your smart account to start diversifying
        </motion.p>
      </div>

      {vaultAddress && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-2">Your Smart Account (Celo)</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white break-all">
              {vaultAddress}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(vaultAddress)}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
        <div className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-1">What happens next</div>
        <ul className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
          <li>1. Send cUSD, cEUR, KESm, etc. to the address above</li>
          <li>2. The Guardian monitors inflation rates 24/7</li>
          <li>3. When conditions change, it rebalances automatically</li>
          <li>4. You can withdraw anytime — fees settled at withdrawal</li>
        </ul>
      </div>

      {/* Trust surface right before the user signs the EIP-712 permission:
          show them what other Guardian actions have been verified on-chain. */}
      <LiveProofCard />

      <div className="text-center">
        <div className="text-xs text-gray-400">
          Fees: 1% annual management + 10% performance above high-water mark + 0.10% swap spread
        </div>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case "strategy": return <StrategyStep />;
      case "limits": return <LimitsStep />;
      case "sign": return <SignStep />;
      case "deposit": return <DepositStep />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={goBack}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h2 className="font-bold text-gray-900 dark:text-white">Enable Guardian</h2>
        <button
          onClick={onCancel}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 p-4">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                idx === currentIndex
                  ? "bg-purple-600 text-white scale-110"
                  : idx < currentIndex
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              }`}
            >
              {idx < currentIndex ? "✓" : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-8 h-1 mx-1 rounded transition-all ${
                  idx < currentIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="p-4 border-t border-gray-200 dark:border-gray-700"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        <button
          onClick={currentStep === "deposit" ? onComplete : goNext}
          disabled={loading}
          className="w-full py-4 min-h-[56px] bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span>Processing...</span>
          ) : currentStep === "sign" ? (
            <>
              <span>✍️</span>
              <span>Sign Permission</span>
            </>
          ) : currentStep === "deposit" ? (
            <span>Done — Open Dashboard</span>
          ) : (
            <>
              <span>Continue</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default GuardianMobileWizard;

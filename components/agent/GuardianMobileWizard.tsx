/**
 * GuardianMobileWizard - 3-step mobile wizard for Guardian setup
 * Optimized for mobile with step-by-step flow:
 * 1. Set limits
 * 2. Review permissions  
 * 3. Confirm signature
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";

interface GuardianMobileWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = "limits" | "permissions" | "confirm";

const stepConfig: Record<WizardStep, { title: string; icon: string; description: string }> = {
  limits: {
    title: "Set Limits",
    icon: "📊",
    description: "Define your trading limits and thresholds",
  },
  permissions: {
    title: "Review Permissions",
    icon: "🔐",
    description: "Authorize the Guardian to act on your behalf",
  },
  confirm: {
    title: "Confirm Signature",
    icon: "✍️",
    description: "Sign to activate your Guardian",
  },
};

export function GuardianMobileWizard({ onComplete, onCancel }: GuardianMobileWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("limits");
  const [limits, setLimits] = useState({
    dailyLimit: 1000,
    perTransactionLimit: 500,
    allowedAssets: ["USDC", "EURC", "USDm"] as string[],
  });
  const [permissions, setPermissions] = useState({
    autoSwap: true,
    autoRebalance: false,
    emergencyPause: true,
  });
  const isMobile = useMobile();

  const steps: WizardStep[] = ["limits", "permissions", "confirm"];
  const currentIndex = steps.indexOf(currentStep);

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      onComplete();
    }
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    } else {
      onCancel();
    }
  };

  // Step indicator dots
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              idx === currentIndex
                ? "bg-blue-600 text-white scale-110"
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
  );

  // Step 1: Limits
  const LimitsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <span className="text-4xl">📊</span>
        <h3 className="text-lg font-bold mt-2 text-gray-900 dark:text-white">Set Your Limits</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Define how much the Guardian can trade on your behalf
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Daily Trading Limit
          </label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              value={limits.dailyLimit}
              onChange={(e) => setLimits({ ...limits, dailyLimit: Number(e.target.value) })}
              className="flex-1 px-3 py-3 min-h-[48px] border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-lg font-bold"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Per-Transaction Limit
          </label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              value={limits.perTransactionLimit}
              onChange={(e) => setLimits({ ...limits, perTransactionLimit: Number(e.target.value) })}
              className="flex-1 px-3 py-3 min-h-[48px] border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-lg font-bold"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
            Allowed Assets
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {["USDC", "EURC", "USDm", "CELO", "cUSD"].map((asset) => (
              <button
                key={asset}
                onClick={() => {
                  setLimits({
                    ...limits,
                    allowedAssets: limits.allowedAssets.includes(asset)
                      ? limits.allowedAssets.filter((a) => a !== asset)
                      : [...limits.allowedAssets, asset],
                  });
                }}
                className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-bold transition-all ${
                  limits.allowedAssets.includes(asset)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Step 2: Permissions
  const PermissionsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <span className="text-4xl">🔐</span>
        <h3 className="text-lg font-bold mt-2 text-gray-900 dark:text-white">Review Permissions</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose what the Guardian can do automatically
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            key: "autoSwap",
            title: "Auto-Swap",
            description: "Automatically swap to protect against inflation",
            icon: "🔄",
          },
          {
            key: "autoRebalance",
            title: "Auto-Rebalance",
            description: "Rebalance portfolio to maintain targets",
            icon: "⚖️",
          },
          {
            key: "emergencyPause",
            title: "Emergency Pause",
            description: "Pause all activity during market volatility",
            icon: "🛑",
          },
        ].map((perm) => (
          <button
            key={perm.key}
            onClick={() =>
              setPermissions({
                ...permissions,
                [perm.key]: !permissions[perm.key as keyof typeof permissions],
              })
            }
            className="w-full flex items-center justify-between p-4 min-h-[60px] bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{perm.icon}</span>
              <div className="text-left">
                <div className="font-bold text-gray-900 dark:text-white">{perm.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{perm.description}</div>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full transition-colors ${
                permissions[perm.key as keyof typeof permissions]
                  ? "bg-blue-600"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-md mt-1"
                animate={{
                  x: permissions[perm.key as keyof typeof permissions] ? 24 : 4,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Step 3: Confirm
  const ConfirmStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <span className="text-4xl">✍️</span>
        <h3 className="text-lg font-bold mt-2 text-gray-900 dark:text-white">Confirm & Sign</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Review your settings and sign to activate
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Daily Limit</span>
          <span className="font-bold text-gray-900 dark:text-white">${limits.dailyLimit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Per-Transaction</span>
          <span className="font-bold text-gray-900 dark:text-white">${limits.perTransactionLimit}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Allowed Assets</span>
          <span className="font-bold text-gray-900 dark:text-white">{limits.allowedAssets.join(", ")}</span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="text-xs text-gray-500 mb-2">Enabled Actions</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(permissions)
              .filter(([, enabled]) => enabled)
              .map(([key]) => (
                <span
                  key={key}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-bold"
                >
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <div className="flex gap-2">
          <span>⚠️</span>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            By signing, you authorize the Guardian to execute trades within your defined limits.
            You can revoke these permissions at any time.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case "limits":
        return <LimitsStep />;
      case "permissions":
        return <PermissionsStep />;
      case "confirm":
        return <ConfirmStep />;
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <StepIndicator />
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
      </div>

      {/* Footer */}
      <div
        className="p-4 border-t border-gray-200 dark:border-gray-700"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        <button
          onClick={goNext}
          className="w-full py-4 min-h-[56px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {currentStep === "confirm" ? (
            <>
              <span>✍️</span>
              <span>Sign & Activate Guardian</span>
            </>
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

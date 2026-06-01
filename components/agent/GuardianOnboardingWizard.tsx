/**
 * GuardianOnboardingWizard — Progressive 4-step introduction to the Guardian.
 *
 * Shown in the Agent tab when the user has no active Guardian permission.
 * Each step introduces one concept at a time: what it is, what it does
 * automatically, what the user controls, then an activation button.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GuardianOnboardingWizardProps {
  onActivate: () => void;
  onSkip: () => void;
  spendingLimit?: number;
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { step: Step; emoji: string; title: string; body: string }[] = [
  {
    step: 1,
    emoji: "🛡️",
    title: "Meet your Guardian",
    body: "Your Guardian monitors markets 24/7 and suggests moves to protect your savings from inflation. It works while you sleep.",
  },
  {
    step: 2,
    emoji: "🤖",
    title: "What it can do automatically",
    body: "When inflation shifts in your region, the Guardian can rebalance your stablecoins into stronger economies. You approve once, it handles the rest.",
  },
  {
    step: 3,
    emoji: "🔐",
    title: "What you control",
    body: "You set a daily spending limit and choose which tokens it can use. You can pause or stop it anytime — you're always in charge.",
  },
  {
    step: 4,
    emoji: "🚀",
    title: "Ready to activate?",
    body: "",
  },
];

export default function GuardianOnboardingWizard({
  onActivate,
  onSkip,
  spendingLimit = 5.0,
}: GuardianOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const step = STEPS[currentStep - 1];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/40 overflow-hidden">
      {/* Progress bar */}
      <div className="flex gap-1 px-4 pt-4">
        {STEPS.map((s) => (
          <div
            key={s.step}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              s.step <= currentStep
                ? "bg-blue-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="p-6 text-center"
        >
          {/* Step 4 is the activation screen */}
          {currentStep === 4 ? (
            <div className="space-y-5">
              <div className="text-5xl">{step.emoji}</div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {step.title}
              </h3>
              <div className="bg-white dark:bg-gray-800/50 rounded-xl p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Daily limit</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    ${spendingLimit}/day
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    7 days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">You can</span>
                  <span className="font-bold text-green-600">
                    Pause or stop anytime
                  </span>
                </div>
              </div>
              <button
                onClick={onActivate}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
              >
                Enable Protection
              </button>
              <p className="text-xs text-gray-400">
                No funds move without your approval.
              </p>
            </div>
          ) : (
            /* Steps 1-3: education */
            <div className="space-y-4">
              <div className="text-5xl">{step.emoji}</div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-xs mx-auto">
                {step.body}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Skip link — shown on step 1 for users who already understand */}
      {currentStep === 1 && (
        <div className="px-6 pb-3 text-center">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors"
          >
            Skip intro — I know what a Guardian is
          </button>
        </div>
      )}

      {/* Navigation — hidden on step 4 (it has its own CTA) */}
      {currentStep !== 4 && (
        <div className="flex items-center justify-between px-6 pb-5">
          <button
            onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as Step)}
            className={`text-sm font-medium transition-colors ${
              currentStep === 1
                ? "text-gray-300 dark:text-gray-600 cursor-default"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            disabled={currentStep === 1}
          >
            ← Back
          </button>

          <span className="text-xs text-gray-400 font-medium">
            {currentStep} of 4
          </span>

          <button
            onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as Step)}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {currentStep === 3 ? "Set up →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
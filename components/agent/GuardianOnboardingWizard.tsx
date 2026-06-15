/**
 * GuardianOnboardingWizard — Progressive 4-step introduction to the Guardian.
 *
 * Shown in the Agent tab when the user has no active Guardian permission.
 * Each step introduces one concept at a time: what it is, what it does
 * automatically, what the user controls, then an activation button.
 *
 * Accessibility:
 * - Focus moves to the step heading on every step transition
 * - aria-live="polite" region announces step changes to screen readers
 * - Progress bar has correct ARIA role and accessible labels
 * - Navigation buttons have descriptive aria-labels
 * - Animations respect prefers-reduced-motion
 */
import { useEffect, useRef, useState } from "react";
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
    title: "Meet Auto-Saver",
    body: "Auto-Saver watches markets around the clock and suggests moves to protect your savings from inflation. It works while you sleep.",
  },
  {
    step: 2,
    emoji: "🤖",
    title: "What it can do for you",
    body: "When inflation rises in your region, Auto-Saver can shift your stablecoins into stronger ones. You approve once — it handles the rest.",
  },
  {
    step: 3,
    emoji: "🔐",
    title: "You stay in charge",
    body: "You set the daily limit and choose which tokens it can use. You can pause or stop it any time.",
  },
  {
    step: 4,
    emoji: "🚀",
    title: "Ready to set it up?",
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the step heading whenever the step changes — critical for
  // keyboard and screen-reader users so they land on the new content.
  useEffect(() => {
    // Small delay lets the AnimatePresence mount the new content first
    const id = setTimeout(() => headingRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [currentStep]);

  // ── Animation variants — framer-motion automatically respects        ──
  //    prefers-reduced-motion by skipping spring/tween animations.
  const transition = {
    type: "spring" as const,
    damping: 20,
    stiffness: 200,
  };

  return (
    <div
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/40 overflow-hidden"
      role="region"
      aria-label="Auto-Saver setup wizard"
    >
      {/* Progress bar — semantic progress indicator */}
      <div
        className="flex gap-1 px-4 pt-4"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-label={`Step ${currentStep} of 4`}
      >
        {STEPS.map((s) => (
          <div
            key={s.step}
            className={`h-1 flex-1 rounded-full motion-safe:transition-colors motion-safe:duration-300 ${
              s.step <= currentStep
                ? "bg-blue-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Screen-reader live region for step announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Step {currentStep} of 4: {step.title}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={transition}
          className="p-6 text-center"
        >
          {/* Step 4 is the activation screen */}
          {currentStep === 4 ? (
            <div className="space-y-5">
              <div className="text-5xl" aria-hidden="true">{step.emoji}</div>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-black text-gray-900 dark:text-white outline-none"
              >
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
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 active:scale-[0.98] motion-safe:transition-all shadow-lg shadow-blue-600/20"
                aria-label="Turn on Auto-Saver protection"
              >
                Turn on protection
              </button>
              <p className="text-xs text-gray-400">
                No funds move without your approval.
              </p>
            </div>
          ) : (
            /* Steps 1-3: education */
            <div className="space-y-4">
              <div className="text-5xl" aria-hidden="true">{step.emoji}</div>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-black text-gray-900 dark:text-white outline-none"
              >
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
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline motion-safe:transition-colors"
            aria-label="Skip the Auto-Saver introduction"
          >
            Skip intro — I get it
          </button>
        </div>
      )}

      {/* Navigation — hidden on step 4 (it has its own CTA) */}
      {currentStep !== 4 && (
        <div className="flex items-center justify-between px-6 pb-5">
          <button
            onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as Step)}
            className={`text-sm font-medium motion-safe:transition-colors ${
              currentStep === 1
                ? "text-gray-300 dark:text-gray-600 cursor-default"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
            disabled={currentStep === 1}
            aria-label={currentStep === 1 ? "Already on the first step" : "Go back to the previous step"}
          >
            ← Back
          </button>

          <span className="text-xs text-gray-400 font-medium" aria-hidden="true">
            {currentStep} of 4
          </span>

          <button
            onClick={() => setCurrentStep((Math.min(4, currentStep + 1)) as Step)}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 motion-safe:transition-colors"
            aria-label={currentStep === 3 ? "Set up Auto-Saver" : "Go to the next step"}
          >
            {currentStep === 3 ? "Set up →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

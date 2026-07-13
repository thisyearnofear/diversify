/**
 * BusinessPromptCard — retail→business graduation prompt.
 *
 * Non-prescriptive framing per `docs/sme-fx-strategy.md` §7: never
 * "you should switch to USD", always "you might be running cyclical
 * FX exposure — want to see what that looks like?".
 *
 * Visual pattern follows PhilosophyPromptCard's neutral framing
 * (positive accent gradient, no chrome-heavy pulse animation), but
 * tuned to the FX Corridor palette (teal/cyan matching the emerging
 * MarketsTracker / PaymentCycleReport section below it).
 *
 * Density-aware: rendered only when the parent has a non-zero signal
 * (the wrapper in ConnectedOverview gates on `data.shouldShow`). When
 * data is null (loading) or dismissed (true), the wrapper returns null
 * — this component never self-zero-renders.
 *
 * Per-signal chips let the user see exactly which behaviour detected
 * the prompt, and a "Why am I seeing this?" disclosure expansion
 * makes the derivation transparent.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";

export interface BusinessPromptCardProps {
  /** Detection confidence (0..1). Used only for the disclosure copy. */
  confidence: number;
  /** True when one or more signals fired. */
  signals: {
    cyclical: boolean;
    corridor: boolean;
    largerBalance: boolean;
    hasSavedCycle: boolean;
  };
  /** Persisted dismissal. */
  onDismiss: () => void | Promise<void>;
  /** Explore CTA — scrolls/opens the FX drag report. */
  onExplore: () => void;
  /** Optional pulse when the card mounts; off by default (per density-first). */
  pulse?: boolean;
}

// Per-signal evidence copy. Kept neutral; never tells the user what
// currency to hold or where to move funds.
const SIGNAL_COPY: Array<{
  key: "cyclical" | "corridor" | "largerBalance" | "hasSavedCycle";
  label: string;
  evidence: string;
}> = [
  {
    key: "cyclical",
    label: "Cyclical deposits & withdrawals",
    evidence: "3+ deposits and 2+ withdrawals in the last 90 days.",
  },
  {
    key: "corridor",
    label: "Corridor-shaped swaps",
    evidence:
      "2+ swaps from a local stablecoin to a USD-pegged asset in the last 30 days.",
  },
  {
    key: "largerBalance",
    label: "Larger balances in motion",
    evidence: "At least one swap above USD 5,000.",
  },
  {
    key: "hasSavedCycle",
    label: "Saved payment cycle",
    evidence: "You already added a supplier payment cycle.",
  },
];

function firedSignals(signals: BusinessPromptCardProps["signals"]) {
  return SIGNAL_COPY.filter(({ key }) => signals[key]);
}

function confidenceCopy(confidence: number): string {
  if (confidence >= 0.8) return "Strong pattern detected.";
  if (confidence >= 0.5) return "Moderate pattern detected.";
  return "Pattern detected.";
}

export function BusinessPromptCard({
  confidence,
  signals,
  onDismiss,
  onExplore,
  pulse = false,
}: BusinessPromptCardProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [dismissPending, setDismissPending] = useState(false);
  const fired = firedSignals(signals);

  const handleDismiss = async () => {
    if (dismissPending) return;
    setDismissPending(true);
    // finally runs on rejection, so the disabled state always
    // restores. The hook layer (useGraduationSignal) owns error
    // reporting (toasts, state) — we don't swallow here.
    try {
      await onDismiss();
    } finally {
      setDismissPending(false);
    }
  };

  return (
    <motion.section
      initial={pulse ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      data-testid="business-prompt-card"
      aria-labelledby="business-prompt-title"
      className="rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-gradient-to-br from-teal-50 via-cyan-50/60 to-emerald-50/40 dark:from-teal-950/30 dark:via-cyan-950/20 dark:to-emerald-950/10 p-4 space-y-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-9 h-9 rounded-xl bg-white/80 dark:bg-gray-900/40 border border-teal-200/80 dark:border-teal-800/40 flex items-center justify-center text-xl shadow-sm"
        >
          💼
        </div>
        <div className="flex-1 min-w-0">
          <p
            id="business-prompt-title"
            className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-300"
          >
            Patterns in your recent activity
          </p>
          <p
            data-testid="confidence-copy"
            className="text-sm font-bold text-gray-900 dark:text-white mt-1 leading-snug"
          >
            {confidenceCopy(confidence)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
            You might be running cyclical FX exposure between local
            proceeds and supplier payments. DiversiFi can model the
            margin drag — you decide what to do with the number.
          </p>
        </div>
      </div>

      {/* Per-signal chips — evidence-based, not prescriptive. */}
      {fired.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          aria-label="Detected behaviour signals"
        >
          {fired.map(({ key, label }) => (
            <li
              key={key}
              className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-teal-200/80 dark:border-teal-800/40 text-teal-800 dark:text-teal-200"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExplore}
          className="min-h-11 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-bold transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          See FX drag report
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissPending}
          aria-label="Dismiss this prompt"
          className="min-h-11 px-3 py-2 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-teal-900/30 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
        >
          {dismissPending ? "Saving…" : "Not now"}
        </button>
        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          aria-expanded={whyOpen}
          // aria-controls references an id that exists only when the
          // disclosure is mounted; omit it when closed so screen
          // readers don't warn about a dangling reference.
          aria-controls={whyOpen ? "business-prompt-why" : undefined}
          className="min-h-11 px-2 py-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 rounded-lg"
        >
          {whyOpen ? "− Hide" : "+ Why am I seeing this?"}
        </button>
      </div>

      {whyOpen && (
        <motion.div
          id="business-prompt-why"
          role="region"
          data-testid="business-prompt-disclosure"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="border-t border-teal-200/80 dark:border-teal-800/40 pt-3 space-y-2">
            <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
              DiversiFi looks at your on-chain activity on a wallet
              basis — never per-session, and never stored in third-party
              analytics. Detected signals (confidence{" "}
              <strong>{Math.round(confidence * 100)}%</strong>):
            </p>
            <ul className="space-y-1 list-disc pl-5">
              {fired.map(({ key, evidence }) => (
                <li
                  key={key}
                  className="text-[11px] text-gray-600 dark:text-gray-400 marker:text-gray-400 dark:marker:text-gray-500"
                >
                  {evidence}
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400 italic">
              DiversiFi never holds your funds, never prescribes a move.
              The drag report is a number — you decide.
            </p>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}

export default BusinessPromptCard;

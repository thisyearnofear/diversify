import React, { useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAllowance } from "../../hooks/use-allowance";
import { DemoModeContext } from "../../context/app/DemoModeContext";

interface FreemiumPanelProps {
  onGoodDollarClaim: () => void;
}

/**
 * Chat footer: one quiet line carrying the day's question allowance.
 * Tapping expands the single highest-value unclaimed earn action — one
 * line, not a list. When the day is spent, the line says so and the earn
 * line is already open. Demo mode bypasses the gate, so it says so.
 */
export default function FreemiumPanel({ onGoodDollarClaim }: FreemiumPanelProps) {
  const demoMode = useContext(DemoModeContext)?.demoMode;
  const { remaining, limit, nextAction, loading, granting, grant, shareApp } = useAllowance();
  const [expanded, setExpanded] = useState(false);
  const [proofInput, setProofInput] = useState("");

  // Demo requests skip the gate entirely — say so rather than show a
  // number that isn't being enforced.
  if (demoMode?.isActive) {
    return (
      <div className="px-4 pt-1 pb-2">
        <p className="py-1 text-xs text-gray-500 dark:text-gray-400">demo · unlimited</p>
      </div>
    );
  }

  if (loading || remaining === null) return null;

  const exhausted = remaining === 0;
  const open = expanded || exhausted;

  const earnLine = nextAction
    ? `${nextAction.emoji} ${nextAction.label} → +${nextAction.questions} questions`
    : null;

  const handleAction = async () => {
    if (!nextAction) return;
    if (nextAction.key === "gooddollar_claim") {
      // The real claim flow runs at the app level; the grant lands via
      // the onClaimSuccess → claimReward plumbing.
      onGoodDollarClaim();
      return;
    }
    if (nextAction.key === "share_app") {
      await shareApp();
      return;
    }
    await grant(nextAction.key, proofInput);
    setProofInput("");
  };

  return (
    <div className="px-4 pt-1 pb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between py-1 text-xs transition-colors ${
          exhausted
            ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        <span>
          {exhausted
            ? "questions used for today — resets at midnight UTC"
            : `${remaining} of ${limit} questions left today`}
        </span>
        {nextAction && <span aria-hidden="true">{open ? "▴" : "▾"}</span>}
      </button>

      <AnimatePresence>
        {open && nextAction && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* One earn action — the highest-value thing not yet claimed
                today. Proof actions take the URL inline on the same line. */}
            <div className="mt-1 flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {earnLine}
              </span>
              {nextAction.requiresProof ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="url"
                    placeholder="Paste URL"
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    className="w-24 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  />
                  <button
                    onClick={handleAction}
                    disabled={!proofInput || granting !== null}
                    className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Claim
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAction}
                  disabled={granting !== null}
                  className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors shrink-0"
                >
                  {nextAction.key === "gooddollar_claim" ? "Claim" : "Share"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

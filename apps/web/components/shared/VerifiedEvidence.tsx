/**
 * VerifiedEvidence — quiet chain-agnostic trust line with progressive disclosure.
 *
 * Default: "✓ Verified · Evidence mirrored" (no hex, no chain names) — the
 * trust tier (§7 Honesty is restraint). Tap/hover rewrites the artefact in
 * place to the 5 dots + shared ledger + Guardian #1 + verify link — not a
 * chain banner. Respects docs/design-language.md §7 Chain-agnostic trust.
 */

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const LEDGER = "0x3BCf7dFd68ce98880618c89A351168960724369C";
const AGENTIC_ID = "0x68156dbFFaE56e0b3417993c3465741917A33D60";

const CHAINS = [
  { label: "0G", color: "#1e293b" },
  { label: "Arbitrum", color: "#28a0f0" },
  { label: "Celo", color: "#35d07f" },
  { label: "HashKey", color: "#ff6b35" },
  { label: "Robinhood", color: "#ccff00" },
] as const;

interface Props {
  className?: string;
  compact?: boolean;
}

export function VerifiedEvidence({ className = "", compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded"
      >
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black" aria-hidden="true">✓</span>
        <span className="font-semibold tracking-wide">Verified</span>
        <span className="opacity-60">· Evidence mirrored</span>
        <span className="text-[10px] opacity-50 ml-0.5" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, height: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
            exit={reducedMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] p-3 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {CHAINS.map((c) => (
                  <span
                    key={c.label}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{ background: `${c.color}14`, color: c.color, borderColor: `${c.color}30` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </span>
                ))}
                <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1">same ledger</span>
              </div>

              <div className="font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all">
                {LEDGER}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-black">G</span>
                <span className="font-bold">Guardian #1</span>
                <span className="font-mono opacity-70 break-all">{AGENTIC_ID}</span>
                <span className="hidden sm:inline text-[10px] text-gray-500">· 0G Storage root, portable</span>
              </div>

              <a
                href="/api/agent/zero-g-ledger?verify="
                onClick={(e) => e.preventDefault()}
                className="inline-flex text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                title="Append a tx hash: ?verify=0x… verifies via chain RPC receipt"
              >
                Verify via /api/agent/zero-g-ledger?verify=0x… →
              </a>
              {compact && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  LiveProofCard rows already lazy-check `✓` via `verifyLedgerTx` — this is the inspect mirror of that check.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VerifiedEvidence;

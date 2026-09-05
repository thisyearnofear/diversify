/**
 * VerifiedEvidence — quiet chain-agnostic trust line with progressive disclosure.
 *
 * Default: "✓ Verified · Evidence mirrored" (no hex, no chain names) — the
 * trust tier (§7 Honesty is restraint). Tap/hover rewrites the artefact in
 * place to the 5 dots + shared ledger + Guardian #1 + working ?verify= check —
 * not a chain banner. Respects docs/design-language.md §7 Chain-agnostic trust.
 */

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LEDGER_ADDRESS,
  AGENTIC_ID_ADDRESS,
  TRUST_CHAINS,
  VERIFY_HASH_PATTERN,
  LEDGER_VERIFY_PATH,
} from "@/constants/guardian-identity";

const CHAINS = TRUST_CHAINS;

interface Props {
  className?: string;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; verified: boolean; found: boolean; explorerUrl: string; chainId: number }
  | { kind: "error"; message: string };

function shortHex(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}

export function VerifiedEvidence({ className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hash, setHash] = useState("");
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });
  const reducedMotion = useReducedMotion();

  const trimmed = hash.trim();
  const hashValid = VERIFY_HASH_PATTERN.test(trimmed);

  const runVerify = async () => {
    if (!hashValid || verify.kind === "loading") return;
    setVerify({ kind: "loading" });
    try {
      const res = await fetch(
        `${LEDGER_VERIFY_PATH}?verify=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVerify({
        kind: "result",
        verified: Boolean(data.verified),
        found: Boolean(data.found),
        explorerUrl: String(data.explorerUrl || ""),
        chainId: Number(data.chainId || 0),
      });
    } catch {
      setVerify({
        kind: "error",
        message: "Couldn't reach the verification service. Try again.",
      });
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="relative inline-flex items-center gap-1.5 py-1.5 -my-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded before:absolute before:inset-x-[-8px] before:inset-y-[-10px] before:content-['']"
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
                {LEDGER_ADDRESS}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-black">G</span>
                <span className="font-bold">Guardian #1</span>
                <span className="font-mono opacity-70 break-all">{AGENTIC_ID_ADDRESS}</span>
                <span className="hidden sm:inline text-[10px] text-gray-500">· 0G Storage root, portable</span>
              </div>

              {/* Working verify: paste a tx hash, check it against the chain
                  RPC receipt (verifyLedgerTx), link out to the explorer. */}
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={hash}
                    onChange={(e) => {
                      setHash(e.target.value);
                      if (verify.kind !== "idle") setVerify({ kind: "idle" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hashValid) void runVerify();
                    }}
                    placeholder="0x… ledger tx hash"
                    aria-label="Ledger transaction hash to verify"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-2 py-1.5 font-mono text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => void runVerify()}
                    disabled={!hashValid || verify.kind === "loading"}
                    className="min-h-[28px] shrink-0 rounded-lg bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-white/10 hover:bg-blue-700 disabled:hover:bg-gray-300 dark:disabled:hover:bg-white/10 text-white disabled:text-gray-500 dark:disabled:text-gray-500 text-[11px] font-bold px-2.5 transition-colors disabled:cursor-not-allowed"
                  >
                    {verify.kind === "loading" ? "Checking…" : "Verify"}
                  </button>
                </div>
                {verify.kind === "result" && (
                  <p
                    role="status"
                    className={`text-[11px] leading-relaxed ${
                      verify.verified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {verify.verified
                      ? "✓ Confirmed on-chain — settled to the ledger contract."
                      : verify.found
                        ? "Tx exists but didn't settle to the ledger contract."
                        : "No receipt found for this hash."}{" "}
                    {verify.explorerUrl && (
                      <a
                        href={verify.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Explorer ({shortHex(trimmed)}) →
                      </a>
                    )}
                  </p>
                )}
                {verify.kind === "error" && (
                  <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
                    {verify.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VerifiedEvidence;

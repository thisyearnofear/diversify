/**
 * VerifiedEvidence — the chain-agnostic trust check (design-language §7).
 *
 * Three layers, one object — the same depth grammar every other surface uses
 * (L0 the fact, L1 the working check, L2 the technical record):
 *
 *   verdict  — what the shared proof feed actually says: the Guardian's last
 *              public record, and how many decisions the ledger holds. The
 *              "Verified" claim is earned only when the chain's own RPC
 *              confirms the receipt (`useVerifiedTxs`) — never assumed.
 *   check    — the working ?verify= check, prefilled with that record, so
 *              verifying is a tap rather than a typing task.
 *   detail   — networks, ledger addresses, Guardian identity. Hex and chain
 *              names live here and only here (§7: no hex in the first
 *              viewport, detail is one tap behind).
 *
 * The panel used to open as an empty form: three hex strings, five chain
 * chips and a hash field the visitor had no way to fill. It read as
 * complicated because it showed plumbing instead of proof.
 *
 * VerifiedEvidence is the same disclosure inside the accordion chrome the
 * status rails use; VerifiedEvidencePanel is the chrome-free version for tabs
 * that transform their marquee slot into the verifier (§5: modes transform,
 * never append).
 */

import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LEDGER_ADDRESS,
  ARC_LEDGER_ADDRESS,
  AGENTIC_ID_ADDRESS,
  TRUST_CHAINS,
  VERIFICATION_CHAINS,
  VERIFY_HASH_PATTERN,
  LEDGER_VERIFY_PATH,
} from "@/constants/guardian-identity";
import { useProofFeed, type LedgerRecommendation } from "@/hooks/use-proof-feed";
import { useVerifiedTxs } from "@/hooks/use-verify-tx";
import { useCountUp } from "@/hooks/use-count-up";
import {
  formatRecordAge,
  getLedgerProofLabel,
  humanizeLedgerAction,
} from "@/constants/proof-feed";
import RiveVerifiedSeal from "@/components/shared/RiveVerifiedSeal";
import { Hallmark } from "@/components/shared/Hallmark";

const CHAINS = TRUST_CHAINS;
const EMPTY_HASH_RE = /^0x0*$/;

type Layer = "verdict" | "check" | "detail";

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

function isCheckable(rec: LedgerRecommendation | undefined): rec is LedgerRecommendation {
  return !!rec?.settlementTxHash && !EMPTY_HASH_RE.test(rec.settlementTxHash);
}

/** The record the verdict speaks about: the newest one with a receipt the
 *  chain can actually be asked about. A heartbeat row with a zero hash is
 *  still a public record — but nothing here may claim it was confirmed. */
function sampleRecord(recent: LedgerRecommendation[] | undefined): LedgerRecommendation | null {
  const rows = recent ?? [];
  return rows.find(isCheckable) ?? rows[0] ?? null;
}

function rowKeyFor(rec: LedgerRecommendation): string {
  return `${rec.chainId ?? 0}-${rec.id}`;
}

function LayerBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 -ml-1 px-1 text-2xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 min-h-[32px]"
    >
      {label}
    </button>
  );
}

function VerifierDoors({
  onCheck,
  onDetail,
  center = false,
}: {
  onCheck: () => void;
  onDetail: () => void;
  center?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 ${
        center ? "justify-center" : ""
      }`}
    >
      <button type="button" onClick={onCheck} className="link-handoff min-h-tap px-1 text-2xs">
        Check a receipt →
      </button>
      <button type="button" onClick={onDetail} className="link-quiet min-h-tap px-1 text-2xs">
        Technical detail
      </button>
    </div>
  );
}

function VerdictLayer({
  onCheck,
  onDetail,
  presentation = "inline",
}: {
  onCheck: () => void;
  onDetail: () => void;
  /** `stage` is the verifier as the marquee object — the count is its face
   *  and everything centers, because the slot it transforms is the screen's
   *  subject. `inline` is the same facts inside a status rail. */
  presentation?: "inline" | "stage";
}) {
  const { data, isLoading, isStale, error } = useProofFeed();
  const sample = sampleRecord(data?.recent);
  const checkable = sample && isCheckable(sample) ? sample : null;
  const statuses = useVerifiedTxs(
    checkable
      ? [{ key: rowKeyFor(checkable), txHash: checkable.settlementTxHash, chainId: checkable.chainId }]
      : [],
  );
  const chainStatus = checkable ? statuses[rowKeyFor(checkable)] : undefined;
  const total = data?.stats?.totalRecommendations ?? 0;
  const count = useCountUp(total);
  const stage = presentation === "stage";

  if (isLoading && !data) {
    return (
      <p role="status" className="text-2xs text-ink-muted">
        Reading the public ledger…
      </p>
    );
  }

  if (!data && error) {
    return (
      <div className={`space-y-2 ${stage ? "text-center" : ""}`} data-testid="verifier-verdict">
        <p className="text-sm font-semibold text-ink">
          The public ledger isn&apos;t reachable right now.
        </p>
        <p className="text-2xs text-ink-muted">
          Nothing is claimed until it can be read. The addresses never change.
        </p>
        <VerifierDoors center={stage} onCheck={onCheck} onDetail={onDetail} />
      </div>
    );
  }

  const headline = (
    <p className={stage ? "text-base font-bold text-ink" : "text-sm font-semibold text-ink"}>
      {chainStatus === "verified"
        ? "Verified on the chain"
        : "The Guardian’s last public record"}
    </p>
  );
  const reading = sample ? (
    <p className="mt-0.5 text-2xs text-ink-muted">
      {humanizeLedgerAction(sample.action)}
      {sample.targetToken ? ` → ${sample.targetToken}` : ""}
      {formatRecordAge(sample.timestamp) ? ` · ${formatRecordAge(sample.timestamp)}` : ""}
      {chainStatus === "unverified" ? " · the chain hasn’t confirmed this receipt" : ""}
    </p>
  ) : (
    <p className="mt-0.5 text-2xs text-ink-muted">Nothing has settled on the ledger yet.</p>
  );
  const seal =
    chainStatus === "verified" ? (
      <RiveVerifiedSeal size={stage ? 72 : 40} verified />
    ) : (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center border border-line bg-surface ${
          stage ? "size-16 rounded-xl" : "size-10 rounded-lg"
        }`}
      >
        <Hallmark size={stage ? 26 : 18} className="text-ink-subtle" />
      </span>
    );

  return (
    <div
      className={`space-y-3 ${stage ? "flex flex-col items-center text-center" : ""}`}
      data-testid="verifier-verdict"
    >
      {stage ? (
        <>
          {seal}
          <div className="min-w-0">
            {headline}
            {reading}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3">
          {seal}
          <div className="min-w-0">
            {headline}
            {reading}
          </div>
        </div>
      )}

      {total > 0 && (
        <p className={`tabular-nums ${stage ? "" : "text-2xs"}`}>
          <motion.span
            className={stage ? "block text-3xl font-bold text-ink" : "font-semibold text-ink"}
          >
            {count}
          </motion.span>{" "}
          <span className={`text-ink-muted ${stage ? "block text-2xs" : ""}`}>
            decisions on one shared ledger
          </span>
        </p>
      )}

      {isStale && (
        <p role="status" className="text-3xs text-amber-600 dark:text-amber-400">
          Showing the last read, not a fresh one.
        </p>
      )}

      <VerifierDoors center={stage} onCheck={onCheck} onDetail={onDetail} />
    </div>
  );
}

function CheckLayer({ onBack }: { onBack: () => void }) {
  const { data } = useProofFeed();
  const sample = sampleRecord(data?.recent);
  const prefilledHash = sample && isCheckable(sample) ? sample.settlementTxHash : "";
  const sampleChain = sample?.chainId;
  const prefilledNetwork =
    sampleChain != null && VERIFICATION_CHAINS.some((c) => c.chainId === sampleChain)
      ? sampleChain
      : VERIFICATION_CHAINS[0].chainId;

  const [hash, setHash] = useState(prefilledHash);
  const [network, setNetwork] = useState<number>(prefilledNetwork);
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });
  const requestSeq = useRef(0);

  const trimmed = hash.trim();
  const hashValid = VERIFY_HASH_PATTERN.test(trimmed);

  const invalidateVerify = () => {
    requestSeq.current += 1;
    setVerify((v) => (v.kind === "idle" ? v : { kind: "idle" }));
  };

  const runVerify = async () => {
    if (!hashValid || verify.kind === "loading") return;
    const seq = ++requestSeq.current;
    setVerify({ kind: "loading" });
    try {
      const res = await fetch(
        `${LEDGER_VERIFY_PATH}?verify=${encodeURIComponent(trimmed)}&chainId=${network}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      setVerify({
        kind: "result",
        verified: Boolean(data.verified),
        found: Boolean(data.found),
        explorerUrl: String(data.explorerUrl || ""),
        chainId: Number(data.chainId || 0),
      });
    } catch {
      if (seq !== requestSeq.current) return;
      setVerify({
        kind: "error",
        message: "Couldn't reach the verification service. Try again.",
      });
    }
  };

  return (
    <div className="space-y-2" data-testid="verifier-check">
      <LayerBack label="← Verdict" onClick={onBack} />
      <p className="text-xs text-ink-muted">
        Check an on-chain receipt, not an allocation&apos;s safety or return.
      </p>
      {prefilledHash && (
        <p className="text-3xs text-ink-subtle">
          Filled with the newest public record ({getLedgerProofLabel(sampleChain)}). Paste any
          other hash to check it too.
        </p>
      )}
      <select
        value={network}
        onChange={(e) => {
          setNetwork(Number(e.target.value));
          invalidateVerify();
        }}
        aria-label="Ledger network"
        className="block w-full min-h-tap rounded-lg border border-line bg-surface px-2 py-1.5 text-2xs text-ink-muted focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400"
      >
        {VERIFICATION_CHAINS.map((c) => (
          <option key={c.chainId} value={c.chainId}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={hash}
          onChange={(e) => {
            setHash(e.target.value);
            invalidateVerify();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hashValid) void runVerify();
          }}
          placeholder="0x… ledger tx hash"
          aria-label="Ledger transaction hash to verify"
          className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 py-1.5 font-mono text-2xs text-ink-muted placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400"
        />
        <button
          type="button"
          onClick={() => void runVerify()}
          disabled={!hashValid || verify.kind === "loading"}
          className="min-h-[28px] shrink-0 rounded-lg bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-white/10 hover:bg-blue-700 disabled:hover:bg-gray-300 dark:disabled:hover:bg-white/10 text-white disabled:text-gray-500 dark:disabled:text-gray-500 text-2xs font-bold px-2.5 transition-colors disabled:cursor-not-allowed"
        >
          {verify.kind === "loading" ? "Checking…" : "Verify"}
        </button>
      </div>
      {verify.kind === "result" && (
        <div role="status" className="flex items-center gap-2.5">
          {/* The seal stamps once when the check confirms — posture
              only; the result copy + link stay in the DOM. */}
          {verify.verified && <RiveVerifiedSeal size={40} verified />}
          <p
            className={`text-2xs leading-relaxed ${
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
        </div>
      )}
      {verify.kind === "error" && (
        <p role="alert" className="text-2xs text-red-600 dark:text-red-400">
          {verify.message}
        </p>
      )}
    </div>
  );
}

function DetailLayer({ onBack }: { onBack: () => void }) {
  const { data } = useProofFeed();
  return (
    <div className="space-y-2" data-testid="verifier-detail">
      <LayerBack label="← Verdict" onClick={onBack} />
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHAINS.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1 text-3xs font-bold px-1.5 py-0.5 rounded-full border"
            style={{ background: `${c.color}14`, color: c.color, borderColor: `${c.color}30` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        <span className="text-2xs text-gray-500 dark:text-gray-400 ml-1">same ledger</span>
      </div>

      <div className="font-mono text-2xs text-gray-700 dark:text-gray-300 break-all">
        {LEDGER_ADDRESS}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-3xs text-gray-500 dark:text-gray-400">Arc ledger</span>
        <span className="font-mono text-2xs text-gray-700 dark:text-gray-300 break-all">
          {ARC_LEDGER_ADDRESS}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-2xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 text-white text-3xs font-black">G</span>
        <span className="font-bold">Guardian #1</span>
        <span className="font-mono opacity-70 break-all">{AGENTIC_ID_ADDRESS}</span>
        <span className="hidden sm:inline text-3xs text-gray-500">· 0G Storage root, portable</span>
      </div>

      {data?.contractExplorer && (
        <a
          href={data.contractExplorer}
          target="_blank"
          rel="noopener noreferrer"
          className="link-handoff inline-block text-2xs"
        >
          Open the ledger contract →
        </a>
      )}
    </div>
  );
}

export function VerifiedEvidencePanel({
  className = "",
  presentation = "inline",
}: {
  className?: string;
  presentation?: "inline" | "stage";
}) {
  const [layer, setLayer] = useState<Layer>("verdict");
  return (
    <div className={`mt-2 ${className}`.trim()} data-testid="verified-evidence-panel">
      {layer === "verdict" && (
        <VerdictLayer
          presentation={presentation}
          onCheck={() => setLayer("check")}
          onDetail={() => setLayer("detail")}
        />
      )}
      {layer === "check" && <CheckLayer onBack={() => setLayer("verdict")} />}
      {layer === "detail" && <DetailLayer onBack={() => setLayer("verdict")} />}
    </div>
  );
}

export function VerifiedEvidence({ className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="relative inline-flex items-center gap-1.5 py-1.5 -my-1.5 text-2xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 rounded before:absolute before:inset-x-[-8px] before:inset-y-[-10px] before:content-['']"
      >
        <Hallmark size={10} className="opacity-70" />
        <span className="font-semibold tracking-wide">Verify evidence</span>
        <span className="text-3xs opacity-50 ml-0.5" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <VerifiedEvidencePanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VerifiedEvidence;

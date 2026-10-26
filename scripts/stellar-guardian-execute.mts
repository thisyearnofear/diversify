/**
 * Guardian corridor execution — Stellar testnet, policy-bound smart account.
 *
 * This is the wired depth layer, not a demo: a Guardian decision is a bounded
 * corridor action (XLM transfer) executed THROUGH the OpenZeppelin smart
 * account whose only signer is the Guardian agent key. The spending-limit
 * policy installed on CallContract(XLM SAC) enforces the cap on-chain — the
 * user's rule, not the app's. A decision over the cap is rejected by the
 * policy contract itself; the rejection is the evidence.
 *
 * On success the reasoning is anchored on the Soroban RecommendationLedger
 * (hash on-chain, text off-chain — the EVM convention), recorded under the
 * same agent identity that signed the transfer.
 *
 * Env:   STELLAR_AGENT_SECRET   — the Guardian agent key (smart-account signer)
 *        STELLAR_FEE_SECRET     — fee-payer account (testnet)
 *        STELLAR_SMART_ACCOUNT  — the C-address smart account (holds the XLM)
 * Flags: --amount-xlm <n>       — corridor action size (default 0.5)
 *        --recipient <G...>     — corridor counterparty
 *        --reasoning "<text>"   — the decision's reasoning (hashed on-chain)
 *        --agent-alias <name>   — stellar keyring alias for the agent key
 *                                (default: guardian-agent; its address must
 *                                match STELLAR_AGENT_SECRET — the ledger must
 *                                record the identity that actually executed)
 *        --no-record            — skip the ledger anchor
 *
 * Run:
 *   STELLAR_AGENT_SECRET=$(stellar keys secret guardian-agent) \
 *   STELLAR_FEE_SECRET=$(stellar keys secret testnet-user) \
 *   STELLAR_SMART_ACCOUNT=CBH5NT2HEIQGBMTABOPRPRUJKDNHU3HFIY6STSN7QZSCX7WXSLCOAVC2 \
 *   pnpm stellar-guardian-execute --recipient GDFEW... \
 *     --reasoning "kept corridor exposure bounded: within daily cap"
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import {
  LEDGER_CONTRACT,
  ensureSpendingLimitRule,
  policyBoundTransfer,
  sacBalance,
  smartAccountContext,
} from "./lib/stellar-smart-account.mjs";

const LIMIT_STROOPS = 20_000_000n; // 2 XLM per period
const PERIOD_LEDGERS = 17_280; // ~1 day at 5s ledgers
const DEFAULT_RECIPIENT = "GDFEW24MNJL2KOGFP6WQ6NTTLK6ZYFXHRRLYTNQHGMAH4V55R2GHFCWK"; // alice
const XLM_STROOPS = 10_000_000;

function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const explorer = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

async function main(): Promise<void> {
  const ctx = smartAccountContext();
  const amountXlm = Number(flagValue("--amount-xlm") ?? "0.5");
  if (!Number.isFinite(amountXlm) || amountXlm <= 0) throw new Error("--amount-xlm must be a positive number");
  const amountStroops = BigInt(Math.round(amountXlm * XLM_STROOPS));
  const recipient = flagValue("--recipient") ?? DEFAULT_RECIPIENT;
  const reasoning = flagValue("--reasoning") ?? `corridor action: ${amountXlm} XLM to ${recipient.slice(0, 8)}…`;
  const agentAlias = flagValue("--agent-alias") ?? "guardian-agent";
  const doRecord = !process.argv.includes("--no-record");

  console.log(JSON.stringify({
    step: "decision",
    account: ctx.account,
    agent: ctx.agent.address,
    amountXlm,
    recipient,
    policy: { limitXlm: Number(LIMIT_STROOPS) / XLM_STROOPS, periodLedgers: PERIOD_LEDGERS },
  }));

  const balance = await sacBalance(ctx);
  console.log(JSON.stringify({ step: "balance", xlmStroops: balance.toString() }));
  if (balance < amountStroops) {
    throw new Error("smart account underfunded — fund via SAC transfer first");
  }

  const { ruleId, installed } = await ensureSpendingLimitRule(ctx, {
    limitStroops: LIMIT_STROOPS,
    periodLedgers: PERIOD_LEDGERS,
  });
  console.log(JSON.stringify({ step: "rule-ready", ruleId, installed }));

  // The execution itself: the ONLY path XLM leaves this account is through
  // this policy. Over the cap → the policy contract rejects, never the app.
  const exec = await policyBoundTransfer(ctx, ruleId, recipient, amountStroops);
  console.log(JSON.stringify({
    step: "execute",
    status: exec.status,
    hash: exec.hash || undefined,
    detail: exec.detail,
    explorer: exec.hash ? explorer(exec.hash) : undefined,
  }));
  if (exec.status !== "SUCCESS") {
    console.log(JSON.stringify({ verdict: { executed: false, reason: exec.status } }));
    process.exitCode = 1;
    return;
  }

  // Anchor the reasoning commitment under the same agent identity that
  // signed the execution — verify the keyring alias really is that key.
  let ledger: Record<string, unknown> | null = null;
  if (doRecord) {
    const agentPublic = Keypair.fromSecret(process.env.STELLAR_AGENT_SECRET!).publicKey();
    const aliasAddress = execFileSync("stellar", ["keys", "address", agentAlias], { encoding: "utf8" }).trim();
    if (aliasAddress !== agentPublic) {
      throw new Error(
        `--agent-alias ${agentAlias} resolves to ${aliasAddress} but STELLAR_AGENT_SECRET is ${agentPublic} — ` +
        `the ledger must record the identity that executed.`,
      );
    }
    const reasoningHash = createHash("sha256").update(reasoning, "utf8").digest("hex");
    const out = execFileSync(
      "stellar",
      ["contract", "invoke", "--id", LEDGER_CONTRACT, "--source", agentAlias, "--network", "testnet",
        "--", "record", "--agent", agentPublic, "--reasoning_hash", reasoningHash],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    const txHash = out.match(/tx\/([0-9a-f]{64})/)?.[1] ?? null;
    const seq = out.trim().split(/\s+/).pop();
    ledger = {
      contract: LEDGER_CONTRACT,
      agent: agentPublic,
      reasoningHash,
      seq,
      txHash,
      explorer: txHash ? explorer(txHash) : null,
    };
    console.log(JSON.stringify({ step: "anchor", ...ledger }));
  }

  console.log(JSON.stringify({
    verdict: {
      executed: true,
      policyEnforced: "on-chain (CallContract + spending-limit, not app-side)",
      anchored: Boolean(ledger),
    },
  }, null, 2));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

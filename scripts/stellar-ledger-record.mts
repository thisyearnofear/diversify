/**
 * Record a Guardian decision commitment on the Stellar testnet
 * RecommendationLedger contract (contracts-stellar/recommendation-ledger).
 *
 * Deployed: CDQUT55ICBFEC6JGMZDJEHA47ECWQOAYHLNFHO2ULFLDQVIDNMKL4WT6
 * First record tx: a0a2b75bd16a4b5e837949300c24b75316aa81b4363364b118bbd28bbb57a6ec
 *
 * Invokes `record(agent, reasoning_hash)` through the Stellar CLI so the
 * agent key signs via the CLI keyring. The readable text stays off-chain —
 * only the SHA-256 commitment lands on-chain, matching the EVM ledger's
 * hash-only convention.
 *
 * Run:
 *   npx tsx scripts/stellar-ledger-record.mts --reasoning "held off on KESm: print was 14 days stale" \
 *     [--agent testnet-user] [--contract CDQUT55I...]
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const DEFAULT_CONTRACT = "CDQUT55ICBFEC6JGMZDJEHA47ECWQOAYHLNFHO2ULFLDQVIDNMKL4WT6";

function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const reasoning = flagValue("--reasoning");
const agentAlias = flagValue("--agent") ?? "testnet-user";
const contract = flagValue("--contract") ?? DEFAULT_CONTRACT;
if (!reasoning) throw new Error("--reasoning <text> is required (hashed; text itself stays off-chain)");

const reasoningHash = createHash("sha256").update(reasoning, "utf8").digest("hex");
const agentAddress = execFileSync("stellar", ["keys", "address", agentAlias], { encoding: "utf8" }).trim();

const out = execFileSync(
  "stellar",
  [
    "contract", "invoke",
    "--id", contract,
    "--source", agentAlias,
    "--network", "testnet",
    "--", "record",
    "--agent", agentAddress,
    "--reasoning_hash", reasoningHash,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const txHash = out.match(/tx\/([0-9a-f]{64})/)?.[1] ?? null;
const seq = out.trim().split(/\s+/).pop();
console.log(JSON.stringify({
  contract,
  agent: agentAddress,
  reasoningHash,
  seq,
  txHash,
  explorer: txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null,
}));

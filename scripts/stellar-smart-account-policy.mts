/**
 * Smart-account spending-policy demo (Stellar testnet, OpenZeppelin account).
 *
 * Proves the DiversiFi trust model on-chain in Stellar terms: a smart account
 * whose only signer is an external Ed25519 key (the "Guardian agent key")
 * executes XLM transfers ONLY inside a spending-limit policy installed on a
 * CallContract context rule — the on-chain analogue of an ERC-7715 grant.
 *
 * Demo shape: within-limit transfer succeeds; over-limit transfer is rejected
 * by the policy contract. Both transactions are real testnet transactions.
 *
 * Uses the Protocol-27 deployed contracts from the smart-account-kit manifest:
 *   account wasm  1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a
 *   ed25519 verif CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4
 *   spending lim. CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G
 *   native XLM SAC CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
 *
 * Run:
 *   STELLAR_AGENT_SECRET=$(stellar keys secret guardian-agent) \
 *   STELLAR_FEE_SECRET=$(stellar keys secret testnet-user) \
 *   STELLAR_SMART_ACCOUNT=<C...> npx tsx scripts/stellar-smart-account-policy.ts
 */

import {
  Address,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  Ed25519Signer,
  computeEntryAuthDigest,
  signerToScVal,
} from "smart-account-kit";
import { scValToNative } from "@stellar/stellar-sdk";
import type { Signer as ContractSigner } from "smart-account-kit-bindings";

const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON = "https://horizon-testnet.stellar.org";
const PASS = Networks.TESTNET;

const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const SPENDING_POLICY = "CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G";
const ED25519_VERIFIER = "CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4";

const LIMIT_STROOPS = 20_000_000n; // 2 XLM per period
const PERIOD_LEDGERS = 17_280;     // ~1 day at 5s ledgers
const WITHIN_LIMIT = 10_000_000n;  // 1 XLM — should succeed
const OVER_LIMIT = 50_000_000n;    // 5 XLM — the policy must reject

const server = new rpc.Server(RPC_URL);
const horizon = new Horizon.Server(HORIZON);

const REQUIRED = ["STELLAR_AGENT_SECRET", "STELLAR_FEE_SECRET", "STELLAR_SMART_ACCOUNT"] as const;
for (const k of REQUIRED) {
  if (!process.env[k]) throw new Error(`missing env ${k}`);
}
const agent = Ed25519Signer.fromSecret(process.env.STELLAR_AGENT_SECRET!, ED25519_VERIFIER);
const feePayer = Keypair.fromSecret(process.env.STELLAR_FEE_SECRET!);
const ACCOUNT = process.env.STELLAR_SMART_ACCOUNT!;
const RECIPIENT = process.env.STELLAR_RECIPIENT ?? "GDFEW24MNJL2KOGFP6WQ6NTTLK6ZYFXHRRLYTNQHGMAH4V55R2GHFCWK"; // alice

// ── Auth payload (AuthPayload { context_rule_ids: Vec<u32>, signers: Map<Signer, Bytes> }) ──
function authPayloadScVal(ruleIds: number[], signer: ContractSigner, signature: Buffer): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("context_rule_ids"),
      val: xdr.ScVal.scvVec(ruleIds.map((id) => xdr.ScVal.scvU32(id))),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signers"),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: signerToScVal(signer), val: xdr.ScVal.scvBytes(signature) }),
      ]),
    }),
  ]);
}

async function signAccountEntry(
  entry: xdr.SorobanAuthorizationEntry,
  ruleIds: number[],
  expiration: number,
): Promise<xdr.SorobanAuthorizationEntry> {
  const creds = entry.credentials().address();
  const addr = creds.address();
  if (addr.switch().name !== "scAddressTypeContract") return entry;
  if (Address.fromScAddress(addr).toString() !== ACCOUNT) return entry;
  // computeEntryAuthDigest writes creds.signatureExpirationLedger(expiration) itself.
  const { authDigest } = computeEntryAuthDigest(PASS, entry, expiration, ruleIds);
  const sig = agent.signAuthDigest(authDigest);
  creds.signature(authPayloadScVal(ruleIds, agent.signer, sig));
  return entry;
}

async function submit(
  label: string,
  hostFunc: xdr.HostFunction,
  ruleIds: number[],
): Promise<{ hash: string; status: string }> {
  const source = await server.getAccount(feePayer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: [] }))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.log(JSON.stringify({ step: label, status: "simulation-failed", error: sim.error }));
    return { hash: "", status: `simulation-failed: ${sim.error}` };
  }
  const simAuth = sim.result?.auth ?? [];
  const latest = await server.getLatestLedger();
  const expiration = latest.sequence + 600;
  const signed = await Promise.all(simAuth.map((e) => signAccountEntry(e, ruleIds, expiration)));
  let assembled;
  try {
    assembled = await resimulateForSubmit(source, hostFunc, signed);
  } catch (e) {
    // A policy/context-rule rejection surfaces at resimulation — this IS the
    // expected outcome for the over-limit leg.
    const msg = e instanceof Error ? e.message : String(e);
    console.log(JSON.stringify({ step: label, status: "rejected", detail: msg.split("\n")[0] }));
    return { hash: "", status: "rejected" };
  }
  assembled.sign(feePayer);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") {
    return { hash: sent.hash, status: `submit-error: ${sent.errorResult?.toXDR("base64") ?? "unknown"}` };
  }
  // Poll
  for (let i = 0; i < 30; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log(JSON.stringify({ step: label, hash: sent.hash, status: "SUCCESS", explorer: `https://stellar.expert/explorer/testnet/tx/${sent.hash}` }));
      return { hash: sent.hash, status: "SUCCESS" };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      const diag = res.resultXdr?.result().toXDR("base64");
      console.log(JSON.stringify({ step: label, hash: sent.hash, status: "FAILED", result: diag, explorer: `https://stellar.expert/explorer/testnet/tx/${sent.hash}` }));
      return { hash: sent.hash, status: "FAILED" };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { hash: sent.hash, status: "timeout-polling" };
}

// Minimal re-simulate + assemble (mirrors kit's resimulateAndAssemble without its deployer checks).
// NOTE: refetches the source — TransactionBuilder mutates Account.sequence.
async function resimulateForSubmit(
  _source: Awaited<ReturnType<typeof server.getAccount>>,
  hostFunc: xdr.HostFunction,
  signedAuth: xdr.SorobanAuthorizationEntry[],
) {
  const fresh = await server.getAccount(feePayer.publicKey());
  const tx = new TransactionBuilder(fresh, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: signedAuth }))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`resim failed: ${sim.error}`);
  return rpc.assembleTransaction(tx, sim).build();
}

function invokeContract(contractId: string, fn: string, args: xdr.ScVal[]): xdr.HostFunction {
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(contractId).toScAddress(),
      functionName: fn,
      args,
    }),
  );
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ account: ACCOUNT, agent: agent.address, policy: SPENDING_POLICY }));

  // ── 1. Fund check — smart account must hold XLM in the SAC.
  // (Funding itself is a SAC `transfer` into the C-address; do it via
  //  `stellar contract invoke --id <XLM_SAC> -- transfer --from <payer>
  //   --to <account> --amount <stroops>` — classic `payment` cannot target
  //  contract addresses.)
  const balVal = await (async () => {
    const source = await server.getAccount(feePayer.publicKey());
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASS })
      .addOperation(Operation.invokeHostFunction({ func: invokeContract(XLM_SAC, "balance", [Address.fromString(ACCOUNT).toScVal()]), auth: [] }))
      .setTimeout(60)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`balance sim failed: ${sim.error}`);
    return sim.result?.retval;
  })();
  const balance = balVal ? BigInt(scValToNative(balVal) as string | number | bigint) : 0n;
  console.log(JSON.stringify({ step: "balance", xlmStroops: balance.toString() }));
  if (balance < OVER_LIMIT) throw new Error("smart account underfunded — fund via SAC transfer first");

  // ── 2. Discover context rules (simulation only — read calls don't submit) ──
  async function simOnly(hostFunc: xdr.HostFunction) {
    const source = await server.getAccount(feePayer.publicKey());
    const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASS })
      .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: [] }))
      .setTimeout(60)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`sim failed: ${sim.error}`);
    return sim.result?.retval;
  }
  interface RuleShape { id: number; context_type: Record<string, unknown> | string }
  async function listRules(): Promise<RuleShape[]> {
    const countVal = await simOnly(invokeContract(ACCOUNT, "get_context_rules_count", []));
    const count = countVal ? Number(scValToNative(countVal)) : 0;
    const rules: RuleShape[] = [];
    for (let i = 0; i < count; i++) {
      const val = await simOnly(invokeContract(ACCOUNT, "get_context_rule", [xdr.ScVal.scvU32(i)]));
      if (val) rules.push(scValToNative(val) as RuleShape);
    }
    return rules;
  }
  const existing = await listRules();
  console.log(JSON.stringify({ step: "rules", rules: existing.map((r) => ({ id: r.id, type: r.context_type })) }));
  const ruleTag = (r: RuleShape): string =>
    Array.isArray(r.context_type) ? String(r.context_type[0])
    : typeof r.context_type === "object" ? Object.keys(r.context_type)[0]
    : String(r.context_type);
  // The constructor created one Default rule; mutations are authorized via it.
  const defaultRule = existing.find((r) => ruleTag(r) === "Default")?.id ?? existing[0]?.id ?? 0;

  // ── 3. Install the spending-limit policy on CallContract(XLM SAC) ──
  let xlmRuleId = existing.find((r) => ruleTag(r) === "CallContract")?.id;
  if (xlmRuleId === undefined) {
    const contextType = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("CallContract"),
    Address.fromString(XLM_SAC).toScVal(),
  ]);
  const signers = xdr.ScVal.scvVec([signerToScVal(agent.signer)]);
  const policies = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: Address.fromString(SPENDING_POLICY).toScVal(),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("period_ledgers"), val: xdr.ScVal.scvU32(PERIOD_LEDGERS) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("spending_limit"), val: nativeToScVal(LIMIT_STROOPS, { type: "i128" }) }),
      ]),
    }),
  ]);
    const ruleRes = await submit(
      "install-policy",
      invokeContract(ACCOUNT, "add_context_rule", [
        contextType,
        nativeToScVal("xlm-daily-cap", { type: "string" }),
        xdr.ScVal.scvVoid(), // valid_until: None
        signers,
        policies,
      ]),
      [defaultRule],
    );
    if (ruleRes.status !== "SUCCESS") throw new Error(`policy install failed: ${ruleRes.status}`);
    const after = await listRules();
    xlmRuleId = after.find((r) => ruleTag(r) === "CallContract")?.id;
  }
  if (xlmRuleId === undefined) throw new Error("CallContract rule not found");
  console.log(JSON.stringify({ step: "rule-ready", ruleId: xlmRuleId }));

  // ── 4. Within-limit transfer — expected SUCCESS ──
  const ok = await submit(
    "within-limit-transfer-1XLM",
    invokeContract(XLM_SAC, "transfer", [
      Address.fromString(ACCOUNT).toScVal(),
      Address.fromString(RECIPIENT).toScVal(),
      nativeToScVal(WITHIN_LIMIT, { type: "i128" }),
    ]),
    [xlmRuleId],
  );

  // ── 5. Over-limit transfer — expected FAIL (policy rejects) ──
  const over = await submit(
    "over-limit-transfer-5XLM",
    invokeContract(XLM_SAC, "transfer", [
      Address.fromString(ACCOUNT).toScVal(),
      Address.fromString(RECIPIENT).toScVal(),
      nativeToScVal(OVER_LIMIT, { type: "i128" }),
    ]),
    [xlmRuleId],
  );

  console.log(JSON.stringify({
    verdict: {
      withinLimitSucceeded: ok.status === "SUCCESS",
      overLimitRejected: over.status !== "SUCCESS",
    },
  }, null, 2));
  if (ok.status !== "SUCCESS" || over.status === "SUCCESS") process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});

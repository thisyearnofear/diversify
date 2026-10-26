/**
 * Shared OpenZeppelin smart-account invocation machinery (Stellar testnet).
 *
 * Extracted from the policy demo so every script that drives the
 * policy-bound account shares one implementation of the auth-entry signing
 * path: AuthPayload { context_rule_ids, signers } → computeEntryAuthDigest
 * → agent Ed25519 signature → resimulate → submit. Nothing here logs —
 * callers own their output.
 *
 * Deployed protocol-27 contracts (smart-account-kit manifest):
 *   ed25519 verif CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4
 *   spending lim. CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G
 *   native XLM SAC CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
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
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { execFileSync } from "node:child_process";
import {
  Ed25519Signer,
  computeEntryAuthDigest,
  signerToScVal,
} from "smart-account-kit";
import type { Signer as ContractSigner } from "smart-account-kit-bindings";

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const PASSPHRASE = Networks.TESTNET;

export const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const SPENDING_POLICY = "CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G";
export const ED25519_VERIFIER = "CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4";
export const LEDGER_CONTRACT = "CDQUT55ICBFEC6JGMZDJEHA47ECWQOAYHLNFHO2ULFLDQVIDNMKL4WT6";
/** Deployed policy-bound account (reference.md §4.6). Public info, not a secret. */
export const DEFAULT_SMART_ACCOUNT = "CBH5NT2HEIQGBMTABOPRPRUJKDNHU3HFIY6STSN7QZSCX7WXSLCOAVC2";

export interface SmartAccountContext {
  server: rpc.Server;
  horizon: Horizon.Server;
  agent: Ed25519Signer;
  feePayer: Keypair;
  account: string;
}

/**
 * Resolve signing material: explicit env secrets win; otherwise read the
 * stellar keyring by alias so secrets never sit in env files. The account
 * address is public and defaults to the deployed one.
 */
export function smartAccountContext(opts: { agentAlias?: string; feeAlias?: string } = {}): SmartAccountContext {
  const keyringSecret = (alias: string): string =>
    execFileSync("stellar", ["keys", "secret", alias], { encoding: "utf8" }).trim();
  const agentSecret = process.env.STELLAR_AGENT_SECRET
    ?? keyringSecret(opts.agentAlias ?? "guardian-agent");
  const feeSecret = process.env.STELLAR_FEE_SECRET
    ?? keyringSecret(opts.feeAlias ?? "testnet-user");
  const account = process.env.STELLAR_SMART_ACCOUNT ?? DEFAULT_SMART_ACCOUNT;
  return {
    server: new rpc.Server(RPC_URL),
    horizon: new Horizon.Server(HORIZON_URL),
    agent: Ed25519Signer.fromSecret(agentSecret, ED25519_VERIFIER),
    feePayer: Keypair.fromSecret(feeSecret),
    account,
  };
}

export function invokeContract(contractId: string, fn: string, args: xdr.ScVal[]): xdr.HostFunction {
  return xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(contractId).toScAddress(),
      functionName: fn,
      args,
    }),
  );
}

/** AuthPayload { context_rule_ids: Vec<u32>, signers: Map<Signer, Bytes> }. */
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
  ctx: SmartAccountContext,
  entry: xdr.SorobanAuthorizationEntry,
  ruleIds: number[],
  expiration: number,
): Promise<xdr.SorobanAuthorizationEntry> {
  const creds = entry.credentials().address();
  const addr = creds.address();
  if (addr.switch().name !== "scAddressTypeContract") return entry;
  if (Address.fromScAddress(addr).toString() !== ctx.account) return entry;
  // computeEntryAuthDigest writes creds.signatureExpirationLedger(expiration) itself.
  const { authDigest } = computeEntryAuthDigest(PASSPHRASE, entry, expiration, ruleIds);
  const sig = ctx.agent.signAuthDigest(authDigest);
  creds.signature(authPayloadScVal(ruleIds, ctx.agent.signer, sig));
  return entry;
}

// Minimal re-simulate + assemble (mirrors kit's resimulateAndAssemble without
// its deployer checks). Refetches the source — TransactionBuilder mutates
// Account.sequence.
async function resimulateForSubmit(
  ctx: SmartAccountContext,
  hostFunc: xdr.HostFunction,
  signedAuth: xdr.SorobanAuthorizationEntry[],
) {
  const fresh = await ctx.server.getAccount(ctx.feePayer.publicKey());
  const tx = new TransactionBuilder(fresh, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: signedAuth }))
    .setTimeout(120)
    .build();
  const sim = await ctx.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`resim failed: ${sim.error}`);
  return rpc.assembleTransaction(tx, sim).build();
}

export interface SubmitResult {
  hash: string;
  status: "SUCCESS" | "FAILED" | "rejected" | "simulation-failed" | "timeout" | "submit-error";
  detail?: string;
}

/** Sign, simulate, assemble, submit, poll — returns the outcome, never logs. */
export async function submitHostFunction(
  ctx: SmartAccountContext,
  hostFunc: xdr.HostFunction,
  ruleIds: number[],
): Promise<SubmitResult> {
  const source = await ctx.server.getAccount(ctx.feePayer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: [] }))
    .setTimeout(120)
    .build();
  const sim = await ctx.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    return { hash: "", status: "simulation-failed", detail: sim.error };
  }
  const simAuth = sim.result?.auth ?? [];
  const latest = await ctx.server.getLatestLedger();
  const expiration = latest.sequence + 600;
  const signed = await Promise.all(simAuth.map((e) => signAccountEntry(ctx, e, ruleIds, expiration)));
  let assembled;
  try {
    assembled = await resimulateForSubmit(ctx, hostFunc, signed);
  } catch (e) {
    // A policy/context-rule rejection surfaces at resimulation — that IS the
    // enforced outcome, not an exception path.
    const msg = e instanceof Error ? e.message : String(e);
    return { hash: "", status: "rejected", detail: msg.split("\n")[0] };
  }
  assembled.sign(ctx.feePayer);
  const sent = await ctx.server.sendTransaction(assembled);
  if (sent.status === "ERROR") {
    return {
      hash: sent.hash,
      status: "submit-error",
      detail: sent.errorResult?.toXDR("base64") ?? "unknown",
    };
  }
  for (let i = 0; i < 30; i++) {
    const res = await ctx.server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: sent.hash, status: "SUCCESS" };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      return {
        hash: sent.hash,
        status: "FAILED",
        detail: res.resultXdr?.result().toXDR("base64"),
      };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { hash: sent.hash, status: "timeout" };
}

/** Read-only contract call — simulated, never submitted. */
export async function simulateCall(ctx: SmartAccountContext, hostFunc: xdr.HostFunction) {
  const source = await ctx.server.getAccount(ctx.feePayer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeHostFunction({ func: hostFunc, auth: [] }))
    .setTimeout(60)
    .build();
  const sim = await ctx.server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`sim failed: ${sim.error}`);
  return sim.result?.retval;
}

export interface ContextRuleShape {
  id: number;
  context_type: Record<string, unknown> | string;
}

export async function listContextRules(ctx: SmartAccountContext): Promise<ContextRuleShape[]> {
  const countVal = await simulateCall(ctx, invokeContract(ctx.account, "get_context_rules_count", []));
  const count = countVal ? Number(scValToNative(countVal)) : 0;
  const rules: ContextRuleShape[] = [];
  for (let i = 0; i < count; i++) {
    const val = await simulateCall(ctx, invokeContract(ctx.account, "get_context_rule", [xdr.ScVal.scvU32(i)]));
    if (val) rules.push(scValToNative(val) as ContextRuleShape);
  }
  return rules;
}

export function ruleTag(r: ContextRuleShape): string {
  return Array.isArray(r.context_type)
    ? String(r.context_type[0])
    : typeof r.context_type === "object"
      ? Object.keys(r.context_type)[0]
      : String(r.context_type);
}

/** XLM balance the smart account holds in the SAC, in stroops. */
export async function sacBalance(ctx: SmartAccountContext): Promise<bigint> {
  const val = await simulateCall(
    ctx,
    invokeContract(XLM_SAC, "balance", [Address.fromString(ctx.account).toScVal()]),
  );
  return val ? BigInt(scValToNative(val) as string | number | bigint) : 0n;
}

/**
 * Ensure the CallContract(XLM SAC) context rule exists with the spending-
 * limit policy installed. Returns the rule id; installs it via the account's
 * Default rule when missing (mutation is authorized by the constructor rule).
 */
export async function ensureSpendingLimitRule(
  ctx: SmartAccountContext,
  opts: { limitStroops: bigint; periodLedgers: number; name?: string },
): Promise<{ ruleId: number; installed: boolean }> {
  const existing = await listContextRules(ctx);
  const found = existing.find((r) => ruleTag(r) === "CallContract")?.id;
  if (found !== undefined) return { ruleId: found, installed: false };

  const defaultRule = existing.find((r) => ruleTag(r) === "Default")?.id ?? existing[0]?.id ?? 0;
  const contextType = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("CallContract"),
    Address.fromString(XLM_SAC).toScVal(),
  ]);
  const signers = xdr.ScVal.scvVec([signerToScVal(ctx.agent.signer)]);
  const policies = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: Address.fromString(SPENDING_POLICY).toScVal(),
      val: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("period_ledgers"), val: xdr.ScVal.scvU32(opts.periodLedgers) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("spending_limit"), val: nativeToScVal(opts.limitStroops, { type: "i128" }) }),
      ]),
    }),
  ]);
  const res = await submitHostFunction(
    ctx,
    invokeContract(ctx.account, "add_context_rule", [
      contextType,
      nativeToScVal(opts.name ?? "xlm-daily-cap", { type: "string" }),
      xdr.ScVal.scvVoid(),
      signers,
      policies,
    ]),
    [defaultRule],
  );
  if (res.status !== "SUCCESS") throw new Error(`policy install failed: ${res.status} ${res.detail ?? ""}`);
  const after = await listContextRules(ctx);
  const ruleId = after.find((r) => ruleTag(r) === "CallContract")?.id;
  if (ruleId === undefined) throw new Error("CallContract rule not found after install");
  return { ruleId, installed: true };
}

/** Policy-bound XLM transfer out of the smart account via the SAC. */
export async function policyBoundTransfer(
  ctx: SmartAccountContext,
  ruleId: number,
  recipient: string,
  amountStroops: bigint,
): Promise<SubmitResult> {
  return submitHostFunction(
    ctx,
    invokeContract(XLM_SAC, "transfer", [
      Address.fromString(ctx.account).toScVal(),
      Address.fromString(recipient).toScVal(),
      nativeToScVal(amountStroops, { type: "i128" }),
    ]),
    [ruleId],
  );
}

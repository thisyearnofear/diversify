/**
 * Claimable-balance corridor demo (Stellar testnet).
 *
 * An SME-style obligation as a classic protocol primitive: a payer parks a
 * bounded amount as a claimable balance addressed to a single claimant
 * (the treasury/counterparty), and only that claimant can claim it. No
 * trustline needed on the claimant side for native XLM.
 *
 * This is the "SME per-cycle proposal as a claimable balance" pattern —
 * the proposal exists on-chain and becomes spendable only when the
 * counterparty claims it.
 *
 * Run:
 *   STELLAR_SOURCE_SECRET=$(stellar keys secret testnet-user) \
 *   STELLAR_CLAIMANT_SECRET=$(stellar keys secret alice) \
 *   npx tsx scripts/stellar-claimable-balance.ts [--amount 5]
 */

import { Asset, BASE_FEE, Claimant, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON);

function flagValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const sourceSecret = process.env.STELLAR_SOURCE_SECRET;
  const claimantSecret = process.env.STELLAR_CLAIMANT_SECRET;
  if (!sourceSecret || !claimantSecret) {
    throw new Error("Set STELLAR_SOURCE_SECRET and STELLAR_CLAIMANT_SECRET (e.g. via `stellar keys secret`)");
  }
  const payer = Keypair.fromSecret(sourceSecret);
  const claimant = Keypair.fromSecret(claimantSecret);
  const amount = flagValue("--amount") ?? "5";

  // ── Create ──────────────────────────────────────────────────────────
  const payerAccount = await server.loadAccount(payer.publicKey());
  const createTx = new TransactionBuilder(payerAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.createClaimableBalance({
      asset: Asset.native(),
      amount,
      claimants: [new Claimant(claimant.publicKey())],
    }))
    .setTimeout(120)
    .build();
  createTx.sign(payer);
  const created = await server.submitTransaction(createTx);
  console.log(JSON.stringify({ step: "create", hash: created.hash, explorer: `https://stellar.expert/explorer/testnet/tx/${created.hash}` }));

  // ── Locate the balance ───────────────────────────────────────────────
  const balances = await server.claimableBalances().claimant(claimant.publicKey()).limit(1).order("desc").call();
  const balance = balances.records[0];
  if (!balance) throw new Error("no claimable balance found for claimant");
  console.log(JSON.stringify({ step: "located", balanceId: balance.id, amount: balance.amount }));

  // ── Claim ────────────────────────────────────────────────────────────
  const claimantAccount = await server.loadAccount(claimant.publicKey());
  const claimTx = new TransactionBuilder(claimantAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.claimClaimableBalance({ balanceId: balance.id }))
    .setTimeout(120)
    .build();
  claimTx.sign(claimant);
  const claimed = await server.submitTransaction(claimTx);
  console.log(JSON.stringify({
    step: "claim",
    hash: claimed.hash,
    claimant: claimant.publicKey(),
    explorer: `https://stellar.expert/explorer/testnet/tx/${claimed.hash}`,
  }));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

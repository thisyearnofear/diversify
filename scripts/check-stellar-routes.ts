/**
 * Read-only Stellar testnet path check.
 *
 * Asks Horizon whether a strict-send XLM → Circle testnet USDC path exists.
 * No wallet, no signature, no submission. A missing path is a result, not a
 * fabricated price.
 *
 * Run: pnpm check-stellar-routes
 */

import { Asset, Horizon } from "@stellar/stellar-sdk";
import { STELLAR_HORIZON_TESTNET, STELLAR_TESTNET_USDC_ISSUER } from "../packages/shared/src/types/stellar";

const SOURCE_AMOUNT = "10";

export async function checkStellarRoute(server = new Horizon.Server(STELLAR_HORIZON_TESTNET)): Promise<{
  ok: boolean;
  sourceAmount: string;
  destinationAmount: string | null;
  pathLength: number;
}> {
  const page = await server.strictSendPaths(
    Asset.native(),
    SOURCE_AMOUNT,
    [new Asset("USDC", STELLAR_TESTNET_USDC_ISSUER)],
  ).call();
  const record = page.records[0];
  if (!record) return { ok: false, sourceAmount: SOURCE_AMOUNT, destinationAmount: null, pathLength: 0 };
  return {
    ok: /^\d+\.\d{7}$/.test(record.destination_amount) && record.destination_amount !== "0.0000000",
    sourceAmount: record.source_amount,
    destinationAmount: record.destination_amount,
    pathLength: record.path.length,
  };
}

if (process.argv[1]?.endsWith("check-stellar-routes.ts")) {
  checkStellarRoute()
    .then((result) => {
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

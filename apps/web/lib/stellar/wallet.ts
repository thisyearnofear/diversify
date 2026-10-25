/**
 * Freighter bridge. Browser only. Never called from a model tool or after an
 * unrelated await — the review control must invoke `sign` from the click.
 *
 * Freighter 6.0.1 signs with `networkPassphrase` only. Passing `network` as
 * well makes the installed types' passphrase field get ignored.
 */

import { StrKey } from "@stellar/stellar-sdk";
import { STELLAR_TESTNET_PASSPHRASE } from "@diversifi/shared/src/types/stellar";

export type WalletSession = {
  address: string;
  networkPassphrase: string;
};

export type WalletBridge = {
  isAvailable(): Promise<boolean>;
  connect(): Promise<{ address: string } | { error: string }>;
  network(): Promise<{ networkPassphrase: string } | { error: string }>;
  sign(xdr: string, address: string): Promise<{ signedTxXdr: string; signerAddress: string } | { error: string; rejected: boolean }>;
};

type FreighterModule = typeof import("@stellar/freighter-api");

async function freighter(): Promise<FreighterModule> {
  return import("@stellar/freighter-api");
}

export function createFreighterBridge(): WalletBridge {
  return {
    async isAvailable() {
      try {
        const { isConnected } = await freighter();
        const result = await isConnected();
        return result.isConnected === true && !result.error;
      } catch {
        return false;
      }
    },
    async connect() {
      try {
        const { requestAccess } = await freighter();
        const result = await requestAccess();
        if (result.error || !result.address || !StrKey.isValidEd25519PublicKey(result.address)) {
          return { error: result.error?.message ?? "Freighter did not return a classic account." };
        }
        return { address: result.address };
      } catch {
        return { error: "Freighter is not available in this browser." };
      }
    },
    async network() {
      try {
        const { getNetworkDetails } = await freighter();
        const result = await getNetworkDetails();
        if (result.error || !result.networkPassphrase) {
          return { error: result.error?.message ?? "Freighter did not report a network." };
        }
        return { networkPassphrase: result.networkPassphrase };
      } catch {
        return { error: "Freighter is not available in this browser." };
      }
    },
    async sign(xdr, address) {
      try {
        const { signTransaction } = await freighter();
        const result = await signTransaction(xdr, {
          networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
          address,
        });
        if (result.error || !result.signedTxXdr || !result.signerAddress) {
          const message = result.error?.message ?? "Freighter did not return a signature.";
          return { error: message, rejected: /reject/i.test(message) };
        }
        return { signedTxXdr: result.signedTxXdr, signerAddress: result.signerAddress };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Freighter signing failed.";
        return { error: message, rejected: /reject/i.test(message) };
      }
    },
  };
}

/**
 * Stellar wallet bridge. Browser only. Never called from a model tool or after
 * an unrelated await — the review control must invoke `sign` from the click.
 *
 * Two backends:
 * - `createWalletsKitBridge` (default): StellarWalletsKit's auth modal — one
 *   picker covering Freighter, LOBSTR, xBull, Albedo, Hana and Rabet.
 *   Dynamically imported; WalletConnect-based wallets (mobile LOBSTR) need a
 *   WalletConnect project id — not wired yet.
 * - `createFreighterBridge`: direct @stellar/freighter-api path, kept for
 *   tests and as the degraded fallback if the kit fails to load.
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
  /** Read-only. Never prompts; reports the address Freighter already exposes. */
  currentAccount(): Promise<{ address: string } | { error: string }>;
  network(): Promise<{ networkPassphrase: string } | { error: string }>;
  sign(xdr: string, address: string): Promise<{ signedTxXdr: string; signerAddress: string } | { error: string; rejected: boolean }>;
};

type FreighterModule = typeof import("@stellar/freighter-api");
type WalletsKitModule = typeof import("@creit.tech/stellar-wallets-kit");

async function freighter(): Promise<FreighterModule> {
  return import("@stellar/freighter-api");
}

let kitReady = false;
async function ensureKit(): Promise<WalletsKitModule> {
  const kit = await import("@creit.tech/stellar-wallets-kit");
  if (kitReady) return kit;
  const [
    { FreighterModule: SwkFreighterModule },
    { LobstrModule },
    { xBullModule },
    { AlbedoModule },
    { HanaModule },
    { RabetModule },
  ] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
    import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    import("@creit.tech/stellar-wallets-kit/modules/albedo"),
    import("@creit.tech/stellar-wallets-kit/modules/hana"),
    import("@creit.tech/stellar-wallets-kit/modules/rabet"),
  ]);
  kit.StellarWalletsKit.init({
    network: kit.Networks.TESTNET,
    modules: [
      new SwkFreighterModule(),
      new LobstrModule(),
      new xBullModule(),
      new AlbedoModule(),
      new HanaModule(),
      new RabetModule(),
    ],
  });
  kitReady = true;
  return kit;
}

/**
 * Multi-wallet bridge via StellarWalletsKit's auth modal. The picker is the
 * capability: even with no wallet detected it offers install paths, so
 * `isAvailable` reports kit readiness, not the presence of an extension.
 */
export function createWalletsKitBridge(): WalletBridge {
  async function load(): Promise<WalletsKitModule> {
    return ensureKit();
  }
  return {
    async isAvailable() {
      try {
        await load();
        return true;
      } catch {
        return false;
      }
    },
    async connect() {
      try {
        const { StellarWalletsKit } = await load();
        const { address } = await StellarWalletsKit.authModal();
        if (!address || !StrKey.isValidEd25519PublicKey(address)) {
          return { error: "The wallet did not return a classic account." };
        }
        return { address };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Wallet connection was closed.";
        return { error: message };
      }
    },
    async currentAccount() {
      try {
        const { StellarWalletsKit } = await load();
        const { address } = await StellarWalletsKit.getAddress();
        if (!address || !StrKey.isValidEd25519PublicKey(address)) {
          return { error: "The wallet did not return a classic account." };
        }
        return { address };
      } catch {
        return { error: "No connected wallet session." };
      }
    },
    async network() {
      try {
        const { StellarWalletsKit } = await load();
        const { networkPassphrase } = await StellarWalletsKit.getNetwork();
        if (!networkPassphrase) return { error: "The wallet did not report a network." };
        return { networkPassphrase };
      } catch {
        return { error: "The wallet did not report a network." };
      }
    },
    async sign(xdr, address) {
      try {
        const { StellarWalletsKit } = await load();
        const result = await StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
          address,
        });
        if (!result?.signedTxXdr) {
          return { error: "The wallet did not return a signature.", rejected: false };
        }
        return { signedTxXdr: result.signedTxXdr, signerAddress: result.signerAddress ?? address };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Wallet signing failed.";
        return { error: message, rejected: /reject|declin|cancel|closed/i.test(message) };
      }
    },
  };
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
    async currentAccount() {
      try {
        const { getAddress } = await freighter();
        const result = await getAddress();
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

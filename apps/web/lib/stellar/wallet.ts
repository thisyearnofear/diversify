/**
 * Stellar wallet bridge. Browser only. Never called from a model tool or after
 * an unrelated await — the review control must invoke `sign` from the click.
 *
 * Two backends:
 * - `createWalletsKitBridge` (default): StellarWalletsKit's auth modal — one
 *   picker covering Freighter, LOBSTR, xBull, Albedo, Hana and Rabet, plus
 *   WalletConnect (mobile wallets pairing by QR) when
 *   `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. Dynamically imported.
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
  /** Read-only. Never prompts; reports the address the wallet already exposes. */
  currentAccount(): Promise<{ address: string } | { error: string }>;
  /**
   * Silent session restore. Never prompts: adopts a remembered wallet session
   * only when the wallet can be asked for its address without any user
   * interaction, and reports an error otherwise ("reconnect by choice").
   */
  restore(): Promise<{ address: string } | { error: string }>;
  /** Tears the wallet-side session down so a later restore can't re-adopt it. */
  disconnect(): Promise<void>;
  network(): Promise<{ networkPassphrase: string } | { error: string }>;
  sign(xdr: string, address: string): Promise<{ signedTxXdr: string; signerAddress: string } | { error: string; rejected: boolean }>;
};

/**
 * Wallets whose address can be read WITHOUT any user interaction. Rabet
 * (connect popup), xBull (bridge connect), Albedo (web popup) and
 * WalletConnect (pairing modal) all prompt — a remembered session with one of
 * those is re-established by explicit choice only.
 */
const SILENT_RESTORE_WALLETS = new Set(["freighter", "lobstr", "hana"]);

// The kit's own persisted session markers (its `LocalStorageKeys`). Cleared on
// disconnect even when the kit chunk is unavailable — otherwise the next
// silent restore would re-adopt the wallet the user just dropped.
const KIT_ACTIVE_ADDRESS_KEY = "@StellarWalletsKit/activeAddress";
const KIT_SELECTED_MODULE_ID_KEY = "@StellarWalletsKit/selectedModuleId";

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
  const modules: import("@creit.tech/stellar-wallets-kit/types").ModuleInterface[] = [
    new SwkFreighterModule(),
    new LobstrModule(),
    new xBullModule(),
    new AlbedoModule(),
    new HanaModule(),
    new RabetModule(),
  ];
  // WalletConnect is how mobile wallets (LOBSTR app, Freighter mobile)
  // reach a desktop browser session — only when a project id is configured.
  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (wcProjectId) {
    const { WalletConnectModule, WalletConnectTargetChain } = await import(
      "@creit.tech/stellar-wallets-kit/modules/wallet-connect"
    );
    modules.push(
      new WalletConnectModule({
        projectId: wcProjectId,
        metadata: {
          name: "DiversiFi",
          description: "DiversiFi — Guardian-guarded currency protection",
          url: "https://diversifi.persidian.com",
          icons: [],
        },
        allowedChains: [WalletConnectTargetChain.TESTNET],
      }),
    );
  }
  kit.StellarWalletsKit.init({
    network: kit.Networks.TESTNET,
    modules,
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
    async restore() {
      try {
        const { StellarWalletsKit } = await load();
        // `selectedModule` throws when no wallet is remembered — quiet.
        const remembered = StellarWalletsKit.selectedModule as { productId?: string };
        if (!SILENT_RESTORE_WALLETS.has(remembered.productId ?? "")) {
          return { error: "This wallet needs an explicit reconnect." };
        }
        // `getAddress` reads kit memory (possibly stale); `fetchAddress` asks
        // the wallet itself and updates it — silent for the wallets above.
        const { address } = await StellarWalletsKit.fetchAddress();
        if (!address || !StrKey.isValidEd25519PublicKey(address)) {
          return { error: "The wallet did not return a classic account." };
        }
        return { address };
      } catch {
        return { error: "No connected wallet session." };
      }
    },
    async disconnect() {
      // The remembered selection must go first and unconditionally — the kit
      // chunk may be unavailable exactly when the user is logging out.
      try {
        window.localStorage.removeItem(KIT_ACTIVE_ADDRESS_KEY);
        window.localStorage.removeItem(KIT_SELECTED_MODULE_ID_KEY);
      } catch {
        // Storage unavailable — the kit reset below may still clear it.
      }
      if (!kitReady) return; // no in-page kit session to tear down
      try {
        const { StellarWalletsKit } = await ensureKit();
        // Module-side teardown (WalletConnect signClient) + kit state reset.
        await StellarWalletsKit.disconnect();
      } catch {
        // Local session is already gone.
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

async function freighterAccount(): Promise<{ address: string } | { error: string }> {
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
      return freighterAccount();
    },
    async restore() {
      // Freighter's getAddress is already a silent read of the granted account.
      return freighterAccount();
    },
    async disconnect() {
      // Freighter keeps its own connection in the extension; the app simply
      // forgets it (the session store clears its remembered marker).
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

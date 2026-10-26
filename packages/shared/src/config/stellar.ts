/**
 * Stellar testnet configuration. No SDK import.
 *
 * The public flag only reveals the testnet entry. It does not authorize a
 * mainnet call, a user-supplied URL, or a production money feature.
 */

import {
  STELLAR_HORIZON_TESTNET,
  STELLAR_RPC_TESTNET,
  STELLAR_TESTNET,
  STELLAR_TESTNET_PASSPHRASE,
  disabledCapabilities,
  type StellarCapabilities,
} from "../types/stellar";

export type StellarEndpointConfig = {
  network: typeof STELLAR_TESTNET;
  passphrase: typeof STELLAR_TESTNET_PASSPHRASE;
  horizonUrl: string;
  rpcUrl: string;
  /** RPC is documented for later verification. P0 classic reads use Horizon. */
  rpcUsedForP0: false;
};

export function stellarTestnetEnabled(
  flag: string | undefined = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STELLAR_TESTNET : undefined,
): boolean {
  return flag === "true";
}

function fixedEndpoint(envValue: string | undefined, fallback: string, name: string): string {
  if (envValue === undefined || envValue === "") return fallback;
  if (!isTrustedStellarUrl(envValue, fallback)) {
    throw new Error(`${name} must be the documented Stellar testnet URL. Mainnet and custom endpoints are not accepted.`);
  }
  return fallback;
}

export function stellarEndpoints(): StellarEndpointConfig {
  return {
    network: STELLAR_TESTNET,
    passphrase: STELLAR_TESTNET_PASSPHRASE,
    horizonUrl: fixedEndpoint(process.env.STELLAR_HORIZON_URL, STELLAR_HORIZON_TESTNET, "STELLAR_HORIZON_URL"),
    rpcUrl: fixedEndpoint(process.env.STELLAR_RPC_URL, STELLAR_RPC_TESTNET, "STELLAR_RPC_URL"),
    rpcUsedForP0: false,
  };
}

/** Refuse any URL that is not the configured public testnet host. */
export function isTrustedStellarUrl(url: string, expected: string): boolean {
  try {
    const actual = new URL(url);
    const allowed = new URL(expected);
    return actual.protocol === "https:"
      && actual.host === allowed.host
      && actual.pathname === allowed.pathname
      && !actual.username && !actual.password && !actual.search && !actual.hash;
  } catch {
    return false;
  }
}

export function stellarCapabilities(input: {
  enabled: boolean;
  connected: boolean;
  correctNetwork: boolean;
  walletAvailable: boolean;
}): StellarCapabilities {
  if (!input.enabled) return disabledCapabilities();
  const ready = input.connected && input.correctNetwork && input.walletAvailable;
  return {
    ...disabledCapabilities(),
    enabled: true,
    canQuote: ready,
    canSign: ready,
    canSubmit: ready,
  };
}

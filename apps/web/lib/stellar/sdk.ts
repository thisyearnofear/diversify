/**
 * The only module that imports the Stellar SDK.
 * Callers dynamic-import this file so the SDK stays out of the first load
 * and out of `@diversifi/shared`.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  FeeBumpTransaction,
  Horizon,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { StellarAsset } from "@diversifi/shared/src/types/stellar";
import { STELLAR_TESTNET_PASSPHRASE } from "@diversifi/shared/src/types/stellar";

export const TESTNET_PASSPHRASE = Networks.TESTNET;
export const BASE_FEE_STROOPS = BASE_FEE;

if (TESTNET_PASSPHRASE !== STELLAR_TESTNET_PASSPHRASE) {
  throw new Error("Installed Stellar SDK testnet passphrase does not match the reviewed constant.");
}

export type HorizonServer = Horizon.Server;
export type BuiltTransaction = ReturnType<TransactionBuilder["build"]>;

export function createHorizon(url: string): Horizon.Server {
  return new Horizon.Server(url);
}

export function toSdkAsset(asset: StellarAsset): Asset {
  if (asset.kind === "native") return Asset.native();
  return new Asset(asset.code, asset.issuer);
}

export function fromSdkAsset(asset: Asset, network: StellarAsset["network"]): StellarAsset | null {
  if (asset.isNative()) return { network, kind: "native", code: "XLM", decimals: 7 };
  const issuer = asset.getIssuer();
  if (!issuer) return null;
  return { network, kind: "issued", code: asset.getCode(), issuer, decimals: 7 };
}

export { Account, Asset, FeeBumpTransaction, Horizon, Operation, StrKey, Transaction, TransactionBuilder, xdr };

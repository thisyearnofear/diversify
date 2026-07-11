/**
 * Circle Agent Wallet policy mapping.
 *
 * Translates the Guardian's signed spending permission (the app-layer bounds
 * defined in erc7715-service) into a Circle Agent Wallet **policy spec** —
 * time-bound USDC spend limits + a token allowlist that Circle enforces at
 * the WALLET layer, before a transaction is submitted on-chain.
 *
 * This is the concrete embodiment of the enforcement upgrade in
 * docs/guardian-enforcement-model.md: today those bounds are checked only in
 * application code (a compromised server could bypass them); mapped into a
 * Circle policy they are enforced by Circle's wallet infrastructure.
 *
 * Pure + deterministic on purpose: the spec is decoupled from whichever Circle
 * surface applies it (Agent Stack API / Circle CLI). Applying the spec is the
 * caller's job; this module only computes it.
 */

import type { SessionPermission, AllowedToken } from '../erc7715-service';

/** A single spending-limit rule in a Circle Agent Wallet policy. */
export interface CircleSpendLimitRule {
  /** ISO-4217-ish asset symbol the limit is denominated in (USDC for USD caps). */
  asset: 'USDC';
  /** Maximum amount spendable within the window. */
  amount: string;
  /** Rolling window the limit applies to. */
  window: 'day' | 'total';
}

/**
 * Circle Agent Wallet policy spec. Shape mirrors the Agent Stack policy
 * concepts (spending limits, allowlists, screening) without binding to a
 * specific SDK version, so it survives an Agent Stack API upgrade.
 */
export interface CircleAgentWalletPolicy {
  /** Time-bound USDC spend limits (daily + total). */
  spendLimits: CircleSpendLimitRule[];
  /** Token symbols the wallet may transact — everything else is blocked. */
  tokenAllowlist: AllowedToken[];
  /** Destination address allowlist; empty = no address restriction. */
  addressAllowlist: string[];
  /** Enforce Circle's sanctions screening before submission. */
  sanctionsScreening: boolean;
  /** Unix seconds after which the policy (and its permission) is void. */
  expiresAt: number;
  /** Chain the policy is scoped to. */
  chainId: number;
}

/**
 * Map a signed Guardian session permission to a Circle Agent Wallet policy.
 *
 * - `dailyLimitUSD`  → a `day`-window USDC spend limit
 * - `spendingLimitUSD` → a `total`-window USDC spend limit (0 = omit; unlimited total)
 * - `allowedTokens`  → the token allowlist
 * - `expiresAt` / `chainId` carried through
 * - sanctions screening is always on (compliance posture for EM markets)
 *
 * Throws on obviously-invalid bounds so a broken permission can't silently
 * produce a permissive policy.
 */
export function sessionPermissionToCirclePolicy(
  permission: SessionPermission,
): CircleAgentWalletPolicy {
  if (permission.dailyLimitUSD < 0 || permission.spendingLimitUSD < 0) {
    throw new Error('Circle policy: spending limits must be non-negative');
  }
  if (permission.allowedTokens.length === 0) {
    throw new Error('Circle policy: at least one allowed token is required (empty allowlist blocks everything)');
  }

  const spendLimits: CircleSpendLimitRule[] = [
    { asset: 'USDC', amount: permission.dailyLimitUSD.toString(), window: 'day' },
  ];
  // A total limit of 0 in the permission model means "no separate total cap"
  // (the daily cap governs); only add a total rule when one is set.
  if (permission.spendingLimitUSD > 0) {
    spendLimits.push({ asset: 'USDC', amount: permission.spendingLimitUSD.toString(), window: 'total' });
  }

  return {
    spendLimits,
    tokenAllowlist: [...permission.allowedTokens],
    addressAllowlist: [],
    sanctionsScreening: true,
    expiresAt: permission.expiresAt,
    chainId: permission.chainId,
  };
}

/**
 * Whether an app-layer permission and a Circle policy still agree. Useful as a
 * defense-in-depth check: if they drift, keep app-layer enforcement and flag it
 * rather than trusting a stale wallet policy.
 */
export function policyMatchesPermission(
  policy: CircleAgentWalletPolicy,
  permission: SessionPermission,
): boolean {
  const dayRule = policy.spendLimits.find((r) => r.window === 'day');
  const sameDaily = dayRule?.amount === permission.dailyLimitUSD.toString();
  const sameTokens =
    policy.tokenAllowlist.length === permission.allowedTokens.length &&
    policy.tokenAllowlist.every((t) => permission.allowedTokens.includes(t));
  const sameExpiry = policy.expiresAt === permission.expiresAt;
  const sameChain = policy.chainId === permission.chainId;
  return Boolean(sameDaily && sameTokens && sameExpiry && sameChain);
}

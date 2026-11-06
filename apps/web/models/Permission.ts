/**
 * Permission Model — MongoDB schema for ERC-7715-style agent permissions.
 *
 * Replaces the in-memory session store with persistent, auditable permissions.
 * The user signs an EIP-712 permission (verified server-side on write, see
 * `erc7715-service.ts`), which is cryptographic CONSENT that binds the grant to
 * the user's wallet.
 *
 * Enforcement is two-layer. The app layer gates every proposal
 * (`VaultService.validateSwap` + the guardian-loop gates: confidence, spend
 * caps, chain eligibility, provenance). On chains the MetaMask Advanced
 * Permissions kit supports — Celo, Celo Sepolia, Arbitrum, derived at
 * runtime from `getSmartAccountsEnvironment` in
 * `providers/metamask-delegation-provider.ts` — the granted caveats
 * additionally bind on-chain: the scoped session account redeems through
 * the user's own smart account DelegationManager, which enforces the
 * spend caps itself, and `revoke` there is an on-chain disable. Outside
 * those chains — or wherever ERC-7710 redeems are unavailable — the
 * permission is advisory-only and execution fails closed to one-tap
 * signing. There is no server-custodied Safe or vault key; the custodial
 * execution path was removed in `78b34139`. See `docs/guardian.md` for
 * the trust model.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type AutonomyLevel = 'ADVISORY' | 'COPILOT' | 'GUARDIAN';
export type PermissionStatus = 'active' | 'expired' | 'revoked';

export interface IPermission extends Document {
  vaultId: mongoose.Types.ObjectId;
  userAddress: string;

  // ERC-7715 fields (mirrors SessionPermission from erc7715-service.ts)
  sessionKeyAddress: string;
  spendingLimitUSD: number;
  dailyLimitUSD: number;
  allowedActions: string[];
  allowedTokens: string[];
  expiresAt: number;
  autonomyLevel: AutonomyLevel;
  chainId: number;
  nonce: string;

  // EIP-712 signature from user's wallet
  signature: string;
  signedAt: string;

  // Spending tracking
  spentTodayUSD: number;
  spentDate: string;
  totalSpentUSD: number;

  // Consent: set to true when user grants GUARDIAN-tier permission (explicit
  // EIP-712 consent for autonomous execution) or after first manual execution.
  firstAutoExecutionConfirmed: boolean;

  /**
   * Second-stage consent for cycle-aware Guardian execution (Phase 5). When
   * true, the Guardian loop may auto-execute a `CYCLE_PROTECTION` proposal
   * inside the 14-day payment window against the matching PurchaseCycle's
   * context, within the existing daily limit + GUARDIAN-tier gates.
   *
   * Distinct from `monitoringEnabled` on the cycle itself (which controls
   * whether cycle *proposals* get queued in the first place). Users opt
   * into proposals and auto-execution on separate signals so the leap from
   * "Guardian suggests" to "Guardian acts" remains explicit.
   *
   * Default false. Existing permissions in Mongo get `undefined` from
   * `.lean()`; the guardian-loop treats undefined the same as false.
   */
  autoExecuteCycleProtection?: boolean;

  /**
   * ERC-7715 grant context returned by wallet_requestExecutionPermissions —
   * the authority the Guardian session account redeems via ERC-7710 on the
   * user's own smart account. Absent on permissions granted before Advanced
   * Permissions existed; those users keep one-tap proposals.
   */
  delegationContext?: {
    context: string;
    delegationManager: string;
    dependencies: { factory: string; factoryData: string }[];
  } | null;

  // Status
  status: PermissionStatus;

  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true, index: true },
    userAddress: { type: String, required: true, lowercase: true },

    sessionKeyAddress: { type: String, required: true },
    spendingLimitUSD: { type: Number, required: true },
    dailyLimitUSD: { type: Number, required: true },
    allowedActions: { type: [String], default: [] },
    allowedTokens: { type: [String], default: [] },
    expiresAt: { type: Number, required: true },
    autonomyLevel: {
      type: String,
      enum: ['ADVISORY', 'COPILOT', 'GUARDIAN'],
      required: true,
    },
    chainId: { type: Number, required: true },
    nonce: { type: String, required: true },

    signature: { type: String, required: true },
    signedAt: { type: String, required: true },

    spentTodayUSD: { type: Number, default: 0 },
    spentDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    totalSpentUSD: { type: Number, default: 0 },

    firstAutoExecutionConfirmed: { type: Boolean, default: false },

    autoExecuteCycleProtection: { type: Boolean, default: false },

    delegationContext: {
      type: new Schema(
        {
          context: { type: String, required: true },
          delegationManager: { type: String, required: true },
          dependencies: [
            {
              factory: { type: String, required: true },
              factoryData: { type: String, required: true },
            },
          ],
        },
        { _id: false },
      ),
      default: null,
    },

    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// One active permission per vault at a time
PermissionSchema.index({ vaultId: 1, status: 1 });
PermissionSchema.index({ userAddress: 1, status: 1 });
PermissionSchema.index({ sessionKeyAddress: 1 });

export const Permission =
  mongoose.models.Permission || mongoose.model<IPermission>('Permission', PermissionSchema);

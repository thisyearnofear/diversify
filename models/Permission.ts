/**
 * Permission Model — MongoDB schema for ERC-7715-style agent permissions.
 *
 * Replaces the in-memory session store with persistent, auditable permissions.
 * The user signs an EIP-712 permission (verified server-side on write, see
 * `erc7715-service.ts`), which is cryptographic CONSENT that binds the grant to
 * the user's wallet.
 *
 * ⚠️ Enforcement is app-layer, not on-chain (today). On the production Celo /
 * Mento path the bounds in this document — `dailyLimitUSD`, `spendingLimitUSD`,
 * `allowedTokens`, `expiresAt`, `status` — are enforced only in application code
 * (`VaultService.validateSwap` + the guardian-loop gates), because execution
 * goes through a server-custodied smart account (Privy Safe) / `VAULT_PRIVATE_KEY`.
 * The signature is consent, NOT an on-chain spending constraint, and `revoke`
 * is a status flag here, not an on-chain revocation. True on-chain enforcement
 * (ERC-7710 redemption via a DelegationManager) exists in
 * `providers/metamask-delegation-provider.ts` but is dark and EIP-7702-only
 * (no Celo support). See `docs/guardian-enforcement-model.md` for the current
 * model, the residual gap, and the hybrid plan.
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

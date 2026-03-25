/**
 * Permission Model — MongoDB schema for ERC-7715 agent permissions.
 *
 * Replaces the in-memory session store with persistent, auditable permissions.
 * The user signs an EIP-712 permission granting the agent scoped spending authority.
 * The signature itself is the on-chain proof; this model is for server-side auth checks.
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

/**
 * Vault Model — MongoDB schema for user vaults.
 *
 * Each vault represents a user's managed portfolio:
 * - Circle MPC wallet holds the actual funds
 * - Strategy defines the allocation philosophy
 * - Permission tracks the ERC-7715 agent authorization
 * - Allocations are denormalized for fast reads
 */

import mongoose, { Schema, Document } from 'mongoose';

export type VaultStatus = 'active' | 'paused' | 'closed';
export type VaultType = 'circle' | 'erc4626';

export interface IVaultAllocation {
  token: string;
  tokenAddress: string;
  amount: string;
  valueUSD: number;
  region: string;
  chainId: number;
  percentage: number;
}

export interface IVault extends Document {
  userAddress: string;
  vaultType: VaultType;

  // Circle MPC wallet (Phase 1)
  circleWalletId?: string;
  circleWalletAddress?: string;

  // Smart contract vault (Phase 2)
  contractAddress?: string;
  contractChainId?: number;

  // Investment strategy
  strategy: string; // FinancialStrategy type

  // Status
  status: VaultStatus;

  // Balance tracking (denormalized, reconciled from chain)
  totalDepositedUSD: number;
  totalWithdrawnUSD: number;
  currentValueUSD: number;
  highWaterMarkUSD: number;

  // Allocation snapshot (updated after each rebalance)
  allocations: IVaultAllocation[];

  // Fee tracking
  totalFeesPaidUSD: number;
  feesPendingUSD: number;
  lastFeeChargeAt?: Date;

  // Active permission reference
  activePermissionId?: mongoose.Types.ObjectId;

  // Activity
  lastRebalanceAt?: Date;
  lastDepositAt?: Date;
  lastWithdrawalAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const VaultAllocationSchema = new Schema<IVaultAllocation>(
  {
    token: { type: String, required: true },
    tokenAddress: { type: String, required: true },
    amount: { type: String, required: true },
    valueUSD: { type: Number, required: true },
    region: { type: String, required: true },
    chainId: { type: Number, required: true },
    percentage: { type: Number, required: true },
  },
  { _id: false }
);

const VaultSchema = new Schema<IVault>(
  {
    userAddress: { type: String, required: true, lowercase: true, index: true },
    vaultType: { type: String, enum: ['circle', 'erc4626'], default: 'circle' },

    circleWalletId: { type: String, sparse: true },
    circleWalletAddress: { type: String, sparse: true },

    contractAddress: { type: String, sparse: true },
    contractChainId: { type: Number },

    strategy: { type: String, required: true, default: 'global' },
    status: { type: String, enum: ['active', 'paused', 'closed'], default: 'active' },

    totalDepositedUSD: { type: Number, default: 0 },
    totalWithdrawnUSD: { type: Number, default: 0 },
    currentValueUSD: { type: Number, default: 0 },
    highWaterMarkUSD: { type: Number, default: 0 },

    allocations: { type: [VaultAllocationSchema], default: [] },

    totalFeesPaidUSD: { type: Number, default: 0 },
    feesPendingUSD: { type: Number, default: 0 },
    lastFeeChargeAt: { type: Date },

    activePermissionId: { type: Schema.Types.ObjectId, ref: 'Permission' },

    lastRebalanceAt: { type: Date },
    lastDepositAt: { type: Date },
    lastWithdrawalAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// One vault per user address
VaultSchema.index({ userAddress: 1 }, { unique: true });
VaultSchema.index({ status: 1, lastRebalanceAt: 1 });

export const Vault = mongoose.models.Vault || mongoose.model<IVault>('Vault', VaultSchema);

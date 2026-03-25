/**
 * Transaction Model — MongoDB schema for vault transaction audit trail.
 *
 * Every on-chain action (deposit, withdraw, swap, fee deduction) produces
 * a Transaction record. This is the source of truth for:
 * - User-facing transaction history
 * - Fee calculation and audit
 * - OpenClaw receipt correlation
 */

import mongoose, { Schema, Document } from 'mongoose';

export type TransactionType = 'deposit' | 'withdraw' | 'swap' | 'rebalance' | 'fee_deduction' | 'approval';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type ExecutionLayer = 'circle_sdk' | 'openclaw' | 'direct_rpc';

export interface ITransaction extends Document {
  vaultId: mongoose.Types.ObjectId;
  userAddress: string;

  type: TransactionType;
  status: TransactionStatus;

  // Chain data
  chainId: number;
  txHash?: string;
  explorerUrl?: string;
  blockNumber?: number;

  // Swap-specific (null for deposits/withdrawals)
  tokenIn?: string;
  tokenInAddress?: string;
  tokenOut?: string;
  tokenOutAddress?: string;
  amountIn?: string;
  amountOut?: string;
  amountUSD: number;

  // Execution metadata
  executionLayer: ExecutionLayer;
  strategyUsed?: string;
  permissionId?: mongoose.Types.ObjectId;

  // Fee
  feeUSD: number;
  feePercentage: number;

  // OpenClaw correlation
  openclawRunId?: string;

  // Error tracking
  error?: string;

  createdAt: Date;
  confirmedAt?: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    vaultId: { type: Schema.Types.ObjectId, ref: 'Vault', required: true, index: true },
    userAddress: { type: String, required: true, lowercase: true, index: true },

    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'swap', 'rebalance', 'fee_deduction', 'approval'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
    },

    chainId: { type: Number, required: true },
    txHash: { type: String, sparse: true },
    explorerUrl: { type: String },
    blockNumber: { type: Number },

    tokenIn: { type: String },
    tokenInAddress: { type: String },
    tokenOut: { type: String },
    tokenOutAddress: { type: String },
    amountIn: { type: String },
    amountOut: { type: String },
    amountUSD: { type: Number, required: true },

    executionLayer: {
      type: String,
      enum: ['circle_sdk', 'openclaw', 'direct_rpc'],
      default: 'circle_sdk',
    },
    strategyUsed: { type: String },
    permissionId: { type: Schema.Types.ObjectId, ref: 'Permission' },

    feeUSD: { type: Number, default: 0 },
    feePercentage: { type: Number, default: 0 },

    openclawRunId: { type: String },

    error: { type: String },

    confirmedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Queries: vault history, user history, pending transactions
TransactionSchema.index({ vaultId: 1, createdAt: -1 });
TransactionSchema.index({ userAddress: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ txHash: 1 }, { sparse: true });

export const Transaction =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

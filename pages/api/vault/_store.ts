/**
 * Vault API Store — Bridges VaultService types to Mongoose models.
 * Used by all /api/vault/* endpoints.
 */

import mongoose from 'mongoose';
import { Vault, type IVault } from '../../../models/Vault';
import { Permission, type IPermission } from '../../../models/Permission';
import { Transaction, type ITransaction } from '../../../models/Transaction';
import type { VaultStore, Vault as VaultType, VaultPermission, VaultTransaction } from '../../../packages/shared/src/services/vault/vault.service';

function toVaultType(doc: IVault): VaultType {
  return {
    _id: doc._id.toString(),
    userAddress: doc.userAddress,
    vaultType: doc.vaultType,
    circleWalletId: doc.circleWalletId,
    circleWalletAddress: doc.circleWalletAddress,
    contractAddress: doc.contractAddress,
    strategy: doc.strategy,
    status: doc.status,
    totalDepositedUSD: doc.totalDepositedUSD,
    totalWithdrawnUSD: doc.totalWithdrawnUSD,
    currentValueUSD: doc.currentValueUSD,
    highWaterMarkUSD: doc.highWaterMarkUSD,
    allocations: doc.allocations.map(a => ({ ...a })),
    totalFeesPaidUSD: doc.totalFeesPaidUSD,
    feesPendingUSD: doc.feesPendingUSD,
    lastFeeChargeAt: doc.lastFeeChargeAt || undefined,
    lastRebalanceAt: doc.lastRebalanceAt || undefined,
    lastDepositAt: doc.lastDepositAt || undefined,
    lastWithdrawalAt: doc.lastWithdrawalAt || undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toPermissionType(doc: IPermission): VaultPermission {
  return {
    _id: doc._id.toString(),
    vaultId: doc.vaultId.toString(),
    userAddress: doc.userAddress,
    sessionKeyAddress: doc.sessionKeyAddress,
    spendingLimitUSD: doc.spendingLimitUSD,
    dailyLimitUSD: doc.dailyLimitUSD,
    allowedActions: doc.allowedActions,
    allowedTokens: doc.allowedTokens,
    expiresAt: doc.expiresAt,
    autonomyLevel: doc.autonomyLevel,
    chainId: doc.chainId,
    nonce: doc.nonce,
    signature: doc.signature,
    signedAt: doc.signedAt,
    spentTodayUSD: doc.spentTodayUSD,
    spentDate: doc.spentDate,
    totalSpentUSD: doc.totalSpentUSD,
    firstAutoExecutionConfirmed: doc.firstAutoExecutionConfirmed ?? false,
    autoExecuteCycleProtection: doc.autoExecuteCycleProtection ?? false,
    status: doc.status,
  };
}

export const vaultStore: VaultStore = {
  async findVaultByUser(userAddress: string) {
    const doc = await Vault.findOne({ userAddress: userAddress.toLowerCase() });
    return doc ? toVaultType(doc) : null;
  },

  async findVaultById(vaultId: string) {
    const doc = await Vault.findById(vaultId);
    return doc ? toVaultType(doc) : null;
  },

  async createVault(data) {
    const doc = await Vault.create(data);
    return toVaultType(doc);
  },

  async updateVault(vaultId: string, update: Partial<VaultType>) {
    const doc = await Vault.findByIdAndUpdate(vaultId, update, { new: true });
    if (!doc) throw new Error('Vault not found');
    return toVaultType(doc);
  },

  async findActivePermission(vaultId: string) {
    const doc = await Permission.findOne({
      vaultId: new mongoose.Types.ObjectId(vaultId),
      status: 'active',
    });
    return doc ? toPermissionType(doc) : null;
  },

  async createPermission(data) {
    const doc = await Permission.create(data);
    return toPermissionType(doc);
  },

  async updatePermission(permissionId: string, update: Partial<VaultPermission>) {
    await Permission.findByIdAndUpdate(permissionId, update);
  },

  async createTransaction(data) {
    const doc = await Transaction.create(data);
    return {
      ...data,
      _id: doc._id.toString(),
    } as VaultTransaction;
  },

  async findTransactions(vaultId: string, limit = 20) {
    const docs = await Transaction.find({ vaultId: new mongoose.Types.ObjectId(vaultId) })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(d => ({
      vaultId: d.vaultId.toString(),
      userAddress: d.userAddress,
      type: d.type,
      status: d.status,
      chainId: d.chainId,
      txHash: d.txHash,
      explorerUrl: d.explorerUrl,
      tokenIn: d.tokenIn,
      tokenOut: d.tokenOut,
      amountIn: d.amountIn,
      amountOut: d.amountOut,
      amountUSD: d.amountUSD,
      executionLayer: d.executionLayer,
      strategyUsed: d.strategyUsed,
      feeUSD: d.feeUSD,
      feePercentage: d.feePercentage,
      error: d.error,
      createdAt: d.createdAt?.toISOString?.() || new Date().toISOString(),
    })) as VaultTransaction[];
  },
};

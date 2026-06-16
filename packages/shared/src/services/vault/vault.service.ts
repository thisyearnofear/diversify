/**
 * Vault Service — Core vault management for DiversiFi.
 *
 * Manages the lifecycle of user vaults:
 * - Create vault with Circle MPC wallet
 * - Process deposits (user sends USDC to vault address)
 * - Execute withdrawals (vault sends USDC back to user)
 * - Rebalance portfolio under ERC-7715 permission constraints
 * - Track allocations, P&L, and fees
 *
 * Phase 1: Circle MPC wallets
 * Phase 2: ERC-4626 smart contracts (same interface, different execution layer)
 */

import { feeEngine, type FeeSummary } from './fee-engine';

// Types are defined here rather than importing from MongoDB models
// to keep the shared package decoupled from the app's DB layer.
// The API routes bridge between these types and the Mongoose models.

export type VaultStatus = 'active' | 'paused' | 'closed';
export type VaultType = 'circle' | 'erc4626' | 'earn-vault';

export interface VaultAllocation {
  token: string;
  tokenAddress: string;
  amount: string;
  valueUSD: number;
  region: string;
  chainId: number;
  percentage: number;
}

export interface Vault {
  _id: string;
  userAddress: string;
  vaultType: VaultType;
  circleWalletId?: string;
  circleWalletAddress?: string;
  contractAddress?: string;
  strategy: string;
  status: VaultStatus;
  totalDepositedUSD: number;
  totalWithdrawnUSD: number;
  currentValueUSD: number;
  highWaterMarkUSD: number;
  allocations: VaultAllocation[];
  totalFeesPaidUSD: number;
  feesPendingUSD: number;
  lastFeeChargeAt?: Date;
  lastRebalanceAt?: Date;
  lastDepositAt?: Date;
  lastWithdrawalAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultPermission {
  _id: string;
  vaultId: string;
  userAddress: string;
  sessionKeyAddress: string;
  spendingLimitUSD: number;
  dailyLimitUSD: number;
  allowedActions: string[];
  allowedTokens: string[];
  expiresAt: number;
  autonomyLevel: 'ADVISORY' | 'COPILOT' | 'GUARDIAN';
  chainId: number;
  nonce: string;
  signature: string;
  signedAt?: string;
  spentTodayUSD: number;
  spentDate: string;
  totalSpentUSD: number;
  status: 'active' | 'expired' | 'revoked';
}

export interface VaultTransaction {
  vaultId: string;
  userAddress: string;
  type: 'deposit' | 'withdraw' | 'swap' | 'rebalance' | 'fee_deduction';
  status: 'pending' | 'confirmed' | 'failed';
  chainId: number;
  txHash?: string;
  explorerUrl?: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  amountUSD: number;
  executionLayer: 'circle_sdk' | 'direct_rpc';
  strategyUsed?: string;
  feeUSD: number;
  feePercentage: number;
  error?: string;
  createdAt?: string;
}

export interface VaultSummary {
  vault: Vault;
  permission: VaultPermission | null;
  fees: FeeSummary;
  recentTransactions: VaultTransaction[];
  allocationByRegion: Record<string, { valueUSD: number; percentage: number }>;
}

export interface RebalanceRecommendation {
  action: 'swap';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  tokenIn: string;
  tokenInAddress: string;
  tokenOut: string;
  tokenOutAddress: string;
  amountIn: string;
  reason: string;
  estimatedAmountUSD: number;
}

export interface RebalanceResult {
  vaultId: string;
  executed: number;
  skipped: number;
  failed: number;
  transactions: VaultTransaction[];
  totalFeesUSD: number;
  results: Array<{
    status: 'executed' | 'skipped' | 'failed';
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    reason?: string;
    txHash?: string;
    explorerUrl?: string;
    error?: string;
  }>;
}

// ─── Database Bridge Interface ──────────────────────────────────────────
// The API routes implement these by calling Mongoose. This keeps the
// service logic testable without a live MongoDB connection.

export interface VaultStore {
  findVaultByUser(userAddress: string): Promise<Vault | null>;
  findVaultById(vaultId: string): Promise<Vault | null>;
  createVault(data: Omit<Vault, '_id' | 'createdAt' | 'updatedAt'>): Promise<Vault>;
  updateVault(vaultId: string, update: Partial<Vault>): Promise<Vault>;
  findActivePermission(vaultId: string): Promise<VaultPermission | null>;
  createPermission(data: Omit<VaultPermission, '_id'>): Promise<VaultPermission>;
  updatePermission(permissionId: string, update: Partial<VaultPermission>): Promise<void>;
  createTransaction(data: Omit<VaultTransaction, '_id'>): Promise<VaultTransaction>;
  findTransactions(vaultId: string, limit?: number): Promise<VaultTransaction[]>;
}

// ─── Execution Bridge Interface ─────────────────────────────────────────
// Abstracts the execution layer (Circle SDK or smart contract).

export interface VaultExecutor {
  getHoldings(vault: Vault): Promise<VaultAllocation[]>;
  executeSwap(
    vault: Vault,
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    chainId: number
  ): Promise<{ txHash: string; amountOut?: string }>;
  withdraw(vault: Vault, destinationAddress: string, amountUSD: number, chainId?: number): Promise<{ txHash: string; amountReceived: number }>;
}

// ─── Service ────────────────────────────────────────────────────────────

export class VaultService {
  private store: VaultStore;
  private executor: VaultExecutor;

  constructor(store: VaultStore, executor: VaultExecutor) {
    this.store = store;
    this.executor = executor;
  }

/**
    * Get or create a vault for a user.
    * Defaults to 'circle' type but supports 'earn-vault' for LI.FI Earn integration.
    */
  async getOrCreateVault(
    userAddress: string,
    strategy: string = 'global',
    vaultType: VaultType = 'circle'
  ): Promise<Vault> {
    const existing = await this.store.findVaultByUser(userAddress);
    if (existing) return existing;

    return this.store.createVault({
      userAddress: userAddress.toLowerCase(),
      vaultType,
      strategy,
      status: 'active',
      totalDepositedUSD: 0,
      totalWithdrawnUSD: 0,
      currentValueUSD: 0,
      highWaterMarkUSD: 0,
      allocations: [],
      totalFeesPaidUSD: 0,
      feesPendingUSD: 0,
    });
  }

  /**
   * Record a deposit and update vault state.
   */
  async processDeposit(
    vaultId: string,
    amountUSD: number,
    txHash: string,
    chainId: number
  ): Promise<VaultTransaction> {
    const vault = await this.store.findVaultById(vaultId);
    if (!vault) throw new Error('Vault not found');

    const updated = await this.store.updateVault(vaultId, {
      totalDepositedUSD: vault.totalDepositedUSD + amountUSD,
      currentValueUSD: vault.currentValueUSD + amountUSD,
      highWaterMarkUSD: Math.max(vault.highWaterMarkUSD, vault.currentValueUSD + amountUSD),
      lastDepositAt: new Date(),
    });

    const explorerBase = chainId === 42161 ? 'https://arbiscan.io' : 'https://celoscan.io';

    return this.store.createTransaction({
      vaultId,
      userAddress: vault.userAddress,
      type: 'deposit',
      status: 'confirmed',
      chainId,
      txHash,
      explorerUrl: `${explorerBase}/tx/${txHash}`,
      amountUSD,
      executionLayer: 'circle_sdk',
      feeUSD: 0,
      feePercentage: 0,
    });
  }

  /**
   * Execute a withdrawal with fee settlement.
   */
  async withdraw(
    vaultId: string,
    amountUSD: number,
    userAddress: string
  ): Promise<{ txHash: string; amountReceived: number; feeDeducted: number }> {
    const vault = await this.store.findVaultById(vaultId);
    if (!vault) throw new Error('Vault not found');
    if (vault.userAddress !== userAddress.toLowerCase()) throw new Error('Unauthorized');

    // Calculate and settle pending fees
    const fees = feeEngine.calculateTotalFees({
      aumUSD: vault.currentValueUSD,
      lastChargeDate: vault.lastFeeChargeAt || null,
      highWaterMarkUSD: vault.highWaterMarkUSD,
      totalDepositedUSD: vault.totalDepositedUSD,
      totalWithdrawnUSD: vault.totalWithdrawnUSD,
      swapVolumeUSD: 0,
    });

    const totalPendingFees = vault.feesPendingUSD + fees.totalFeeUSD;
    const netWithdrawal = Math.max(0, amountUSD - totalPendingFees);

    if (netWithdrawal <= 0 && amountUSD > 0) {
      throw new Error('Withdrawal amount is less than pending fees');
    }

    // Determine the chain from the vault's allocations, or default to Celo
    const vaultChainId = vault.allocations?.[0]?.chainId || 42220;
    const explorerBase = vaultChainId === 42161 ? 'https://arbiscan.io' : 'https://celoscan.io';

    // Execute withdrawal via executor (pass chainId so executor can use the right RPC)
    const result = await this.executor.withdraw(vault, userAddress, netWithdrawal, vaultChainId);

    // Update vault
    await this.store.updateVault(vaultId, {
      totalWithdrawnUSD: vault.totalWithdrawnUSD + amountUSD,
      currentValueUSD: Math.max(0, vault.currentValueUSD - amountUSD),
      totalFeesPaidUSD: vault.totalFeesPaidUSD + totalPendingFees,
      feesPendingUSD: 0,
      lastFeeChargeAt: new Date(),
      lastWithdrawalAt: new Date(),
    });

    // Record transactions
    await this.store.createTransaction({
      vaultId,
      userAddress: vault.userAddress,
      type: 'withdraw',
      status: 'confirmed',
      chainId: vaultChainId,
      txHash: result.txHash,
      explorerUrl: `${explorerBase}/tx/${result.txHash}`,
      amountUSD: netWithdrawal,
      executionLayer: 'circle_sdk',
      feeUSD: totalPendingFees,
      feePercentage: amountUSD > 0 ? (totalPendingFees / amountUSD) * 100 : 0,
    });

    if (totalPendingFees > 0) {
      await this.store.createTransaction({
        vaultId,
        userAddress: vault.userAddress,
        type: 'fee_deduction',
        status: 'confirmed',
        chainId: vaultChainId,
        amountUSD: totalPendingFees,
        executionLayer: 'circle_sdk',
        feeUSD: totalPendingFees,
        feePercentage: 0,
      });
    }

    return { txHash: result.txHash, amountReceived: netWithdrawal, feeDeducted: totalPendingFees };
  }

  /**
   * Execute a rebalance under permission constraints.
   */
  async rebalance(
    vaultId: string,
    recommendations: RebalanceRecommendation[]
  ): Promise<RebalanceResult> {
    const vault = await this.store.findVaultById(vaultId);
    if (!vault) throw new Error('Vault not found');

    const permission = await this.store.findActivePermission(vaultId);
    if (!permission || permission.status !== 'active') {
      return { vaultId, executed: 0, skipped: recommendations.length, failed: 0, transactions: [], totalFeesUSD: 0, results: [] };
    }

    // Check permission expiry
    const now = Math.floor(Date.now() / 1000);
    if (permission.expiresAt > 0 && permission.expiresAt < now) {
      return { vaultId, executed: 0, skipped: recommendations.length, failed: 0, transactions: [], totalFeesUSD: 0, results: [] };
    }

    let executed = 0;
    let skipped = 0;
    let failed = 0;
    const transactions: VaultTransaction[] = [];
    const results: RebalanceResult['results'] = [];
    let totalFeesUSD = 0;

    // Reset daily counter if new day
    const today = new Date().toISOString().slice(0, 10);
    if (permission.spentDate !== today) {
      permission.spentTodayUSD = 0;
      permission.spentDate = today;
    }

    for (const rec of recommendations) {
      // Validate against permission
      const validation = this.validateSwap(permission, rec);
      if (!validation.allowed) {
        skipped++;
        results.push({
          status: 'skipped',
          tokenIn: rec.tokenIn,
          tokenOut: rec.tokenOut,
          amountUSD: rec.estimatedAmountUSD,
          reason: validation.reason,
        });
        continue;
      }

      // Calculate swap fee
      const swapFee = feeEngine.calculateSwapFee(rec.estimatedAmountUSD);

      const executionChainId = permission.chainId || 42220;
      const explorerBase = executionChainId === 42161 ? 'https://arbiscan.io' : 'https://celoscan.io';

      try {
        const result = await this.executor.executeSwap(
          vault,
          rec.tokenInAddress,
          rec.tokenOutAddress,
          rec.amountIn,
          executionChainId
        );

        const tx: VaultTransaction = {
          vaultId,
          userAddress: vault.userAddress,
          type: 'swap',
          status: 'confirmed',
          chainId: executionChainId,
          txHash: result.txHash,
          explorerUrl: `${explorerBase}/tx/${result.txHash}`,
          tokenIn: rec.tokenIn,
          tokenOut: rec.tokenOut,
          amountIn: rec.amountIn,
          amountOut: result.amountOut,
          amountUSD: rec.estimatedAmountUSD,
          executionLayer: 'circle_sdk',
          strategyUsed: 'vault-rebalance',
          feeUSD: swapFee,
          feePercentage: (swapFee / rec.estimatedAmountUSD) * 100,
        };

        await this.store.createTransaction(tx);
        transactions.push(tx);
        results.push({
          status: 'executed',
          tokenIn: rec.tokenIn,
          tokenOut: rec.tokenOut,
          amountUSD: rec.estimatedAmountUSD,
          reason: rec.reason,
          txHash: tx.txHash,
          explorerUrl: tx.explorerUrl,
        });

        // Update permission spending
        permission.spentTodayUSD += rec.estimatedAmountUSD;
        permission.totalSpentUSD += rec.estimatedAmountUSD;

        executed++;
        totalFeesUSD += swapFee;
      } catch (error) {
        failed++;
        const failedTx = await this.store.createTransaction({
          vaultId,
          userAddress: vault.userAddress,
          type: 'swap',
          status: 'failed',
          chainId: executionChainId,
          tokenIn: rec.tokenIn,
          tokenOut: rec.tokenOut,
          amountIn: rec.amountIn,
          amountUSD: rec.estimatedAmountUSD,
          executionLayer: 'circle_sdk',
          feeUSD: 0,
          feePercentage: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        transactions.push(failedTx);
        results.push({
          status: 'failed',
          tokenIn: rec.tokenIn,
          tokenOut: rec.tokenOut,
          amountUSD: rec.estimatedAmountUSD,
          reason: rec.reason,
          txHash: failedTx.txHash,
          explorerUrl: failedTx.explorerUrl,
          error: failedTx.error,
        });
      }
    }

    // Update permission spending tracker
    if (executed > 0) {
      await this.store.updatePermission(permission._id, {
        spentTodayUSD: permission.spentTodayUSD,
        spentDate: permission.spentDate,
        totalSpentUSD: permission.totalSpentUSD,
      });

      // Update vault
      await this.store.updateVault(vaultId, {
        feesPendingUSD: vault.feesPendingUSD + totalFeesUSD,
        lastRebalanceAt: new Date(),
      });
    }

    return { vaultId, executed, skipped, failed, transactions, totalFeesUSD, results };
  }

  /**
   * Get vault summary for UI display.
   */
  async getSummary(vaultId: string): Promise<VaultSummary> {
    const vault = await this.store.findVaultById(vaultId);
    if (!vault) throw new Error('Vault not found');

    const permission = await this.store.findActivePermission(vaultId);
    const transactions = await this.store.findTransactions(vaultId, 20);

    const fees = feeEngine.calculateTotalFees({
      aumUSD: vault.currentValueUSD,
      lastChargeDate: vault.lastFeeChargeAt || null,
      highWaterMarkUSD: vault.highWaterMarkUSD,
      totalDepositedUSD: vault.totalDepositedUSD,
      totalWithdrawnUSD: vault.totalWithdrawnUSD,
      swapVolumeUSD: 0,
    });

    // Aggregate allocation by region
    const allocationByRegion: Record<string, { valueUSD: number; percentage: number }> = {};
    for (const alloc of vault.allocations) {
      if (!allocationByRegion[alloc.region]) {
        allocationByRegion[alloc.region] = { valueUSD: 0, percentage: 0 };
      }
      allocationByRegion[alloc.region].valueUSD += alloc.valueUSD;
      allocationByRegion[alloc.region].percentage += alloc.percentage;
    }

    return { vault, permission, fees, recentTransactions: transactions, allocationByRegion };
  }

  /**
   * Validate a swap against permission constraints.
   */
  private validateSwap(
    permission: VaultPermission,
    rec: RebalanceRecommendation
  ): { allowed: boolean; reason?: string } {
    if (!permission.allowedActions.includes('swap') && !permission.allowedActions.includes('rebalance')) {
      return { allowed: false, reason: 'Swap not in allowed actions' };
    }
    // The acquired (destination) token must be explicitly allowed. Checking
    // tokenIn OR tokenOut was a bypass: tokenIn is always the funding token
    // (cUSD), so an OR check let the agent acquire ANY tokenOut. A wildcard
    // '*' opts into any destination token. Token comparison is
    // case-insensitive to match the guardian-loop gate.
    const allowedTokens = permission.allowedTokens.map((t) => t.toLowerCase());
    const destinationAllowed =
      allowedTokens.includes('*') || allowedTokens.includes(rec.tokenOut.toLowerCase());
    if (!destinationAllowed) {
      return { allowed: false, reason: `Destination token ${rec.tokenOut} not in allowed list` };
    }
    if (permission.spentTodayUSD + rec.estimatedAmountUSD > permission.dailyLimitUSD) {
      return {
        allowed: false,
        reason: `Daily limit exceeded ($${permission.spentTodayUSD.toFixed(2)} + $${rec.estimatedAmountUSD.toFixed(2)} > $${permission.dailyLimitUSD})`,
      };
    }
    if (permission.totalSpentUSD + rec.estimatedAmountUSD > permission.spendingLimitUSD) {
      return { allowed: false, reason: 'Total spending limit exceeded' };
    }
    return { allowed: true };
  }
}

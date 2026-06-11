import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { ERC7715Service } from '../../../packages/shared/src/services/erc7715-service';
import { getGuardianState } from './_guardian-state';

const erc7715 = new ERC7715Service();

/**
 * POST /api/vault/permission — Register an ERC-7715 permission for a vault.
 *
 * Body: { userAddress, signedPermission, sessionPrivateKey }
 *
 * GET  /api/vault/permission?userAddress=0x... — Get active permission.
 *
 * DELETE /api/vault/permission?userAddress=0x... — Revoke permission.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'POST') {
    const { userAddress, permission } = req.body;

    if (!userAddress || !permission?.dailyLimitUSD || !permission?.allowedTokens) {
      return res.status(400).json({ error: 'Missing required fields: userAddress, permission.dailyLimitUSD, permission.allowedTokens' });
    }

    if (typeof permission.signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(permission.signature)) {
      return res.status(400).json({
        error: 'Invalid permission.signature — expected an EIP-712 0x-hex signature from the user wallet',
      });
    }

    if (typeof permission.nonce !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(permission.nonce)) {
      return res.status(400).json({
        error: 'Invalid permission.nonce — expected a 32-byte 0x-hex value matching the signed payload',
      });
    }

    const signedPermission = {
      permission: {
        sessionKeyAddress: permission.sessionKeyAddress,
        userAddress,
        spendingLimitUSD: permission.spendingLimitUSD,
        dailyLimitUSD: permission.dailyLimitUSD,
        allowedActions: permission.allowedActions || [],
        allowedTokens: permission.allowedTokens,
        expiresAt: permission.expiresAt,
        autonomyLevel: permission.autonomyLevel || 'GUARDIAN',
        chainId: permission.chainId || 42220,
        nonce: permission.nonce,
      },
      signature: permission.signature,
      signedAt: permission.signedAt || new Date().toISOString(),
    };

    const validation = erc7715.verifySignedPermission(signedPermission, signedPermission.permission.chainId);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'EIP-712 signature verification failed',
        details: validation.errors,
        warnings: validation.warnings,
      });
    }

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found. Create one first.' });

      // Revoke any existing active permission
      const existing = await vaultStore.findActivePermission(vault._id);
      if (existing) {
        await vaultStore.updatePermission(existing._id, { status: 'revoked' });
      }

      const created = await vaultStore.createPermission({
        vaultId: vault._id,
        userAddress: userAddress.toLowerCase(),
        sessionKeyAddress: permission.sessionKeyAddress,
        spendingLimitUSD: permission.spendingLimitUSD,
        dailyLimitUSD: permission.dailyLimitUSD,
        allowedActions: permission.allowedActions || ['swap', 'rebalance'],
        allowedTokens: permission.allowedTokens,
        expiresAt: permission.expiresAt,
        autonomyLevel: permission.autonomyLevel || 'GUARDIAN',
        chainId: permission.chainId || 42220,
        nonce: permission.nonce,
        signature: permission.signature,
        signedAt: permission.signedAt || new Date().toISOString(),
        spentTodayUSD: 0,
        spentDate: new Date().toISOString().slice(0, 10),
        totalSpentUSD: 0,
        status: 'active' as const,
      });

      return res.status(200).json({
        success: true,
        permission: created,
        summary: `${created.dailyLimitUSD}/day, ${created.allowedTokens.join(', ')}, expires ${new Date(created.expiresAt * 1000).toLocaleDateString()}`,
        warnings: validation.warnings,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'GET') {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing userAddress' });
    }

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found', hasPermission: false });

      const permission = await vaultStore.findActivePermission(vault._id);
      if (!permission) return res.status(200).json({ hasPermission: false });

      const recentTransactions = await vaultStore.findTransactions(vault._id, 10);
      const now = Math.floor(Date.now() / 1000);
      const active = permission.status === 'active' && (permission.expiresAt <= 0 || permission.expiresAt >= now);
      const recentExecutions = recentTransactions
        .filter((tx) => tx.type === 'swap' || tx.type === 'rebalance')
        .slice(0, 5)
        .map((tx) => ({
          txHash: tx.txHash || '',
          action: tx.type,
          tokenIn: tx.tokenIn || '',
          tokenOut: tx.tokenOut || '',
          amountUSD: tx.amountUSD,
          timestamp: tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now(),
          status: tx.status,
          explorerUrl: tx.explorerUrl,
          error: tx.error,
        }));

      const guardianState = await getGuardianState(userAddress);
      const remainingTodayUSD = Math.max(0, permission.dailyLimitUSD - permission.spentTodayUSD);

      return res.status(200).json({
        hasPermission: active,
        active,
        expired: !active && permission.expiresAt > 0 && permission.expiresAt < now,
        permission,
        dailyLimitUSD: permission.dailyLimitUSD,
        spentTodayUSD: permission.spentTodayUSD,
        remainingTodayUSD,
        executionCount: recentExecutions.length,
        recentExecutions,
        latestRecommendation: guardianState?.latestRecommendation || null,
        latestAnchor: guardianState?.latestAnchor || null,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing userAddress' });
    }

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found' });

      const permission = await vaultStore.findActivePermission(vault._id);
      if (permission) {
        await vaultStore.updatePermission(permission._id, { status: 'revoked' });
      }

      return res.status(200).json({ success: true, revoked: !!permission });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

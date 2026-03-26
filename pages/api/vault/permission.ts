import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { ERC7715Service } from '../../../packages/shared/src/services/erc7715-service';

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

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found. Create one first.' });

      // Revoke any existing active permission
      const existing = await vaultStore.findActivePermission(vault._id);
      if (existing) {
        await vaultStore.updatePermission(existing._id, { status: 'revoked' });
      }

      // Create new permission
      // Enforcement happens in VaultService.rebalance() — checks daily limit, allowed tokens, expiry.
      // EIP-712 signature verification is deferred to the smart account layer (Privy policies).
      const permission = await vaultStore.createPermission({
        vaultId: vault._id,
        userAddress: userAddress.toLowerCase(),
        sessionKeyAddress: req.body.permission.sessionKeyAddress || userAddress,
        spendingLimitUSD: req.body.permission.spendingLimitUSD || req.body.permission.dailyLimitUSD * 30,
        dailyLimitUSD: req.body.permission.dailyLimitUSD,
        allowedActions: req.body.permission.allowedActions || ['swap', 'rebalance'],
        allowedTokens: req.body.permission.allowedTokens,
        expiresAt: req.body.permission.expiresAt || Math.floor(Date.now() / 1000) + 7 * 86400,
        autonomyLevel: req.body.permission.autonomyLevel || 'GUARDIAN',
        chainId: req.body.permission.chainId || 42220,
        nonce: req.body.permission.nonce || Date.now().toString(),
        signature: req.body.permission.signature || 'unsigned',
        signedAt: req.body.permission.signedAt || new Date().toISOString(),
        spentTodayUSD: 0,
        spentDate: new Date().toISOString().slice(0, 10),
        totalSpentUSD: 0,
        status: 'active' as const,
      });

      return res.status(200).json({
        success: true,
        permission,
        summary: `${permission.dailyLimitUSD}/day, ${permission.allowedTokens.join(', ')}, expires ${new Date(permission.expiresAt * 1000).toLocaleDateString()}`,
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

      return res.status(200).json({ hasPermission: true, permission });
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

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
    const { userAddress, signedPermission, sessionPrivateKey } = req.body;

    if (!userAddress || !signedPermission?.permission || !signedPermission?.signature || !sessionPrivateKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found. Create one first.' });

      // Verify the signature
      const validation = erc7715.verifySignedPermission(signedPermission, signedPermission.permission.chainId);
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Invalid permission signature', details: validation.errors });
      }

      // Revoke any existing active permission
      const existing = await vaultStore.findActivePermission(vault._id);
      if (existing) {
        await vaultStore.updatePermission(existing._id, { status: 'revoked' });
      }

      // Create new permission
      const permission = await vaultStore.createPermission({
        vaultId: vault._id,
        userAddress: userAddress.toLowerCase(),
        sessionKeyAddress: signedPermission.permission.sessionKeyAddress,
        spendingLimitUSD: signedPermission.permission.spendingLimitUSD,
        dailyLimitUSD: signedPermission.permission.dailyLimitUSD,
        allowedActions: signedPermission.permission.allowedActions,
        allowedTokens: signedPermission.permission.allowedTokens,
        expiresAt: signedPermission.permission.expiresAt,
        autonomyLevel: signedPermission.permission.autonomyLevel,
        chainId: signedPermission.permission.chainId,
        nonce: signedPermission.permission.nonce,
        signature: signedPermission.signature,
        spentTodayUSD: 0,
        spentDate: new Date().toISOString().slice(0, 10),
        totalSpentUSD: 0,
        status: 'active' as const,
      });

      return res.status(200).json({
        success: true,
        permission,
        summary: erc7715.describePermission(signedPermission.permission),
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

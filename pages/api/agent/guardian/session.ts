import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Guardian Session API — server-side session key storage.
 *
 * POST /api/agent/guardian/session
 *   Register a signed session permission + the disposable private key.
 *   Body: { signedPermission, sessionPrivateKey }
 *
 * GET  /api/agent/guardian/session?userAddress=0x...
 *   Return the active session for a user (without the private key).
 *
 * DELETE /api/agent/guardian/session?userAddress=0x...
 *   Revoke / delete the session.
 */

export interface StoredSession {
  signedPermission: {
    permission: {
      sessionKeyAddress: string;
      userAddress: string;
      spendingLimitUSD: number;
      dailyLimitUSD: number;
      allowedActions: string[];
      allowedTokens: string[];
      expiresAt: number;
      autonomyLevel: string;
      chainId: number;
      nonce: string;
    };
    signature: string;
    signedAt: string;
  };
  /** Disposable session private key — only used server-side for signing txs */
  sessionPrivateKey: string;
  /** Running total of USD spent today */
  spentTodayUSD: number;
  /** Date string (YYYY-MM-DD) for daily limit reset */
  spentDate: string;
  /** Timestamp of last autonomous check */
  lastCheckAt: number;
  /** Receipts of autonomous executions */
  executions: Array<{
    txHash: string;
    action: string;
    tokenIn: string;
    tokenOut: string;
    amountUSD: number;
    timestamp: number;
  }>;
}

/**
 * In-memory session store.
 * In production this would be Redis / a database.
 * For the hackathon demo, in-memory is fine — sessions survive as long as
 * the Vercel lambda is warm (typically minutes to hours).
 */
const sessions = new Map<string, StoredSession>();

export function getSession(userAddress: string): StoredSession | undefined {
  const session = sessions.get(userAddress.toLowerCase());
  if (!session) return undefined;
  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (session.signedPermission.permission.expiresAt > 0 &&
      session.signedPermission.permission.expiresAt < now) {
    sessions.delete(userAddress.toLowerCase());
    return undefined;
  }
  return session;
}

export function setSession(userAddress: string, session: StoredSession): void {
  sessions.set(userAddress.toLowerCase(), session);
}

export function deleteSession(userAddress: string): boolean {
  return sessions.delete(userAddress.toLowerCase());
}

export function recordExecution(
  userAddress: string,
  execution: StoredSession['executions'][0]
): boolean {
  const session = getSession(userAddress);
  if (!session) return false;

  // Reset daily counter if new day
  const today = new Date().toISOString().slice(0, 10);
  if (session.spentDate !== today) {
    session.spentTodayUSD = 0;
    session.spentDate = today;
  }

  session.spentTodayUSD += execution.amountUSD;
  session.executions.push(execution);
  session.lastCheckAt = Date.now();
  return true;
}

export function getAllSessions(): Array<{ userAddress: string; session: StoredSession }> {
  const result: Array<{ userAddress: string; session: StoredSession }> = [];
  for (const [addr, session] of sessions.entries()) {
    const now = Math.floor(Date.now() / 1000);
    if (session.signedPermission.permission.expiresAt > 0 &&
        session.signedPermission.permission.expiresAt < now) {
      sessions.delete(addr);
      continue;
    }
    result.push({ userAddress: addr, session });
  }
  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { signedPermission, sessionPrivateKey } = req.body;

    if (!signedPermission?.permission?.userAddress || !signedPermission?.signature || !sessionPrivateKey) {
      return res.status(400).json({ error: 'Missing signedPermission or sessionPrivateKey' });
    }

    const userAddress = signedPermission.permission.userAddress.toLowerCase();

    // Validate expiry
    const now = Math.floor(Date.now() / 1000);
    if (signedPermission.permission.expiresAt > 0 && signedPermission.permission.expiresAt < now) {
      return res.status(400).json({ error: 'Permission already expired' });
    }

    const session: StoredSession = {
      signedPermission,
      sessionPrivateKey,
      spentTodayUSD: 0,
      spentDate: new Date().toISOString().slice(0, 10),
      lastCheckAt: Date.now(),
      executions: [],
    };

    setSession(userAddress, session);

    return res.status(200).json({
      success: true,
      userAddress,
      expiresAt: signedPermission.permission.expiresAt,
      dailyLimitUSD: signedPermission.permission.dailyLimitUSD,
      allowedActions: signedPermission.permission.allowedActions,
      allowedTokens: signedPermission.permission.allowedTokens,
    });
  }

  if (req.method === 'GET') {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing userAddress query param' });
    }

    const session = getSession(userAddress);
    if (!session) {
      return res.status(404).json({ error: 'No active session', active: false });
    }

    return res.status(200).json({
      active: true,
      userAddress: session.signedPermission.permission.userAddress,
      autonomyLevel: session.signedPermission.permission.autonomyLevel,
      dailyLimitUSD: session.signedPermission.permission.dailyLimitUSD,
      spentTodayUSD: session.spentTodayUSD,
      remainingTodayUSD: Math.max(0, session.signedPermission.permission.dailyLimitUSD - session.spentTodayUSD),
      expiresAt: session.signedPermission.permission.expiresAt,
      allowedActions: session.signedPermission.permission.allowedActions,
      allowedTokens: session.signedPermission.permission.allowedTokens,
      executionCount: session.executions.length,
      lastCheckAt: session.lastCheckAt,
      recentExecutions: session.executions.slice(-5),
    });
  }

  if (req.method === 'DELETE') {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing userAddress query param' });
    }

    const deleted = deleteSession(userAddress);
    return res.status(200).json({ success: true, deleted });
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

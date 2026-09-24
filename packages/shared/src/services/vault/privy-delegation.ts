/**
 * Privy delegation verification — server-side check that a user's Privy
 * embedded wallet actually carries the app's key quorum as an additional
 * signer.
 *
 * The client grants delegation via `useSigners().addSigners` during the
 * Guardian permission flow, but the stored `privyDelegated` flag must be
 * server-verified: a client claim alone would let a forged request mark a
 * permission delegated and bypass the guardian-loop's delegation gate.
 *
 * Returns false — never throws to callers' control flow — when any required
 * credential is missing, the user can't be resolved, or the wallet doesn't
 * list the quorum signer. Callers should still `.catch(() => false)` for
 * network failures.
 *
 * Required env:
 *   PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID), PRIVY_APP_SECRET,
 *   PRIVY_KEY_QUORUM_ID (or NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID)
 */

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  additional_signers?: Array<{ signer_id?: string }>;
}

export async function verifyPrivyDelegation(walletAddress: string): Promise<boolean> {
  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET || '';
  const quorumId =
    process.env.PRIVY_KEY_QUORUM_ID || process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID || '';
  if (!appId || !appSecret || !quorumId) return false;

  const { PrivyClient } = await import('@privy-io/node');
  const client = new PrivyClient({ appId, appSecret });

  const user = await client.users().getByWalletAddress({ address: walletAddress });
  const account = (user?.linked_accounts as PrivyLinkedAccount[] | undefined)?.find(
    (a) => a.type === 'wallet' && a.address?.toLowerCase() === walletAddress.toLowerCase(),
  );
  return (account?.additional_signers ?? []).some((s) => s.signer_id === quorumId);
}

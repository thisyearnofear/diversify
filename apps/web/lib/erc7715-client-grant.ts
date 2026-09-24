/**
 * Lightweight ERC-7715 grant helper for the browser.
 *
 * Calls wallet_requestExecutionPermissions directly on window.ethereum
 * without pulling in the full @metamask/smart-accounts-kit SDK (which has
 * Node-only dependencies that bloat the client bundle).
 *
 * The server-side counterpart is packages/shared/src/services/erc7715-grant.ts
 * which uses the real SDK for type-safe server flows.
 */

/**
 * The token the Guardian's periodic permission is scoped to, per chain.
 * Only chains that are BOTH app-supported and kit-eligible belong here —
 * granting on any other chain would produce a permission nothing can redeem.
 */
export const GRANT_TOKEN_BY_CHAIN: Readonly<Record<number, `0x${string}`>> = {
  // USDC on Arbitrum One
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  // cUSD on Celo mainnet
  42220: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
};

export const GRANT_ELIGIBLE_CHAIN_IDS = Object.keys(GRANT_TOKEN_BY_CHAIN).map(Number);

export function grantTokenForChain(chainId: number): `0x${string}` | null {
  return GRANT_TOKEN_BY_CHAIN[chainId] ?? null;
}

/**
 * The Guardian session account the permission is granted TO.
 * Returns null when the deployment has no session account configured —
 * callers must hide/disable the grant option rather than fall back to the
 * user's own address (a self-address permission would hand the user a
 * permission they never consented to).
 */
export function guardianSessionAddress(): `0x${string}` | null {
  const value = process.env.NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS;
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as `0x${string}`) : null;
}

export interface ClientGrantParams {
  sessionAccountAddress: `0x${string}`;
  chainId: number;
  tokenAddress?: `0x${string}`;
  periodAmount: bigint;
  periodDuration?: number;
  expiry?: number;
  justification?: string;
}

export interface ClientGrantResult {
  context: `0x${string}`;
  delegationManager: `0x${string}`;
  dependencies: { factory: `0x${string}`; factoryData: `0x${string}` }[];
  grantedAt: string;
}

export async function requestAdvancedPermission(
  params: ClientGrantParams,
): Promise<ClientGrantResult> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('No EIP-1193 provider found. Install MetaMask to use Advanced Permissions.');
  }

  const {
    sessionAccountAddress,
    chainId,
    tokenAddress,
    periodAmount,
    periodDuration = 86400,
    expiry = Math.floor(Date.now() / 1000) + 604800,
    justification = 'DiversiFi Guardian: automated inflation protection within your approved limit.',
  } = params;

  const token = tokenAddress ?? grantTokenForChain(chainId);
  if (!token) {
    throw new Error(
      `Advanced Permissions are not available on chain ${chainId}. ` +
        `Supported chains: ${GRANT_ELIGIBLE_CHAIN_IDS.join(', ')}.`,
    );
  }

  const granted = await ethereum.request({
    method: 'wallet_requestExecutionPermissions',
    params: [
      {
        chainId: `0x${chainId.toString(16)}`,
        to: sessionAccountAddress,
        expiry: `0x${expiry.toString(16)}`,
        permission: {
          type: 'erc20-token-periodic',
          isAdjustmentAllowed: false,
          data: {
            tokenAddress: token,
            periodAmount: `0x${periodAmount.toString(16)}`,
            periodDuration: `0x${periodDuration.toString(16)}`,
            justification,
          },
        },
      },
    ],
  });

  const response = Array.isArray(granted) ? granted[0] : granted;
  if (!response?.context) {
    throw new Error('MetaMask did not return a granted permission.');
  }

  return {
    context: response.context,
    delegationManager: response.delegationManager,
    dependencies: response.dependencies ?? [],
    grantedAt: new Date().toISOString(),
  };
}

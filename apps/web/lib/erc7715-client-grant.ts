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

export const ARBITRUM_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;
export const ARBITRUM_CHAIN_ID = 42161;

export interface ClientGrantParams {
  sessionAccountAddress: `0x${string}`;
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
    tokenAddress = ARBITRUM_USDC,
    periodAmount,
    periodDuration = 86400,
    expiry = Math.floor(Date.now() / 1000) + 604800,
    justification = 'DiversiFi Guardian: automated inflation protection within your approved limit.',
  } = params;

  const granted = await ethereum.request({
    method: 'wallet_requestExecutionPermissions',
    params: [
      {
        chainId: `0x${ARBITRUM_CHAIN_ID.toString(16)}`,
        to: sessionAccountAddress,
        expiry: `0x${expiry.toString(16)}`,
        permission: {
          type: 'erc20-token-periodic',
          isAdjustmentAllowed: false,
          data: {
            tokenAddress,
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

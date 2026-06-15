/**
 * ERC-7715 Advanced Permissions — Client-side grant helper.
 *
 * This is the REAL MetaMask Smart Accounts Kit integration (as opposed to the
 * homegrown EIP-712 session-key scheme in erc7715-service.ts). It asks the
 * user's MetaMask extension to grant a fine-grained, on-chain-enforced spending
 * permission via `wallet_requestExecutionPermissions` (ERC-7715).
 *
 * Flow:
 *   1. Client calls requestGuardianAdvancedPermission() with the agent's session
 *      account address (the "redeemer") and a periodic spend cap.
 *   2. MetaMask shows the user a plain-language permission prompt and returns a
 *      `PermissionResponse` containing an opaque `context` (the delegation),
 *      `delegationManager`, and `dependencies` (account factory data).
 *   3. The client POSTs that bundle to the server, which stores it and later
 *      redeems it via MetaMaskDelegationProvider (ERC-7710) to execute swaps
 *      within the granted bounds — WITHOUT ever holding the user's keys.
 *
 * ⚠️ Network support: ERC-7715 Advanced Permissions work on EIP-7702 chains
 * (Arbitrum One, Base, Optimism, Polygon, Ethereum, etc.). Celo is NOT
 * supported, so the Guardian advanced-permission flow targets Arbitrum One.
 * Requires MetaMask Flask 13.5.0+.
 */

import {
    createWalletClient,
    custom,
    type Address,
    type Hex,
    type EIP1193Provider,
} from 'viem';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';

/** Chains where ERC-7715 Advanced Permissions are currently supported. */
export const ERC7715_SUPPORTED_CHAIN_IDS = [
    1, // Ethereum
    42161, // Arbitrum One
    8453, // Base
    10, // Optimism
    137, // Polygon
] as const;

/** The Guardian's preferred chain for Advanced Permissions (Arbitrum One). */
export const GUARDIAN_ADVANCED_PERMISSION_CHAIN_ID = 42161;

export function isErc7715Supported(chainId: number): boolean {
    return (ERC7715_SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export interface RequestAdvancedPermissionParams {
    /** EIP-1193 provider (e.g. window.ethereum). */
    provider: EIP1193Provider;
    /** Chain to request the permission on. Must be ERC-7715 supported. */
    chainId: number;
    /**
     * The agent's session account address that will redeem the permission.
     * This is the server-side smart account derived from GUARDIAN_SESSION_PRIVATE_KEY.
     */
    sessionAccountAddress: Address;
    /** ERC-20 token the agent is permitted to spend (e.g. USDC on Arbitrum). */
    tokenAddress: Address;
    /** Max amount spendable per period, in token base units (e.g. 6dp for USDC). */
    periodAmount: bigint;
    /** Period length in seconds. Defaults to 1 day. */
    periodDuration?: number;
    /** Unix timestamp (seconds) when the permission expires. */
    expiry: number;
    /** Optional connected account to request from. */
    from?: Address;
    /** Human-readable reason shown to the user. */
    justification?: string;
}

/**
 * The stored permission bundle the server needs to redeem (ERC-7710).
 * Persist this server-side keyed by the user's address.
 */
export interface GrantedAdvancedPermission {
    chainId: number;
    /** Opaque delegation context (the authority to act). */
    context: Hex;
    /** The DelegationManager contract that enforces the caveats. */
    delegationManager: Address;
    /** Account factory dependencies needed on first redemption. */
    dependencies: { factory: Address; factoryData: Hex }[];
    /** The session account that may redeem (the agent). */
    sessionAccountAddress: Address;
    /** Token + cap the user approved (for display / server-side sanity checks). */
    tokenAddress: Address;
    periodAmount: string;
    periodDuration: number;
    expiry: number;
    grantedAt: string;
}

/**
 * Prompt the user's MetaMask extension to grant an ERC-7715 periodic ERC-20
 * spending permission to the agent's session account.
 */
export async function requestGuardianAdvancedPermission(
    params: RequestAdvancedPermissionParams,
): Promise<GrantedAdvancedPermission> {
    const {
        provider,
        chainId,
        sessionAccountAddress,
        tokenAddress,
        periodAmount,
        periodDuration = 86400,
        expiry,
        from,
        justification = 'DiversiFi Guardian: automated inflation protection within your approved limit.',
    } = params;

    if (!isErc7715Supported(chainId)) {
        throw new Error(
            `Chain ${chainId} does not support ERC-7715 Advanced Permissions. ` +
                `Use one of: ${ERC7715_SUPPORTED_CHAIN_IDS.join(', ')} (Guardian uses Arbitrum One ${GUARDIAN_ADVANCED_PERMISSION_CHAIN_ID}).`,
        );
    }

    const walletClient = createWalletClient({
        transport: custom(provider),
    }).extend(erc7715ProviderActions());

    const granted = await walletClient.requestExecutionPermissions([
        {
            chainId,
            to: sessionAccountAddress,
            from: from ?? null,
            expiry,
            permission: {
                type: 'erc20-token-periodic',
                isAdjustmentAllowed: false,
                data: {
                    tokenAddress,
                    periodAmount,
                    periodDuration,
                    justification,
                },
            },
        },
    ]);

    const response = granted[0];
    if (!response) {
        throw new Error('MetaMask did not return a granted permission.');
    }

    return {
        chainId,
        context: response.context,
        delegationManager: response.delegationManager,
        dependencies: response.dependencies,
        sessionAccountAddress,
        tokenAddress,
        periodAmount: periodAmount.toString(),
        periodDuration,
        expiry,
        grantedAt: new Date().toISOString(),
    };
}

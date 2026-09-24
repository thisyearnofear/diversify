/**
 * EIP-3009 `TransferWithAuthorization` helpers — single source of truth for the
 * mandate-first x402 payment path (buyer signs, merchant settles).
 *
 * Used by:
 * - `circle-service.ts` (create/verify Nanopayment Mandates)
 * - `settlement-service.ts` (merchant-side on-chain settlement)
 * - `apps/web/hooks/use-x402-payment.ts` (client-side mandate signing)
 *
 * Circle's USDC (FiatTokenV2) supports this on every chain it deploys to —
 * Arc, Arbitrum, Base, Ethereum. The EIP-712 domain is
 * { name: <token's name()>, version: '2', chainId, verifyingContract: <token> }.
 *
 * IMPORTANT: on Arc the predeploy's name() is 'USDC', NOT 'USD Coin'
 * (verified against DOMAIN_SEPARATOR() at rpc.mainnet.arc.io). Signing with
 * 'USD Coin' passes off-chain verification but reverts on-chain on Arc.
 */

import { utils } from 'ethers';

export const EIP3009_DOMAIN_NAME = 'USD Coin';
export const EIP3009_DOMAIN_NAME_ARC = 'USDC';
export const EIP3009_DOMAIN_VERSION = '2';

/**
 * The EIP-712 domain `name` the token's DOMAIN_SEPARATOR is built from.
 * Arc (mainnet 5042 + testnet 5042002): 'USDC'. Everywhere else Circle
 * deploys FiatTokenV2 as 'USD Coin'.
 */
export function eip3009DomainNameFor(chainId: number): string {
    return chainId === 5042 || chainId === 5042002 ? EIP3009_DOMAIN_NAME_ARC : EIP3009_DOMAIN_NAME;
}

export const EIP3009_TRANSFER_TYPES: Record<string, { name: string; type: string }[]> = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
};

export function eip3009Domain(chainId: number, tokenAddress: string, name?: string) {
    return {
        name: name ?? eip3009DomainNameFor(chainId),
        version: EIP3009_DOMAIN_VERSION,
        chainId,
        verifyingContract: tokenAddress,
    };
}

/**
 * The EIP-3009 nonce field is bytes32. Our x402 challenges issue string nonces
 * (`req_…` / `quote_…`), so both sides normalize identically: 0x-hex passes
 * through, anything else is UTF-8 padded to bytes32 (max 31 bytes).
 */
export function eip3009NonceBytes32(nonce: string): string {
    if (nonce.startsWith('0x')) return nonce;
    return utils.formatBytes32String(nonce);
}

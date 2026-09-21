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
 * Arc, Arbitrum, Base, Ethereum. The EIP-712 domain is always
 * { name: 'USD Coin', version: '2', chainId, verifyingContract: <token> }.
 */

import { utils } from 'ethers';

export const EIP3009_DOMAIN_NAME = 'USD Coin';
export const EIP3009_DOMAIN_VERSION = '2';

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

export function eip3009Domain(chainId: number, tokenAddress: string) {
    return {
        name: EIP3009_DOMAIN_NAME,
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

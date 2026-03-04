/**
 * SocialConnect Service
 *
 * @ts-nocheck
 *
 * Core Principles:
 * - CLEAN: Explicit dependencies on viem and @celo/identity
 * - MODULAR: Independent service for identifier resolution
 * - DRY: Single source of truth for SocialConnect logic
 * - PERFORMANT: Uses ODIS with proper blinding
 */
import { Address } from 'viem';
export declare enum IdentifierPrefix {
    PHONE_NUMBER = "tel:",
    EMAIL = "mailto:",
    TWITTER = "tw:"
}
export declare class SocialConnectService {
    private client;
    private isTestnet;
    private issuerAddress;
    constructor(options: {
        rpcUrl?: string;
        isTestnet?: boolean;
        issuerAddress?: Address;
    });
    /**
     * Resolve a plaintext identifier (e.g. phone number) to a wallet address
     */
    resolveIdentifier(plaintextIdentifier: string, prefix: IdentifierPrefix | undefined, authSigner: any): Promise<Address | null>;
    /**
     * Helper to create a Viem-compatible AuthSigner for ODIS
     */
    static createViemAuthSigner(walletClient: any, account: Address): any;
}
//# sourceMappingURL=social-connect-service.d.ts.map
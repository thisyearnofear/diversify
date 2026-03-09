/**
 * ERC-7715 Session Key Service
 * Implements scoped, time-limited session permissions for the Guardian agent.
 * Replaces the server-side master private key anti-pattern with a non-custodial
 * "co-signer" model: the user signs a permission grant in their wallet, and the
 * server only ever holds a disposable session key scoped to that grant.
 *
 * Flow:
 *   1. Client calls generateSessionKey() → gets a disposable keypair
 *   2. Client presents the SessionPermission to the user's wallet for signing
 *   3. Signed permission + session public key are sent to the server
 *   4. Server validates the permission and uses SessionKeyProvider (not a master key)
 *   5. Permission expires automatically; user can revoke at any time
 */

import { ethers } from 'ethers';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutonomyLevel = 'ADVISORY' | 'COPILOT' | 'GUARDIAN';

/** Allowlisted on-chain actions the session key may call */
export type AllowedAction = 'swap' | 'rebalance' | 'bridge' | 'approve';

/** Allowlisted token symbols the session key may touch */
export type AllowedToken = 'USDC' | 'EURC' | 'PAXG' | 'ETH' | 'WBTC';

/**
 * The permission object the user signs in their wallet.
 * Mirrors the ERC-7715 "Permission" structure.
 */
export interface SessionPermission {
    /** Disposable server-side session address (public key only) */
    sessionKeyAddress: string;
    /** User's wallet address — the "owner" */
    userAddress: string;
    /** Maximum USD value the session key may spend in total */
    spendingLimitUSD: number;
    /** Maximum USD value per day */
    dailyLimitUSD: number;
    /** On-chain actions the session key is allowed to call */
    allowedActions: AllowedAction[];
    /** Token symbols the session key is allowed to touch */
    allowedTokens: AllowedToken[];
    /** Unix timestamp when this permission expires */
    expiresAt: number;
    /** Autonomy tier that requested this permission */
    autonomyLevel: AutonomyLevel;
    /** Chain ID this permission is valid on */
    chainId: number;
    /** Nonce to prevent replay attacks */
    nonce: string;
}

/** A session permission that has been signed by the user's wallet */
export interface SignedSessionPermission {
    permission: SessionPermission;
    /** EIP-712 signature from the user's wallet */
    signature: string;
    /** ISO timestamp when the signature was created */
    signedAt: string;
}

/** Disposable keypair generated server-side (or client-side) for a session */
export interface SessionKeyPair {
    /** Private key — only ever sent to the server over TLS, never stored */
    privateKey: string;
    /** Public address — embedded in the SessionPermission the user signs */
    address: string;
    /** When this keypair was generated */
    createdAt: string;
}

/** Validation result returned by verifySignedPermission() */
export interface PermissionValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// ─── EIP-712 Domain & Types ───────────────────────────────────────────────────

const EIP712_DOMAIN_NAME = 'DiversiFi Guardian';
const EIP712_DOMAIN_VERSION = '1';

function buildEIP712Domain(chainId: number) {
    return {
        name: EIP712_DOMAIN_NAME,
        version: EIP712_DOMAIN_VERSION,
        chainId,
    };
}

const EIP712_TYPES = {
    SessionPermission: [
        { name: 'sessionKeyAddress', type: 'address' },
        { name: 'userAddress', type: 'address' },
        { name: 'spendingLimitUSD', type: 'uint256' },
        { name: 'dailyLimitUSD', type: 'uint256' },
        { name: 'allowedActions', type: 'string' },
        { name: 'allowedTokens', type: 'string' },
        { name: 'expiresAt', type: 'uint256' },
        { name: 'autonomyLevel', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
};

// ─── Default permission scopes per autonomy level ────────────────────────────

const AUTONOMY_DEFAULTS: Record<AutonomyLevel, Pick<SessionPermission, 'spendingLimitUSD' | 'dailyLimitUSD' | 'allowedActions' | 'allowedTokens'>> = {
    ADVISORY: {
        spendingLimitUSD: 0,       // Advisory never spends autonomously
        dailyLimitUSD: 0,
        allowedActions: [],
        allowedTokens: [],
    },
    COPILOT: {
        spendingLimitUSD: 100,     // $100 protection budget
        dailyLimitUSD: 100,
        allowedActions: ['swap', 'rebalance'],
        allowedTokens: ['USDC', 'EURC', 'PAXG'],
    },
    GUARDIAN: {
        spendingLimitUSD: 500,     // Recurring limit, enforced per-day
        dailyLimitUSD: 10,
        allowedActions: ['swap', 'rebalance', 'bridge', 'approve'],
        allowedTokens: ['USDC', 'EURC', 'PAXG', 'ETH', 'WBTC'],
    },
};

/** TTL in seconds per autonomy level */
const PERMISSION_TTL: Record<AutonomyLevel, number> = {
    ADVISORY: 0,
    COPILOT: 7 * 24 * 60 * 60,   // 7 days
    GUARDIAN: 7 * 24 * 60 * 60,  // 7 days (renewable)
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class ERC7715Service {
    /**
     * Generate a disposable session keypair.
     * In the Guardian flow the server generates this and sends only the
     * `address` to the client; the `privateKey` never leaves the server.
     */
    generateSessionKey(): SessionKeyPair {
        const wallet = ethers.Wallet.createRandom();
        return {
            privateKey: wallet.privateKey,
            address: wallet.address,
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Build a SessionPermission object ready for the user to sign.
     * Overrides can narrow the defaults (e.g. user sets a lower daily limit).
     */
    buildPermission(
        sessionKeyAddress: string,
        userAddress: string,
        autonomyLevel: AutonomyLevel,
        chainId: number,
        overrides?: Partial<Pick<SessionPermission, 'spendingLimitUSD' | 'dailyLimitUSD' | 'allowedActions' | 'allowedTokens'>>
    ): SessionPermission {
        const defaults = AUTONOMY_DEFAULTS[autonomyLevel];
        const ttl = PERMISSION_TTL[autonomyLevel];

        return {
            sessionKeyAddress,
            userAddress,
            spendingLimitUSD: overrides?.spendingLimitUSD ?? defaults.spendingLimitUSD,
            dailyLimitUSD: overrides?.dailyLimitUSD ?? defaults.dailyLimitUSD,
            allowedActions: overrides?.allowedActions ?? defaults.allowedActions,
            allowedTokens: overrides?.allowedTokens ?? defaults.allowedTokens,
            expiresAt: ttl > 0 ? Math.floor(Date.now() / 1000) + ttl : 0,
            autonomyLevel,
            chainId,
            nonce: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
        };
    }

    /**
     * Sign a SessionPermission using the user's ethers Signer (client-side).
     * In the browser this triggers a MetaMask / Privy signature request.
     */
    async signPermission(
        permission: SessionPermission,
        signer: ethers.Signer
    ): Promise<SignedSessionPermission> {
        const domain = buildEIP712Domain(permission.chainId);
        const value = {
            ...permission,
            allowedActions: permission.allowedActions.join(','),
            allowedTokens: permission.allowedTokens.join(','),
            nonce: permission.nonce,
        };

        const signature = await (signer as any)._signTypedData(domain, EIP712_TYPES, value);

        return {
            permission,
            signature,
            signedAt: new Date().toISOString(),
        };
    }

    /**
     * Verify a SignedSessionPermission on the server.
     * Checks: signature validity, expiry, chain ID, spending limits.
     */
    verifySignedPermission(
        signed: SignedSessionPermission,
        expectedChainId: number
    ): PermissionValidation {
        const errors: string[] = [];
        const warnings: string[] = [];
        const { permission, signature } = signed;

        // 1. Expiry check
        const now = Math.floor(Date.now() / 1000);
        if (permission.expiresAt > 0 && permission.expiresAt < now) {
            errors.push('Session permission has expired');
        }
        if (permission.expiresAt > 0 && permission.expiresAt - now < 3600) {
            warnings.push('Session permission expires in less than 1 hour');
        }

        // 2. Chain ID check
        if (permission.chainId !== expectedChainId) {
            errors.push(`Chain ID mismatch: expected ${expectedChainId}, got ${permission.chainId}`);
        }

        // 3. Spending limit sanity
        if (permission.dailyLimitUSD > 1000) {
            warnings.push('Daily limit exceeds $1,000 — consider a lower value');
        }
        if (permission.spendingLimitUSD > 10000) {
            warnings.push('Total spending limit exceeds $10,000 — consider a lower value');
        }

        // 4. Signature recovery — confirms the user's wallet signed this
        try {
            const domain = buildEIP712Domain(permission.chainId);
            const value = {
                ...permission,
                allowedActions: permission.allowedActions.join(','),
                allowedTokens: permission.allowedTokens.join(','),
            };
            const recovered = ethers.utils.verifyTypedData(domain, EIP712_TYPES, value, signature);
            if (recovered.toLowerCase() !== permission.userAddress.toLowerCase()) {
                errors.push(
                    `Signature mismatch: recovered ${recovered}, expected ${permission.userAddress}`
                );
            }
        } catch (e) {
            errors.push(`Signature verification failed: ${(e as Error).message}`);
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    /**
     * Check whether a proposed action is within the permission scope.
     * Called by SessionKeyProvider before executing any transaction.
     */
    isActionAllowed(
        permission: SessionPermission,
        action: AllowedAction,
        token: AllowedToken,
        amountUSD: number,
        alreadySpentTodayUSD: number
    ): { allowed: boolean; reason?: string } {
        if (!permission.allowedActions.includes(action)) {
            return { allowed: false, reason: `Action '${action}' is not in the permission scope` };
        }
        if (!permission.allowedTokens.includes(token)) {
            return { allowed: false, reason: `Token '${token}' is not in the permission scope` };
        }
        if (alreadySpentTodayUSD + amountUSD > permission.dailyLimitUSD) {
            return {
                allowed: false,
                reason: `Daily limit of $${permission.dailyLimitUSD} would be exceeded ($${alreadySpentTodayUSD} already spent today)`,
            };
        }
        return { allowed: true };
    }

    /**
     * Produce a human-readable summary of a permission for display in the UI
     * ("Proof of Protection" transparency layer).
     */
    describePermission(permission: SessionPermission): string {
        const expiry = permission.expiresAt > 0
            ? new Date(permission.expiresAt * 1000).toLocaleDateString()
            : 'never';
        return [
            `Autonomy: ${permission.autonomyLevel}`,
            `Daily limit: $${permission.dailyLimitUSD}`,
            `Total limit: $${permission.spendingLimitUSD}`,
            `Allowed actions: ${permission.allowedActions.join(', ') || 'none'}`,
            `Allowed tokens: ${permission.allowedTokens.join(', ') || 'none'}`,
            `Expires: ${expiry}`,
        ].join(' · ');
    }
}

export const erc7715Service = new ERC7715Service();

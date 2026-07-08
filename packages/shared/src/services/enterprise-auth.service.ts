/**
 * Enterprise API-key authentication for the DiversiFi intelligence gateway.
 *
 * Minimal v1: keys are configured via env (`ENTERPRISE_API_KEYS` as a JSON
 * array). The x402 on-chain payment path remains the public route; this is an
 * additive, parallel auth for enterprise tenants that want per-key quota and a
 * tenant-scoped audit surface without managing on-chain USDC per request.
 *
 * The resolved tenant config is passed through to the gateway (per-key rate
 * limit) and to the audit-export endpoint (tenant scoping). An enterprise key
 * is also stamped onto every recommendation it triggers via `tenantId`, so the
 * off-chain audit index can scope a tenant's verifiable decisions.
 */

export interface EnterpriseKey {
    /** The secret presented in the `x-api-key` header. */
    key: string;
    /** Stable tenant identifier used for audit scoping and attribution. */
    tenantId: string;
    tier: 'enterprise' | 'partner';
    /** Requests per minute for this key (overrides the gateway default). */
    rateLimit: number;
    /** Monthly USDC quota (informational; not yet hard-enforced). */
    quotaUsd: number;
    /** Whether this key's consumption is recorded to the tenant audit index. */
    audit: boolean;
}

function loadKeys(): EnterpriseKey[] {
    const raw = process.env.ENTERPRISE_API_KEYS;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as EnterpriseKey[];
        if (parsed && typeof parsed === 'object') return [parsed as EnterpriseKey];
    } catch {
        console.warn('[EnterpriseAuth] ENTERPRISE_API_KEYS is not valid JSON');
    }
    return [];
}

/**
 * Validate an API key presented in the `x-api-key` header.
 * Returns the resolved tenant config, or null if missing/invalid.
 *
 * Note: this is a constant-equality compare (prototype-grade). For production,
 * store only key hashes and use a timing-safe compare.
 */
export function validateApiKey(rawKey?: string): EnterpriseKey | null {
    if (!rawKey) return null;
    const keys = loadKeys();
    const match = keys.find((k) => k.key && k.key === rawKey);
    return match ?? null;
}

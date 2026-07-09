import { timingSafeEqual, createHash } from 'crypto';

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Returns false if lengths differ without leaking which string is longer
 * beyond the length difference itself.
 */
export function constantTimeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = typeof a === 'string' ? Buffer.from(a, 'utf8') : a;
    const bufB = typeof b === 'string' ? Buffer.from(b, 'utf8') : b;
    if (bufA.length !== bufB.length) {
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

/**
 * Compute a deterministic, collision-resistant hash for a payment proof.
 * Used as a stable lookup key for deduplication stores.
 */
export function hashPaymentProof(proof: string): string {
    return createHash('sha256').update(proof).digest('hex');
}

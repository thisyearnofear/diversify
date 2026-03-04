/**
 * Unified Cache Service
 * Centralized caching with smart TTL management and advanced features
 */
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    source: string;
    etag?: string;
    lastAccessed: number;
}
export type CacheCategory = 'volatile' | 'moderate' | 'stable' | 'static';
export declare class UnifiedCacheService {
    private cache;
    private readonly MAX_CACHE_SIZE;
    private readonly CLEANUP_INTERVAL;
    private cleanupTimer;
    private readonly TTL_CONFIG;
    constructor();
    private pendingRequests;
    /**
     * Get data from cache or fetch if expired/missing
     */
    getOrFetch<T>(key: string, fetchFn: () => Promise<{
        data: T;
        source: string;
        etag?: string;
    }>, category?: CacheCategory, forceRefresh?: boolean): Promise<{
        data: T;
        source: string;
        fromCache: boolean;
    }>;
    /**
     * Set data in cache
     */
    set<T>(key: string, data: T, ttl: number, source: string, etag?: string): void;
    /**
     * Force refresh specific cache entry
     */
    refresh<T>(key: string, fetchFn: () => Promise<{
        data: T;
        source: string;
        etag?: string;
    }>, category?: CacheCategory): Promise<T>;
    /**
     * Warm cache with frequently requested data
     */
    warmCache(warmupFunctions: Array<() => Promise<void>>): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hitRate: number;
        totalRequests: number;
        categories: Record<CacheCategory, number>;
    };
    /**
     * Clear cache entries by pattern or all
     */
    clear(pattern?: string): void;
    /**
     * Private methods
     */
    private evictLeastRecentlyUsed;
    private startCleanupProcess;
    private cleanupExpiredEntries;
    destroy(): void;
}
export declare const unifiedCache: UnifiedCacheService;
//# sourceMappingURL=unified-cache-service.d.ts.map
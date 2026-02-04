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

export class UnifiedCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Smart TTL configuration based on data volatility
  private readonly TTL_CONFIG: Record<CacheCategory, number> = {
    volatile: 1000 * 60 * 15,    // 15 minutes - exchange rates, stock prices
    moderate: 1000 * 60 * 60,    // 1 hour - inflation data, economic indicators
    stable: 1000 * 60 * 60 * 6,  // 6 hours - country data, static reference data
    static: 1000 * 60 * 60 * 24  // 24 hours - very stable data
  };

  constructor() {
    this.startCleanupProcess();
  }

  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Get data from cache or fetch if expired/missing
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<{ data: T; source: string; etag?: string }>,
    category: CacheCategory = 'moderate',
    forceRefresh = false
  ): Promise<{ data: T; source: string; fromCache: boolean }> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Check if we should use cached data
    if (!forceRefresh && cached && now - cached.timestamp < cached.ttl) {
      // Update last accessed time
      cached.lastAccessed = now;

      return {
        data: cached.data,
        source: `${cached.source} (cached)`,
        fromCache: true
      };
    }

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      console.log(`[Cache] Coalescing request for key: ${key}`);
      const data = await this.pendingRequests.get(key);
      return {
        data,
        source: 'coalesced',
        fromCache: false
      };
    }

    try {
      // Create and track the fetch promise
      const fetchPromise = (async () => {
        const result = await fetchFn();
        return result;
      })();

      this.pendingRequests.set(key, fetchPromise.then(r => r.data));

      // Fetch fresh data
      const result = await fetchPromise;
      const ttl = this.TTL_CONFIG[category];

      // Store in cache
      this.set(key, result.data, ttl, result.source, result.etag);

      return {
        data: result.data,
        source: result.source,
        fromCache: false
      };
    } catch (error) {
      // Serve stale data if available and reasonably recent
      if (cached && now - cached.timestamp < cached.ttl * 3) {
        console.warn(`Serving stale cache for ${key} due to fetch error`);
        cached.lastAccessed = now;

        return {
          data: cached.data,
          source: `${cached.source} (stale)`,
          fromCache: true
        };
      }

      throw error;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl: number, source: string, etag?: string): void {
    // Manage cache size
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      source,
      etag,
      lastAccessed: Date.now()
    });
  }

  /**
   * Force refresh specific cache entry
   */
  async refresh<T>(
    key: string,
    fetchFn: () => Promise<{ data: T; source: string; etag?: string }>,
    category: CacheCategory = 'moderate'
  ): Promise<T> {
    const result = await fetchFn();
    const ttl = this.TTL_CONFIG[category];

    this.set(key, result.data, ttl, result.source, result.etag);
    return result.data;
  }

  /**
   * Warm cache with frequently requested data
   */
  async warmCache(warmupFunctions: Array<() => Promise<void>>): Promise<void> {
    console.log('Warming up cache...');
    const startTime = Date.now();

    await Promise.all(
      warmupFunctions.map(async (warmupFn, index) => {
        try {
          await warmupFn();
          console.log(`✓ Warmed cache entry ${index + 1}/${warmupFunctions.length}`);
        } catch (error) {
          console.warn(`✗ Failed to warm cache entry ${index + 1}:`, error);
        }
      })
    );

    console.log(`Cache warmup completed in ${Date.now() - startTime}ms`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    totalRequests: number;
    categories: Record<CacheCategory, number>;
  } {
    const categories: Record<CacheCategory, number> = {
      volatile: 0,
      moderate: 0,
      stable: 0,
      static: 0
    };

    this.cache.forEach(entry => {
      // Approximate category based on TTL
      if (entry.ttl <= this.TTL_CONFIG.volatile) {
        categories.volatile++;
      } else if (entry.ttl <= this.TTL_CONFIG.moderate) {
        categories.moderate++;
      } else if (entry.ttl <= this.TTL_CONFIG.stable) {
        categories.stable++;
      } else {
        categories.static++;
      }
    });

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      totalRequests: 0, // Would need to track
      categories
    };
  }

  /**
   * Clear cache entries by pattern or all
   */
  clear(pattern?: string): void {
    if (pattern) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key =>
        key.includes(pattern)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Private methods
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove 10% of least recently used entries
    const removeCount = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired cache entries`);
    }
  }

  // Cleanup on destruction
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}

// Export singleton instance
export const unifiedCache = new UnifiedCacheService();
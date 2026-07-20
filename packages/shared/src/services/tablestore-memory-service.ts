/**
 * Tablestore Agent Memory Service
 *
 * Alibaba Cloud Tablestore-native persistent agent memory. Uses the official
 * Tablestore Node.js SDK (`tablestore@^5.6.5`) Memory Storage API
 * (createMemoryStore, addMemories, searchMemories, deleteMemory) for
 * long-term memory with automatic extraction, vector search, and
 * cross-session scoping.
 *
 * This is the Alibaba Cloud deployment proof file for the Qwen Cloud
 * Hackathon Track 1 (MemoryAgent). It demonstrates use of Alibaba Cloud
 * services and APIs — specifically Tablestore's Agent Memory feature.
 *
 * Architectural principle: Alibaba Cloud is an accelerator, not a dependency.
 * When `TABLESTORE_ENDPOINT` is unset, `isAvailable()` returns false and the
 * memory consolidation service falls back to Cognee. Zero behavior change for
 * deployments that don't use Alibaba Cloud.
 *
 * Integration points:
 *   - Called from `memoryConsolidationService` as the preferred memory backend
 *     when available (Cognee is the fallback)
 *   - Uses the same interface as `cogneeMemoryService` (remember/recall/sweep)
 *     so the consolidation service can swap between them transparently
 *   - The Tablestore Memory Storage API automatically extracts long-term
 *     memories from conversation messages — a second extraction pass on top
 *     of our Qwen-based consolidation
 *
 * Alibaba Cloud services used:
 *   - Tablestore (Agent Memory feature) — persistent memory store with vector
 *     search, automatic long-term memory extraction, and short-term/long-term
 *     separation
 *   - DashScope (Alibaba Cloud Bailian) — Qwen long-context LLM for
 *     consolidation (called from the FC function, not here)
 *
 * See: https://help.aliyun.com/en/tablestore/memory-storage-nodejs-sdk
 */

 
const TableStore = require('tablestore') as any;

/**
 * Tablestore instance endpoint, e.g.
 *   "https://my-instance.cn-beijing.ots.aliyuncs.com"
 */
const TABLESTORE_ENDPOINT = process.env.TABLESTORE_ENDPOINT || '';
const TABLESTORE_INSTANCE = process.env.TABLESTORE_INSTANCE_NAME || '';
const TABLESTORE_ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
const TABLESTORE_ACCESS_KEY_SECRET =
  process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';

/**
 * The memory store name within Tablestore. Created once via
 * `createMemoryStore` (or via the console). All addMemories/searchMemories
 * calls reference this name.
 */
const TABLESTORE_MEMORY_STORE_NAME =
  process.env.TABLESTORE_MEMORY_STORE_NAME || 'diversifi_agent_memory';

/**
 * App identifier for scoping memories. In a multi-tenant deployment this
 * would be the product/app ID; for DiversiFi it's a constant.
 */
const TABLESTORE_APP_ID = process.env.TABLESTORE_APP_ID || 'diversifi';

/**
 * Memory TTL in days — mirrors the Cognee decay window. The Tablestore
 * Memory Storage API doesn't have built-in TTL, so we use this to filter
 * stale memories on the client side during recall and sweep.
 */
const TABLESTORE_MEMORY_TTL_DAYS =
  Number(process.env.TABLESTORE_MEMORY_TTL_DAYS) || 30;
const DAY_MS = 86_400_000;

interface TablestoreMemory {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface TablestoreRecallResult {
  memories: TablestoreMemory[];
}

interface RememberOptions {
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

class TablestoreMemoryServiceImpl {
  private client: any | null = null;
  private endpoint: string;
  private instanceName: string;
  private accessKeyId: string;
  private accessKeySecret: string;
  private memoryStoreName: string;
  private appId: string;
  private enabled: boolean;
  private memoryStoreEnsured: boolean;

  constructor() {
    this.endpoint = TABLESTORE_ENDPOINT;
    this.instanceName = TABLESTORE_INSTANCE;
    this.accessKeyId = TABLESTORE_ACCESS_KEY_ID;
    this.accessKeySecret = TABLESTORE_ACCESS_KEY_SECRET;
    this.memoryStoreName = TABLESTORE_MEMORY_STORE_NAME;
    this.appId = TABLESTORE_APP_ID;
    this.enabled = !!(
      this.endpoint &&
      this.instanceName &&
      this.accessKeyId &&
      this.accessKeySecret
    );
    this.memoryStoreEnsured = false;
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Lazily initialize the Tablestore client. The SDK client is created on
   * first use to avoid importing the native module when the service is
   * not configured (inert when unset).
   */
  private getClient(): any {
    if (!this.client) {
      this.client = new TableStore.Client({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.accessKeySecret,
        endpoint: this.endpoint,
        instancename: this.instanceName,
      });
    }
    return this.client;
  }

  /**
   * Ensure the memory store exists. Creates it on first call. Idempotent —
   * if it already exists, the create call fails silently.
   */
  private async ensureMemoryStore(): Promise<void> {
    if (this.memoryStoreEnsured) return;
    const client = this.getClient();
    try {
      await client.createMemoryStore({
        memoryStoreName: this.memoryStoreName,
        description:
          'DiversiFi agent long-term memory store (Qwen Cloud Hackathon Track 1)',
      });
    } catch (err: any) {
      // Already exists — this is expected on subsequent calls
      if (
        err?.message &&
        !/already exist|ObjectAlreadyExist|4002/i.test(err.message)
      ) {
        // Real error — log but don't throw (the store may have been created
        // via the console; we'll find out on the first real operation)
        console.warn('[Tablestore] createMemoryStore warning:', err.message);
      }
    }
    this.memoryStoreEnsured = true;
  }

  /**
   * Store a memory in Tablestore's Agent Memory store.
   *
   * Uses `addMemories` with the `text` field (preprocessed text) rather than
   * `messages` (conversation messages), since our consolidation pipeline
   * already preprocesses memories into structured text before storing.
   *
   * The Tablestore service will:
   *   1. Save the raw text as short-term memory
   *   2. Extract long-term memory signals in the background (async extraction)
   *
   * When `sync: true` is set, extraction runs synchronously and the API
   * returns after extraction completes. We use `sync: false` (default) for
   * writes to avoid blocking — the extracted long-term memories become
   * available for search within seconds.
   */
  async remember(
    text: string,
    userId: string,
    options: RememberOptions = {}
  ): Promise<{ success: boolean; id?: string }> {
    if (!this.enabled) {
      return { success: false };
    }

    try {
      await this.ensureMemoryStore();
      const client = this.getClient();

      const result = await client.addMemories({
        memoryStoreName: this.memoryStoreName,
        scope: {
          appId: this.appId,
          tenantId: userId,
          agentId: 'guardian',
          runId: options.sessionId || 'default',
        },
        text,
        metadata: {
          timestamp: new Date().toISOString(),
          ...options.metadata,
        },
        sync: false,
      });

      return {
        success: true,
        id: result?.memoryId || result?.id,
      };
    } catch (error) {
      console.warn('[Tablestore] remember error:', error);
      return { success: false };
    }
  }

  /**
   * Recall relevant memories for a query using Tablestore's vector search.
   *
   * Uses `searchMemories` with `agentId: '*'` and `runId: '*'` to search
   * across all sessions and agents for the given user. The API performs
   * vector similarity search on the extracted long-term memories.
   *
   * Results are filtered by TTL on the client side (Tablestore doesn't have
   * built-in TTL for the memory store, so we apply the same decay window as
   * the Cognee path).
   */
  async recall(
    query: string,
    userId: string,
    options: { sessionId?: string; limit?: number } = {}
  ): Promise<TablestoreRecallResult> {
    if (!this.enabled) {
      return { memories: [] };
    }

    try {
      const client = this.getClient();

      const result = await client.searchMemories({
        memoryStoreName: this.memoryStoreName,
        scope: {
          appId: this.appId,
          tenantId: userId,
          agentId: '*',
          runId: '*',
        },
        query,
        topK: options.limit || 5,
        enableRerank: true,
      });

      const now = Date.now();
      const memories: TablestoreMemory[] = (result.results || [])
        .map((item: any) => ({
          id: item.unit?.id || item.id || '',
          content: item.unit?.text || item.text || '',
          score: item.score || 0,
          metadata: item.unit?.metadata || item.metadata || {},
        }))
        .filter((m: TablestoreMemory) => {
          // Client-side TTL filter — mirrors Cognee decay
          const ts = m.metadata?.timestamp as string | undefined;
          if (!ts) return true;
          const ageDays = (now - new Date(ts).getTime()) / DAY_MS;
          return ageDays < TABLESTORE_MEMORY_TTL_DAYS * 2;
        });

      return { memories };
    } catch (error) {
      console.warn('[Tablestore] recall error:', error);
      return { memories: [] };
    }
  }

  /**
   * Sweep stale memories for a user — the "hard forgetting" layer.
   *
   * Searches a broad pool of memories, identifies those older than 2×TTL,
   * and deletes them via the `deleteMemory` API. Returns a summary of what
   * was evicted.
   *
   * This mirrors the Cognee sweepStaleMemories interface so the
   * consolidation service can use either backend transparently.
   */
  async sweepStaleMemories(
    userId: string,
    options: { evictBelowScore?: number; poolSize?: number } = {}
  ): Promise<{ swept: number; attempted: number; evicted: number }> {
    if (!this.enabled || !userId) {
      return { swept: 0, attempted: 0, evicted: 0 };
    }

    const poolSize = options.poolSize ?? 50;
    const evictBelow = options.evictBelowScore ?? 0.1;

    try {
      // Broad search to find stale memories
      const { memories } = await this.recall(
        'user preferences recommendations portfolio actions philosophy risk tolerance',
        userId,
        { limit: poolSize }
      );

      const now = Date.now();
      const stale = memories.filter((m) => {
        const ts = m.metadata?.timestamp as string | undefined;
        if (!ts) return false;
        const ageDays = (now - new Date(ts).getTime()) / DAY_MS;
        return ageDays >= TABLESTORE_MEMORY_TTL_DAYS * 2 || m.score < evictBelow;
      });

      if (stale.length === 0) {
        return { swept: memories.length, attempted: 0, evicted: 0 };
      }

      const client = this.getClient();
      let evicted = 0;
      for (const memory of stale) {
        if (!memory.id) continue;
        try {
          await client.deleteMemory({
            memoryStoreName: this.memoryStoreName,
            memoryId: memory.id,
            scope: {
              appId: this.appId,
              tenantId: userId,
              agentId: '*',
              runId: '*',
            },
          });
          evicted++;
        } catch {
          // Best-effort — stale memories are already filtered by TTL in recall
        }
      }

      return {
        swept: memories.length,
        attempted: stale.length,
        evicted,
      };
    } catch (error) {
      console.warn('[Tablestore] sweep error:', error);
      return { swept: 0, attempted: 0, evicted: 0 };
    }
  }

  /**
   * Forget all memories for a user (GDPR compliance / reset).
   * Uses `listMemories` to find all memories for a user, then deletes each.
   */
  async forget(userId: string): Promise<{ success: boolean }> {
    if (!this.enabled) {
      return { success: false };
    }

    try {
      const client = this.getClient();

      const listResult = await client.listMemories({
        memoryStoreName: this.memoryStoreName,
        scope: {
          appId: this.appId,
          tenantId: userId,
          agentId: '*',
          runId: '*',
        },
        limit: 1000,
      });

      const memories: Array<{ id?: string; memoryId?: string }> =
        listResult.memories || listResult.units || [];

      let deleted = 0;
      for (const mem of memories) {
        const id = mem.id || mem.memoryId;
        if (!id) continue;
        try {
          await client.deleteMemory({
            memoryStoreName: this.memoryStoreName,
            memoryId: id,
            scope: {
              appId: this.appId,
              tenantId: userId,
              agentId: '*',
              runId: '*',
            },
          });
          deleted++;
        } catch {
          // Best-effort
        }
      }

      return { success: deleted > 0 };
    } catch (error) {
      console.warn('[Tablestore] forget error:', error);
      return { success: false };
    }
  }

  /**
   * Build advisor context from memories — same interface as Cognee.
   * Returns a formatted string to inject into the system prompt.
   */
  async getAdvisorContext(
    userId: string,
    currentQuery: string
  ): Promise<string> {
    if (!this.enabled || !userId) {
      return '';
    }

    try {
      const { memories } = await this.recall(currentQuery, userId, {
        limit: 3,
      });

      if (memories.length === 0) {
        return '';
      }

      const contextLines = memories
        .filter((m) => m.score > 0.5)
        .map((m) => `- ${m.content}`)
        .slice(0, 3);

      if (contextLines.length === 0) {
        return '';
      }

      return `\nAGENT MEMORY (past interactions with this user):\n${contextLines.join('\n')}\nUse this context to provide more personalized advice. Reference past recommendations if relevant.\n`;
    } catch {
      return '';
    }
  }

  /**
   * Persist an interaction for future recall — same interface as Cognee.
   */
  async persistInteraction(
    userId: string,
    query: string,
    response: string,
    metadata?: { action?: string; sources?: string[]; chainId?: number }
  ): Promise<void> {
    if (!this.enabled || !userId) return;

    const summary = [
      `User asked: "${query.slice(0, 100)}"`,
      `Advisor recommended: ${response.slice(0, 200)}`,
      metadata?.action ? `Action suggested: ${metadata.action}` : '',
      metadata?.sources?.length
        ? `Sources used: ${metadata.sources.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('. ');

    await this.remember(summary, userId, {
      metadata: {
        type: 'interaction',
        ...metadata,
      },
    });
  }
}

// Singleton export
export const tablestoreMemoryService = new TablestoreMemoryServiceImpl();

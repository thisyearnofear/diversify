/**
 * Cognee Memory Service
 * Persistent agent memory using Cognee's REST API.
 * Gives the DiversiFi advisor cross-session learning:
 *   - Remembers past recommendations and their outcomes
 *   - Recalls user preferences and risk tolerance signals
 *   - Tracks portfolio changes over time for context
 *
 * Hackathon Partner: Cognee Challenge — "Best Use of Agent Memory"
 *
 * Core Operations:
 *   remember(text, userId) — store a fact or observation
 *   recall(query, userId)  — retrieve relevant memories
 *   forget(userId)         — clear a user's memory graph
 */

import { fetchWithTimeout } from '../utils/promise-utils';

const COGNEE_API_URL = process.env.COGNEE_API_URL || 'https://api.cognee.ai';
const COGNEE_API_KEY = process.env.COGNEE_API_KEY || '';
const COGNEE_TENANT_ID = process.env.COGNEE_TENANT_ID || '';

/**
 * Memory TTL in days. Memories older than this begin to decay (their recall
 * score is penalized proportional to age). At 2×TTL the score reaches zero
 * and the memory is a candidate for hard eviction via `sweepStaleMemories`.
 *
 * This implements the "timely forgetting of outdated information" requirement
 * for the Qwen Cloud MemoryAgent track: outdated info fades from the context
 * window (decay) and is eventually evicted (sweep), keeping the recall set
 * focused on what's current.
 *
 * Default 30 days. Override per-deploy with `COGNEE_MEMORY_TTL_DAYS`.
 */
const COGNEE_MEMORY_TTL_DAYS = Number(process.env.COGNEE_MEMORY_TTL_DAYS) || 30;
const DAY_MS = 86_400_000;

interface CogneeMemory {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface CogneeRecallResult {
  memories: CogneeMemory[];
  sessionId?: string;
}

interface RememberOptions {
  sessionId?: string;
  metadata?: Record<string, unknown>;
  dataset?: string;
}

class CogneeMemoryServiceImpl {
  private apiUrl: string;
  private apiKey: string;
  private tenantId: string;
  private enabled: boolean;

  constructor() {
    this.apiUrl = COGNEE_API_URL;
    this.apiKey = COGNEE_API_KEY;
    this.tenantId = COGNEE_TENANT_ID;
    this.enabled = !!this.apiKey;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.apiKey,
    };
    if (this.tenantId) {
      headers['X-Tenant-Id'] = this.tenantId;
    }
    return headers;
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Apply time-based decay to a memory's recall score.
   *
   * Memories fade from the context window as they age:
   *   - age < TTL:           no penalty (score unchanged)
   *   - TTL ≤ age < 2×TTL:   linear decay from full score → 0
   *   - age ≥ 2×TTL:         score is 0 (candidate for hard eviction)
   *
   * Age is read from `metadata.timestamp` (set on every `remember()` call).
   * A memory with no timestamp is treated as age 0 (never decays) — this
   * covers memories created before the decay feature shipped.
   *
   * This is the "soft forgetting" layer: outdated info is less likely to be
   * injected into the advisor's context window, even if Cognee's relevance
   * score is high. The "hard forgetting" layer is `sweepStaleMemories`.
   */
  private applyDecay(memory: CogneeMemory): CogneeMemory {
    const ts = memory.metadata?.timestamp as string | undefined;
    if (!ts) return memory;

    const ageMs = Date.now() - new Date(ts).getTime();
    if (ageMs <= 0) return memory;

    const ageDays = ageMs / DAY_MS;
    if (ageDays < COGNEE_MEMORY_TTL_DAYS) return memory;

    const decayFactor = Math.max(0, 1 - (ageDays - COGNEE_MEMORY_TTL_DAYS) / COGNEE_MEMORY_TTL_DAYS);
    return { ...memory, score: memory.score * decayFactor };
  }

  /**
   * Store a memory in Cognee's knowledge graph.
   * Used to persist: recommendations made, user preferences observed,
   * portfolio snapshots, and outcome tracking.
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
      const dataset = options.dataset || `user_${userId}`;
      const payload = {
        data: text,
        dataset_name: dataset,
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
          ...options.metadata,
        },
      };

      const response = await fetch(`${this.apiUrl}/v1/add`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`[Cognee] remember failed: ${response.status}`);
        return { success: false };
      }

      const result = await response.json();

      // Trigger cognify (graph processing) in background
      this.cognify(dataset).catch(() => {});

      return { success: true, id: result.id || result.dataset_id };
    } catch (error) {
      console.warn('[Cognee] remember error:', error);
      return { success: false };
    }
  }

  /**
   * Recall relevant memories for a query.
   * The advisor uses this to inject past context before generating a response.
   */
  async recall(
    query: string,
    userId: string,
    options: { sessionId?: string; limit?: number } = {}
  ): Promise<CogneeRecallResult> {
    if (!this.enabled) {
      return { memories: [] };
    }

    try {
      const dataset = `user_${userId}`;
      const payload = {
        query,
        datasets: [dataset],
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
        top_k: options.limit || 5,
      };

      const response = await fetchWithTimeout(`${this.apiUrl}/v1/search`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      }, 2500);

      if (!response.ok) {
        console.warn(`[Cognee] recall failed: ${response.status}`);
        return { memories: [] };
      }

      const result = await response.json();
      const memories: CogneeMemory[] = (result.data || result.results || []).map((item: any) => ({
        id: item.id || item.node_id || '',
        content: item.text || item.content || item.payload?.text || '',
        score: item.score || item.relevance || 0,
        metadata: item.metadata || item.payload?.metadata,
      }));

      return { memories, sessionId: options.sessionId };
    } catch (error) {
      console.warn('[Cognee] recall error:', error);
      return { memories: [] };
    }
  }

  /**
   * Forget all memories for a user (GDPR compliance / reset).
   */
  async forget(userId: string): Promise<{ success: boolean }> {
    if (!this.enabled) {
      return { success: false };
    }

    try {
      const dataset = `user_${userId}`;
      const response = await fetch(`${this.apiUrl}/v1/datasets/${dataset}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });

      return { success: response.ok };
    } catch (error) {
      console.warn('[Cognee] forget error:', error);
      return { success: false };
    }
  }

  /**
   * Sweep stale memories for a user — the "hard forgetting" layer.
   *
   * Recalls a broad pool of recent memories, identifies those whose decayed
   * score has dropped below the eviction threshold (age ≥ 2×TTL), and
   * attempts per-memory deletion via the Cognee API. Gracefully no-ops if
   * the per-memory delete endpoint is unavailable — in that case the
   * memories are already effectively invisible to recall (decayed score 0
   * never passes the `> 0.5` filter in `getAdvisorContext`).
   *
   * Intended to be called periodically (e.g. from the Guardian heartbeat
   * cron) — not on every request. Returns a summary of what was evicted.
   *
   * This closes the "timely forgetting of outdated information" requirement:
   * decay handles soft forgetting (outdated info fades from context), sweep
   * handles hard forgetting (dead memories are evicted from the store).
   */
  async sweepStaleMemories(
    userId: string,
    options: { evictBelowScore?: number; poolSize?: number } = {}
  ): Promise<{ swept: number; attempted: number; evicted: number }> {
    if (!this.enabled || !userId) {
      return { swept: 0, attempted: 0, evicted: 0 };
    }

    const evictBelow = options.evictBelowScore ?? 0.1;
    const poolSize = options.poolSize ?? 50;

    try {
      const dataset = `user_${userId}`;
      const payload = {
        query: 'user preferences recommendations portfolio actions',
        datasets: [dataset],
        top_k: poolSize,
      };

      const response = await fetchWithTimeout(`${this.apiUrl}/v1/search`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      }, 5000);

      if (!response.ok) {
        console.warn(`[Cognee] sweep recall failed: ${response.status}`);
        return { swept: 0, attempted: 0, evicted: 0 };
      }

      const result = await response.json();
      const all: CogneeMemory[] = (result.data || result.results || []).map((item: any) => ({
        id: item.id || item.node_id || '',
        content: item.text || item.content || item.payload?.text || '',
        score: item.score || item.relevance || 0,
        metadata: item.metadata || item.payload?.metadata,
      }));

      const stale = all
        .map(m => this.applyDecay(m))
        .filter(m => m.score < evictBelow && m.id);

      if (stale.length === 0) {
        return { swept: all.length, attempted: 0, evicted: 0 };
      }

      let evicted = 0;
      for (const memory of stale) {
        try {
          const del = await fetchWithTimeout(`${this.apiUrl}/v1/memories/${memory.id}`, {
            method: 'DELETE',
            headers: this.authHeaders(),
          }, 2000);
          if (del.ok) evicted++;
        } catch {
          // Per-memory delete may not be supported by this Cognee version —
          // the memory is already invisible to recall (decayed score 0), so
          // this is a best-effort cleanup, not a correctness requirement.
        }
      }

      return { swept: all.length, attempted: stale.length, evicted };
    } catch (error) {
      console.warn('[Cognee] sweep error:', error);
      return { swept: 0, attempted: 0, evicted: 0 };
    }
  }

  /**
   * Build the knowledge graph from stored data (async background).
   */
  private async cognify(dataset: string): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/v1/cognify`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ datasets: [dataset] }),
      });
    } catch {
      // Non-critical — graph builds asynchronously
    }
  }

  /**
   * Build advisor context from memories.
   * Returns a formatted string to inject into the system prompt.
   */
  async getAdvisorContext(userId: string, currentQuery: string): Promise<string> {
    if (!this.enabled || !userId) {
      return '';
    }

    try {
      const { memories } = await this.recall(currentQuery, userId, { limit: 3 });
      
      if (memories.length === 0) {
        return '';
      }

      const contextLines = memories
        .map(m => this.applyDecay(m))
        .filter(m => m.score > 0.5)
        .map(m => `- ${m.content}`)
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
   * After the advisor responds, persist the interaction for future recall.
   */
  async persistInteraction(
    userId: string,
    query: string,
    response: string,
    metadata?: { action?: string; sources?: string[]; chainId?: number }
  ): Promise<void> {
    if (!this.enabled || !userId) return;

    // Condense the interaction into a memory-friendly format
    const summary = [
      `User asked: "${query.slice(0, 100)}"`,
      `Advisor recommended: ${response.slice(0, 200)}`,
      metadata?.action ? `Action suggested: ${metadata.action}` : '',
      metadata?.sources?.length ? `Sources used: ${metadata.sources.join(', ')}` : '',
    ].filter(Boolean).join('. ');

    await this.remember(summary, userId, {
      metadata: {
        type: 'interaction',
        ...metadata,
      },
    });
  }
}

// Singleton export
export const cogneeMemoryService = new CogneeMemoryServiceImpl();

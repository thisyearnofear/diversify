/**
 * Cognee Memory Service — Cognee Cloud HTTP API.
 *
 * Cognee Cloud is tenant-scoped: each account gets its own base URL
 * (`https://<tenant>.aws.cognee.ai`, from the dashboard) and every path
 * lives under `/api/v1`. Auth headers are `X-Api-Key` always plus
 * `X-Tenant-Id` when the tenant id is configured.
 *
 *   COGNEE_API_URL   — required; unset means "not configured" (no default —
 *                      the shared api.cognee.ai host is not a valid tenant).
 *   COGNEE_API_KEY   — required.
 *   COGNEE_TENANT_ID — optional extra auth scoping.
 *
 * Error semantics: 401 = bad auth, 402 = out of credits (terminal), 429 =
 * back off. All methods fail soft ([] / { success: false }) and log once.
 *
 * Core Operations:
 *   remember(text, userId) — store a fact or observation (multipart add)
 *   recall(query, userId)  — retrieve relevant memories
 *   forget(userId)         — delete the user's dataset
 *
 * The low-level dataset/data helpers are exported for the Guardian-facts
 * adapter, which stores one data item per fact and deletes items natively.
 */

import { fetchWithTimeout } from '../utils/promise-utils';

const COGNEE_API_URL = process.env.COGNEE_API_URL || '';
const COGNEE_API_KEY = process.env.COGNEE_API_KEY || '';
const COGNEE_TENANT_ID = process.env.COGNEE_TENANT_ID || '';

/**
 * Memory TTL in days. Memories older than this begin to decay (their recall
 * score is penalized proportional to age). At 2×TTL the score reaches zero
 * and the memory is a candidate for hard eviction via `sweepStaleMemories`.
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

export interface CogneeDataset {
  id: string;
  name: string;
}

export interface CogneeDataItem {
  id: string;
  /** Whatever text the list response carries — raw field / name / content. */
  text: string;
  raw?: Record<string, unknown>;
}

class CogneeMemoryServiceImpl {
  private apiUrl: string;
  private apiKey: string;
  private tenantId: string;
  private enabled: boolean;
  private logged402 = false;
  private logged429 = false;

  constructor() {
    this.apiUrl = COGNEE_API_URL.replace(/\/+$/, '');
    this.apiKey = COGNEE_API_KEY;
    this.tenantId = COGNEE_TENANT_ID;
    this.enabled = !!(this.apiUrl && this.apiKey);
  }

  private authHeaders(json = true): Record<string, string> {
    const headers: Record<string, string> = { 'X-Api-Key': this.apiKey };
    if (json) headers['Content-Type'] = 'application/json';
    if (this.tenantId) headers['X-Tenant-Id'] = this.tenantId;
    return headers;
  }

  /** Note terminal/rate-limit statuses once per process — ops visibility
   *  without log spam on every soft-failed call. */
  private noteStatus(status: number, op: string): void {
    if (status === 402 && !this.logged402) {
      this.logged402 = true;
      console.warn(`[Cognee] ${op}: 402 — tenant is out of credits; all calls will fail until refilled`);
    } else if (status === 429 && !this.logged429) {
      this.logged429 = true;
      console.warn(`[Cognee] ${op}: 429 — rate limited; backing off`);
    } else if (status === 401) {
      console.warn(`[Cognee] ${op}: 401 — check COGNEE_API_KEY / COGNEE_TENANT_ID`);
    }
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  // ── Raw cloud helpers (used by the guardian-facts adapter) ──────────────

  /** GET /api/v1/datasets/ — the cheap authenticated probe. */
  async listDatasets(): Promise<CogneeDataset[] | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetchWithTimeout(`${this.apiUrl}/api/v1/datasets/`, {
        headers: this.authHeaders(false),
      }, 2500);
      if (!res.ok) {
        this.noteStatus(res.status, 'listDatasets');
        return null;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.datasets || [];
      return list.map((d: any) => ({
        id: String(d.id || d.dataset_id || ''),
        name: String(d.name || d.dataset_name || ''),
      }));
    } catch (error) {
      console.warn('[Cognee] listDatasets error:', error);
      return null;
    }
  }

  /** POST /api/v1/datasets/ — create-or-return by name; resolves the id. */
  async datasetIdFor(name: string, create = false): Promise<string | null> {
    const datasets = await this.listDatasets();
    const found = datasets?.find((d) => d.name === name);
    if (found) return found.id;
    if (!create || !datasets) return null;
    try {
      const res = await fetchWithTimeout(`${this.apiUrl}/api/v1/datasets/`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ name }),
      }, 5000);
      if (!res.ok) {
        this.noteStatus(res.status, 'createDataset');
        return null;
      }
      const created = await res.json().catch(() => null);
      return String(created?.id || created?.dataset_id || '') || this.datasetIdFor(name);
    } catch (error) {
      console.warn('[Cognee] createDataset error:', error);
      return null;
    }
  }

  /** GET /api/v1/datasets/{id}/data — data items in a dataset. */
  async listDataItems(datasetId: string, limit = 100): Promise<CogneeDataItem[] | null> {
    if (!this.enabled || !datasetId) return null;
    try {
      const res = await fetchWithTimeout(
        `${this.apiUrl}/api/v1/datasets/${datasetId}/data?limit=${limit}&offset=0`,
        { headers: this.authHeaders(false) },
        2500,
      );
      if (!res.ok) {
        this.noteStatus(res.status, 'listDataItems');
        return null;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || data?.items || [];
      return list.map((item: any) => ({
        id: String(item.id || item.data_id || ''),
        text: String(item.raw_data ?? item.text ?? item.content ?? item.name ?? ''),
        raw: item,
      }));
    } catch (error) {
      console.warn('[Cognee] listDataItems error:', error);
      return null;
    }
  }

  /** GET /api/v1/datasets/{id}/data/{data_id}/raw — original content. */
  async dataItemText(datasetId: string, dataId: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetchWithTimeout(
        `${this.apiUrl}/api/v1/datasets/${datasetId}/data/${dataId}/raw`,
        { headers: this.authHeaders(false) },
        2500,
      );
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /**
   * POST /api/v1/add — multipart form: `datasetName` plus repeated `raw_data`
   * string fields. Returns the created data id when the response carries one.
   */
  async addData(
    datasetName: string,
    texts: string[],
    timeoutMs = 5000,
  ): Promise<{ success: boolean; ids: string[] }> {
    if (!this.enabled || texts.length === 0) return { success: false, ids: [] };
    try {
      const form = new FormData();
      form.append('datasetName', datasetName);
      for (const t of texts) form.append('raw_data', t);
      const res = await fetchWithTimeout(`${this.apiUrl}/api/v1/add`, {
        method: 'POST',
        headers: this.authHeaders(false), // multipart — no manual Content-Type
        body: form,
      }, timeoutMs);
      if (!res.ok) {
        this.noteStatus(res.status, 'add');
        return { success: false, ids: [] };
      }
      const body = await res.json().catch(() => null);
      const items = Array.isArray(body) ? body : body?.data || body?.results || (body ? [body] : []);
      const ids = items
        .map((i: any) => String(i?.id || i?.data_id || ''))
        .filter(Boolean);
      return { success: true, ids };
    } catch (error) {
      console.warn('[Cognee] add error:', error);
      return { success: false, ids: [] };
    }
  }

  /** DELETE /api/v1/datasets/{id}/data/{data_id} — remove one data item. */
  async deleteDataItem(datasetId: string, dataId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetchWithTimeout(
        `${this.apiUrl}/api/v1/datasets/${datasetId}/data/${dataId}`,
        { method: 'DELETE', headers: this.authHeaders(false) },
        4000,
      );
      if (!res.ok) this.noteStatus(res.status, 'deleteDataItem');
      return res.ok;
    } catch (error) {
      console.warn('[Cognee] deleteDataItem error:', error);
      return false;
    }
  }

  /** DELETE /api/v1/datasets/{id} — drop the whole dataset. */
  async deleteDataset(datasetId: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetchWithTimeout(`${this.apiUrl}/api/v1/datasets/${datasetId}`, {
        method: 'DELETE',
        headers: this.authHeaders(false),
      }, 5000);
      if (!res.ok) this.noteStatus(res.status, 'deleteDataset');
      return res.ok;
    } catch (error) {
      console.warn('[Cognee] deleteDataset error:', error);
      return false;
    }
  }

  /** Cheap authenticated probe for availability checks. */
  async ping(): Promise<boolean> {
    const datasets = await this.listDatasets();
    return datasets !== null;
  }

  // ── Legacy memory surface (interaction context + consolidation) ─────────

  /**
   * Apply time-based decay to a memory's recall score.
   * age < TTL: unchanged · TTL–2×TTL: linear to 0 · ≥2×TTL: 0 (evictable).
   * No timestamp → age 0 (never decays).
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
   * Store a memory — multipart `POST /api/v1/add` with `datasetName` and a
   * `raw_data` field. No cognify for fact-style writes.
   */
  async remember(
    text: string,
    userId: string,
    options: RememberOptions = {}
  ): Promise<{ success: boolean; id?: string }> {
    if (!this.enabled) {
      return { success: false };
    }

    const dataset = options.dataset || `user_${userId}`;
    const { success, ids } = await this.addData(dataset, [text]);
    if (!success) return { success: false };

    // Trigger cognify (graph processing) in background — interaction
    // memories benefit from it even though guardian facts skip it.
    this.cognify(dataset).catch(() => {});

    return { success: true, id: ids[0] };
  }

  /**
   * Recall relevant memories for a query.
   * The advisor uses this to inject past context before generating a response.
   */
  async recall(
    query: string,
    userId: string,
    options: { sessionId?: string; limit?: number; dataset?: string } = {}
  ): Promise<CogneeRecallResult> {
    if (!this.enabled) {
      return { memories: [] };
    }

    try {
      const dataset = options.dataset || `user_${userId}`;
      const payload = {
        query,
        datasets: [dataset],
        ...(options.sessionId ? { session_id: options.sessionId } : {}),
        top_k: options.limit || 5,
      };

      const response = await fetchWithTimeout(`${this.apiUrl}/api/v1/search`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      }, 2500);

      if (!response.ok) {
        this.noteStatus(response.status, 'recall');
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
   * Forget all memories for a user (GDPR compliance / reset) — resolves the
   * dataset name to its id, then DELETEs it.
   */
  async forget(
    userId: string,
    options: { dataset?: string } = {}
  ): Promise<{ success: boolean }> {
    if (!this.enabled) {
      return { success: false };
    }

    const dataset = options.dataset || `user_${userId}`;
    const datasetId = await this.datasetIdFor(dataset);
    if (!datasetId) {
      // Nothing exists under that name — there is nothing to forget.
      return { success: true };
    }
    return { success: await this.deleteDataset(datasetId) };
  }

  /**
   * Sweep stale memories for a user — the "hard forgetting" layer.
   * Decay handles soft forgetting; this evicts data items whose decayed
   * score has dropped below the eviction threshold via per-item delete.
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
      const { memories: all } = await this.recall(
        'user preferences recommendations portfolio actions',
        userId,
        { limit: poolSize },
      );

      const stale = all
        .map(m => this.applyDecay(m))
        .filter(m => m.score < evictBelow && m.id);

      if (stale.length === 0) {
        return { swept: all.length, attempted: 0, evicted: 0 };
      }

      const datasetId = await this.datasetIdFor(dataset);
      if (!datasetId) {
        return { swept: all.length, attempted: stale.length, evicted: 0 };
      }

      let evicted = 0;
      for (const memory of stale) {
        try {
          if (await this.deleteDataItem(datasetId, memory.id)) evicted++;
        } catch {
          // Best-effort cleanup — a decayed memory is already invisible to
          // recall (score 0 never passes the > 0.5 filter in getAdvisorContext).
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
      await fetch(`${this.apiUrl}/api/v1/cognify`, {
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
      `Guardian recommended: ${response.slice(0, 200)}`,
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

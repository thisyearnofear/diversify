/**
 * Memory Consolidation Service
 *
 * Periodic job that compresses a user's raw interaction memories into a small
 * set of distilled profile statements, then stores the profile as a
 * high-priority memory and evicts the raw inputs. This is the "increasingly
 * accurate decisions across multi-turn, cross-session interactions" engine
 * for the Qwen Cloud MemoryAgent track.
 *
 * Architectural principle: Qwen is an accelerator, not a dependency.
 * Consolidation runs via `AIService.chat()` with `preferredProvider:
 * 'dashscope'`. When DashScope (Qwen Cloud) is available, Qwen's long-context
 * models (qwen-long supports 1M tokens) are ideal for compressing many raw
 * memories into a tight profile. When DashScope is unavailable, the call
 * falls back through the normal chain (Gemini → Venice → ...). When NO
 * provider is available, the job skips — raw memories stay as-is, and recall
 * still works. The app is fully functional without Qwen.
 *
 * Memory backend selection (preferred → fallback):
 *   1. Alibaba Cloud Function Compute endpoint (when ALIBABA_CLOUD_FC_ENDPOINT
 *      is set) — delegates the entire consolidation to the FC function which
 *      uses Tablestore + DashScope natively on Alibaba Cloud
 *   2. Tablestore Agent Memory (when TABLESTORE_ENDPOINT is set) — uses
 *      Tablestore for memory storage with Qwen for consolidation
 *   3. Cognee (when COGNEE_API_KEY is set) — the original memory backend
 *   4. Skip — no memory backend available, raw memories stay as-is
 *
 * Integration points:
 *   - Called from the Guardian cron (every N ticks) per active user
 *   - Also exposed as a standalone script: `scripts/memory-consolidate.ts`
 *   - Reads raw memories via the preferred memory backend's `recall()` (broad pool)
 *   - Writes the distilled profile back via the preferred memory backend's
 *     `remember()` with `metadata.type = 'consolidated_profile'` and a
 *     high-priority flag
 *   - Triggers `sweepStaleMemories()` after consolidation to evict the raw
 *     inputs that were absorbed into the profile
 */

import { cogneeMemoryService } from './cognee-memory-service';
import { tablestoreMemoryService } from './tablestore-memory-service';
import { generateChatCompletion } from './ai/ai-service';
import { fetchWithTimeout } from '../utils/promise-utils';

/**
 * When set, the consolidation service delegates to the Alibaba Cloud Function
 * Compute endpoint (which uses Tablestore + DashScope natively). This is the
 * strongest Alibaba Cloud deployment proof — the entire consolidation pipeline
 * runs on Alibaba Cloud infrastructure.
 */
const ALIBABA_CLOUD_FC_ENDPOINT =
  process.env.ALIBABA_CLOUD_FC_ENDPOINT || '';

/**
 * Minimum number of raw memories required to trigger consolidation. Below
 * this, the user hasn't accumulated enough history to be worth compressing.
 */
const MIN_MEMORIES_TO_CONSOLIDATE = 8;

/**
 * How many raw memories to pull for consolidation. Capped to keep the LLM
 * input within typical context windows; Qwen-long's 1M context can absorb
 * far more, but the default chain providers (Gemini, Venice) have smaller
 * windows. The cap is conservative so the job works on any provider.
 */
const CONSOLIDATION_POOL_SIZE = 40;

const CONSOLIDATION_SYSTEM_PROMPT = `You are a memory consolidation engine for a risk-aware treasury management agent (DiversiFi).

You will be given a list of raw interaction memories between the agent and a single user, in chronological order. Each memory records what the user asked, what the agent recommended, and any action taken.

Your job: compress these raw interactions into a tight, distilled user profile that captures the durable, reusable signals — the things that should persist across sessions and inform future recommendations. Discard ephemeral details (specific token amounts that have already been traded, one-off questions, transient market conditions).

Extract and synthesize:
- Stated or revealed risk tolerance and philosophy (e.g. Africapitalism, Islamic Finance, Buen Vivir, capital preservation)
- Currency / regional concerns that recur (e.g. KES depreciation, USD concentration risk)
- Asset preferences and rejections (what they've accepted vs pushed back on)
- Behavioral patterns (e.g. prefers autonomous execution, asks for human confirmation on large trades, distrusts memecoins)
- Goals that span sessions (e.g. saving for a specific purpose, hedging a specific exposure)
- Any contradictions or evolution in their views over time

Output 3-7 concise profile statements, each one sentence, each a standalone fact that would help a future advisor turn give a more personalized response. Do not include ephemeral details. Do not include recommendations. Do not include the user's name or address. Just the durable signals.

Format strictly as a JSON array of strings. No prose, no markdown fences.`;

class MemoryConsolidationServiceImpl {
  /**
   * Consolidate a user's raw memories into a distilled profile.
   *
   * Returns a summary of what was done. Idempotent: if there aren't enough
   * raw memories to justify consolidation, or no LLM provider is available,
   * or the LLM returns nothing useful, the call is a no-op.
   */
  /**
   * Select the active memory backend — Tablestore (Alibaba Cloud) preferred,
   * Cognee as fallback. Returns the service interface or null if neither is
   * available.
   */
  private getMemoryBackend(): {
    recall: typeof cogneeMemoryService.recall;
    remember: typeof cogneeMemoryService.remember;
    sweepStaleMemories: typeof cogneeMemoryService.sweepStaleMemories;
    isAvailable: typeof cogneeMemoryService.isAvailable;
    name: string;
  } | null {
    if (tablestoreMemoryService.isAvailable()) {
      return {
        recall: tablestoreMemoryService.recall.bind(tablestoreMemoryService),
        remember: tablestoreMemoryService.remember.bind(tablestoreMemoryService),
        sweepStaleMemories: tablestoreMemoryService.sweepStaleMemories.bind(tablestoreMemoryService),
        isAvailable: tablestoreMemoryService.isAvailable.bind(tablestoreMemoryService),
        name: 'tablestore',
      };
    }
    if (cogneeMemoryService.isAvailable()) {
      return {
        recall: cogneeMemoryService.recall.bind(cogneeMemoryService),
        remember: cogneeMemoryService.remember.bind(cogneeMemoryService),
        sweepStaleMemories: cogneeMemoryService.sweepStaleMemories.bind(cogneeMemoryService),
        isAvailable: cogneeMemoryService.isAvailable.bind(cogneeMemoryService),
        name: 'cognee',
      };
    }
    return null;
  }

  async consolidate(
    userId: string,
    options: { poolSize?: number; minMemories?: number } = {}
  ): Promise<{
    consolidated: boolean;
    rawMemoriesRead: number;
    profileStatements: string[];
    provider: string | null;
    model: string | null;
    evicted: number;
    reason?: string;
    backend?: string;
  }> {
    if (!userId) {
      return {
        consolidated: false,
        rawMemoriesRead: 0,
        profileStatements: [],
        provider: null,
        model: null,
        evicted: 0,
        reason: 'no_user_id',
      };
    }

    // ─── Path 1: Delegate to Alibaba Cloud Function Compute ──────────────
    // When the FC endpoint is configured, the entire consolidation runs on
    // Alibaba Cloud (Tablestore + DashScope). This is the strongest
    // deployment proof — the Guardian cron just fires an HTTP request.
    if (ALIBABA_CLOUD_FC_ENDPOINT) {
      try {
        const response = await fetchWithTimeout(
          ALIBABA_CLOUD_FC_ENDPOINT,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          },
          90000 // 90s — Qwen long-context consolidation can be slow
        );

        if (!response.ok) {
          throw new Error(`FC endpoint returned ${response.status}`);
        }

        const result = await response.json();
        return {
          consolidated: !!result.consolidated,
          rawMemoriesRead: result.rawMemoriesRead ?? 0,
          profileStatements: result.profileStatements ?? [],
          provider: result.provider ?? 'dashscope',
          model: result.model ?? null,
          evicted: result.evicted ?? 0,
          backend: 'alibaba-cloud-fc',
          ...(result.reason ? { reason: result.reason } : {}),
        };
      } catch (err: any) {
        // FC endpoint failed — fall through to local consolidation
        console.warn(
          `[memory-consolidation] FC endpoint failed, falling back to local: ${err?.message}`
        );
      }
    }

    // ─── Path 2: Local consolidation (Tablestore or Cognee) ──────────────
    const memoryBackend = this.getMemoryBackend();
    if (!memoryBackend) {
      return {
        consolidated: false,
        rawMemoriesRead: 0,
        profileStatements: [],
        provider: null,
        model: null,
        evicted: 0,
        reason: 'memory_service_unavailable',
      };
    }

    const poolSize = options.poolSize ?? CONSOLIDATION_POOL_SIZE;
    const minMemories = options.minMemories ?? MIN_MEMORIES_TO_CONSOLIDATE;

    // 1. Pull a broad pool of raw memories for this user.
    const { memories } = await memoryBackend.recall(
      'user preferences recommendations portfolio actions philosophy risk tolerance',
      userId,
      { limit: poolSize }
    );

    // Filter out any previously-consolidated profile memories — we don't
    // want to re-consolidate the profile into itself.
    const rawMemories = memories.filter(
      m => (m.metadata as any)?.type !== 'consolidated_profile'
    );

    if (rawMemories.length < minMemories) {
      return {
        consolidated: false,
        rawMemoriesRead: rawMemories.length,
        profileStatements: [],
        provider: null,
        model: null,
        evicted: 0,
        reason: `below_min_memories (${rawMemories.length}/${minMemories})`,
      };
    }

    // 2. Build the consolidation prompt. Chronological order, raw text only.
    const memoryBlock = rawMemories
      .map((m, i) => `[${i + 1}] ${m.content}`)
      .join('\n');

    const userPrompt = `Raw interaction memories (chronological):\n\n${memoryBlock}\n\nDistill these into a durable user profile. Output a JSON array of 3-7 concise strings.`;

    // 3. Ask the LLM to consolidate. Prefer DashScope (Qwen long-context)
    // when available; fall back to the normal chain otherwise. If no
    // provider is available, skip — raw memories remain usable.
    let result;
    try {
      result = await generateChatCompletion(
        {
          messages: [
            { role: 'system', content: CONSOLIDATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          maxTokens: 800,
          responseFormat: { type: 'json_object' },
          user: userId,
        },
        'dashscope'
      );
    } catch (err: any) {
      return {
        consolidated: false,
        rawMemoriesRead: rawMemories.length,
        profileStatements: [],
        provider: null,
        model: null,
        evicted: 0,
        reason: `llm_failed: ${err?.message ?? String(err)}`,
      };
    }

    // 4. Parse the distilled profile. The LLM was asked for a JSON array;
    // some providers wrap arrays in an object ({ "profile": [...] }) so we
    // handle both shapes.
    let profileStatements: string[] = [];
    try {
      const parsed = JSON.parse(result.data);
      if (Array.isArray(parsed)) {
        profileStatements = parsed.filter((s: any) => typeof s === 'string');
      } else if (parsed && typeof parsed === 'object') {
        const arr = parsed.profile ?? parsed.statements ?? parsed.result;
        if (Array.isArray(arr)) {
          profileStatements = arr.filter((s: any) => typeof s === 'string');
        }
      }
    } catch {
      // Non-JSON response — can happen on weaker fallback providers. Skip.
      return {
        consolidated: false,
        rawMemoriesRead: rawMemories.length,
        profileStatements: [],
        provider: result.provider,
        model: result.modelUsed ?? null,
        evicted: 0,
        reason: 'unparseable_response',
      };
    }

    if (profileStatements.length === 0) {
      return {
        consolidated: false,
        rawMemoriesRead: rawMemories.length,
        profileStatements: [],
        provider: result.provider,
        model: result.modelUsed ?? null,
        evicted: 0,
        reason: 'empty_profile',
      };
    }

    // 5. Store the distilled profile as a single high-priority memory.
    const profileText = `CONSOLIDATED USER PROFILE:\n${profileStatements.map(s => `- ${s}`).join('\n')}`;
    await memoryBackend.remember(profileText, userId, {
      metadata: {
        type: 'consolidated_profile',
        consolidatedAt: new Date().toISOString(),
        sourceMemoryCount: rawMemories.length,
        // High-priority flag — getAdvisorContext's score filter (m.score > 0.5)
        // already gates this; the flag is for future priority-aware retrieval.
        priority: 'high',
      },
    });

    // 6. Evict the raw memories that were absorbed into the profile.
    // We use sweepStaleMemories with a high eviction threshold so only the
    // oldest, lowest-score memories get evicted — preserving recent raw
    // interactions that may still be useful for short-term context.
    const sweep = await memoryBackend.sweepStaleMemories(userId, {
      evictBelowScore: 0.3,
      poolSize,
    });

    return {
      consolidated: true,
      rawMemoriesRead: rawMemories.length,
      profileStatements,
      provider: result.provider,
      model: result.modelUsed ?? null,
      evicted: sweep.evicted,
      backend: memoryBackend.name,
    };
  }
}

// Singleton export
export const memoryConsolidationService = new MemoryConsolidationServiceImpl();

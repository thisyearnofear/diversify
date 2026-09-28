/**
 * Guardian Memory Provider Service
 *
 * Opt-in Guardian memory ("facts the user asked Guardian to remember") with
 * the user's choice of storage location:
 *
 *   - 'tablestore' — Alibaba Cloud Tablestore (cn-beijing), one memory unit
 *     per fact in the dedicated `guardian_facts` agent scope, so per-fact
 *     delete is a native `deleteMemory` call.
 *   - 'cognee' — Cognee Cloud (AWS us-east-1), one data item per fact in the
 *     dedicated `guardian_facts_<address>` dataset (no cognify — facts are
 *     exact strings, not a graph). Per-fact delete is the native
 *     `DELETE …/data/{data_id}`; `forget` deletes the dataset.
 *
 * Honesty contracts:
 *   - `add` returns only facts whose write was CONFIRMED — the UI must
 *     never show "Remembered" for something the store didn't take.
 *   - `isAvailable()` reports config presence only; `health()` reports
 *     whether the backend answers an authenticated probe. The providers
 *     endpoint exposes `configured && healthy` plus a `reason`.
 *
 * Every call fails soft — a slow or down provider returns an empty list /
 * false rather than blocking or breaking a chat answer. `list` carries an
 * ~800 ms budget because it sits inside the advisor's context build.
 *
 * Memory is consent-only: callers must never write here without an
 * authenticated, opted-in mode — see apps/web pages/api/agent/memory.ts.
 */

import { withTimeout } from '../utils/promise-utils';
import { cogneeMemoryService } from './cognee-memory-service';
import { tablestoreMemoryService } from './tablestore-memory-service';

export type GuardianMemoryProviderId = 'tablestore' | 'cognee';
export type GuardianProviderUnavailabilityReason = 'not_configured' | 'unreachable';

export interface GuardianFact {
  id: string;
  text: string;
  createdAt: string;
}

export interface GuardianMemoryProvider {
  id: GuardianMemoryProviderId;
  /** Where the data physically lives — shown to the user when choosing. */
  location: string;
  /** Config presence only (env vars set). */
  isAvailable(): boolean;
  /** Whether the backend answers an authenticated probe — cached:
   *  10 min on success, 2 min on failure. */
  health(): Promise<boolean>;
  list(address: string): Promise<GuardianFact[]>;
  add(address: string, facts: string[]): Promise<GuardianFact[]>;
  remove(address: string, id: string): Promise<boolean>;
  forget(address: string): Promise<boolean>;
}

const LIST_TIMEOUT_MS = 800;
const WRITE_TIMEOUT_MS = 4000;
const HEALTH_TIMEOUT_MS = 2000;
const HEALTH_OK_TTL_MS = 10 * 60 * 1000;
const HEALTH_FAIL_TTL_MS = 2 * 60 * 1000;
const FACT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FACTS = 12;
const FACT_MAX_CHARS = 140;

const GUARDIAN_FACTS_AGENT = 'guardian_facts';
const COGNEE_DATASET_PREFIX = 'guardian_facts_';

function sanitizeFact(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, FACT_MAX_CHARS);
}

function pruneExpired(facts: GuardianFact[], now = Date.now()): GuardianFact[] {
  return facts.filter((f) => {
    const at = Date.parse(f.createdAt);
    return Number.isFinite(at) && now - at < FACT_TTL_MS;
  });
}

function newFact(text: string, id?: string): GuardianFact {
  return {
    id: id || `gf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    text,
    createdAt: new Date().toISOString(),
  };
}

/** Shared health-probe caching: fresh success for 10 min, failure for 2. */
abstract class CachedHealthProvider implements GuardianMemoryProvider {
  abstract readonly id: GuardianMemoryProviderId;
  abstract readonly location: string;
  abstract isAvailable(): boolean;
  abstract list(address: string): Promise<GuardianFact[]>;
  abstract add(address: string, facts: string[]): Promise<GuardianFact[]>;
  abstract remove(address: string, id: string): Promise<boolean>;
  abstract forget(address: string): Promise<boolean>;
  protected abstract probe(): Promise<boolean>;

  private healthCache: { ok: boolean; at: number } | null = null;

  async health(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const now = Date.now();
    if (this.healthCache) {
      const ttl = this.healthCache.ok ? HEALTH_OK_TTL_MS : HEALTH_FAIL_TTL_MS;
      if (now - this.healthCache.at < ttl) return this.healthCache.ok;
    }
    let ok = false;
    try {
      ok = await withTimeout(this.probe(), HEALTH_TIMEOUT_MS).catch(() => false);
    } catch {
      ok = false;
    }
    this.healthCache = { ok, at: now };
    return ok;
  }
}

// ── Tablestore: one memory unit per fact, dedicated agent scope ───────────

class TablestoreFactsProvider extends CachedHealthProvider {
  readonly id = 'tablestore' as const;
  readonly location = 'Alibaba Cloud — stored in mainland China';

  isAvailable(): boolean {
    return tablestoreMemoryService.isAvailable();
  }

  protected probe(): Promise<boolean> {
    return tablestoreMemoryService.ping();
  }

  async list(address: string): Promise<GuardianFact[]> {
    try {
      const units = await withTimeout(
        tablestoreMemoryService.listMemories(address, { agentId: GUARDIAN_FACTS_AGENT }),
        LIST_TIMEOUT_MS,
      ).catch(() => []);
      const facts: GuardianFact[] = units
        .filter((m) => m.id && m.content && m.metadata?.kind === 'guardian_fact')
        .map((m) => ({
          id: String(m.metadata?.factId || m.id),
          text: sanitizeFact(m.content),
          createdAt: String(m.metadata?.createdAt || m.metadata?.timestamp || ''),
        }))
        .filter((f) => f.text && f.createdAt);
      return pruneExpired(facts).slice(0, MAX_FACTS);
    } catch (error) {
      console.warn('[guardian-memory] tablestore list failed:', error);
      return [];
    }
  }

  async add(address: string, facts: string[]): Promise<GuardianFact[]> {
    // Confirmed writes only: a fact is returned iff the store accepted it —
    // the UI must never claim "Remembered" for something not stored.
    const added: GuardianFact[] = [];
    const existing = await this.list(address);
    for (const raw of facts) {
      if (existing.length + added.length >= MAX_FACTS) break;
      const text = sanitizeFact(raw);
      if (!text) continue;
      if (existing.concat(added).some((f) => f.text.toLowerCase() === text.toLowerCase())) continue;
      const createdAt = new Date().toISOString();
      try {
        const result = await withTimeout(
          tablestoreMemoryService.remember(text, address, {
            agentId: GUARDIAN_FACTS_AGENT,
            metadata: { kind: 'guardian_fact', createdAt },
          }),
          WRITE_TIMEOUT_MS,
        ).catch(() => ({ success: false }) as { success: boolean; id?: string });
        if (result.success) {
          added.push({ id: result.id || `gf-${createdAt}`, text, createdAt });
        }
      } catch (error) {
        console.warn('[guardian-memory] tablestore add failed:', error);
      }
    }
    return added;
  }

  async remove(address: string, id: string): Promise<boolean> {
    try {
      return await withTimeout(
        tablestoreMemoryService.deleteMemory(id, address, GUARDIAN_FACTS_AGENT),
        WRITE_TIMEOUT_MS,
      ).catch(() => false);
    } catch (error) {
      console.warn('[guardian-memory] tablestore remove failed:', error);
      return false;
    }
  }

  async forget(address: string): Promise<boolean> {
    try {
      const facts = await this.list(address);
      let ok = true;
      for (const fact of facts) {
        ok = (await this.remove(address, fact.id)) && ok;
      }
      return ok;
    } catch {
      return false;
    }
  }
}

// ── Cognee: one data item per fact, dedicated dataset ─────────────────────

class CogneeFactsProvider extends CachedHealthProvider {
  readonly id = 'cognee' as const;
  readonly location = 'Cognee — stored in the USA (AWS)';

  private dataset(address: string): string {
    return `${COGNEE_DATASET_PREFIX}${address.toLowerCase()}`;
  }

  isAvailable(): boolean {
    return cogneeMemoryService.isAvailable();
  }

  protected probe(): Promise<boolean> {
    return cogneeMemoryService.ping();
  }

  /** Dataset name → id (create on write only). */
  private async datasetId(address: string, create = false): Promise<string | null> {
    return cogneeMemoryService.datasetIdFor(this.dataset(address), create);
  }

  async list(address: string): Promise<GuardianFact[]> {
    try {
      const datasetId = await this.datasetId(address);
      if (!datasetId) return [];
      const items = await cogneeMemoryService.listDataItems(datasetId, MAX_FACTS);
      if (!items) return [];
      // A fact's id IS its data id — remove() deletes it natively.
      // createdAt comes from the item's metadata when present, else the
      // write is treated as fresh (facts self-prune after 30 days anyway).
      const facts = await Promise.all(
        items.map(async (item) => {
          const text = item.text || (await cogneeMemoryService.dataItemText(datasetId, item.id)) || '';
          const meta = (item.raw?.metadata || item.raw) as Record<string, unknown>;
          const createdAt = String(meta?.createdAt || meta?.created_at || meta?.timestamp || new Date().toISOString());
          return {
            id: item.id,
            text: sanitizeFact(text),
            createdAt,
          };
        }),
      );
      return pruneExpired(facts.filter((f) => f.id && f.text)).slice(0, MAX_FACTS);
    } catch (error) {
      console.warn('[guardian-memory] cognee list failed:', error);
      return [];
    }
  }

  async add(address: string, facts: string[]): Promise<GuardianFact[]> {
    try {
      const existing = await this.list(address);
      const candidates: string[] = [];
      for (const raw of facts) {
        if (existing.length + candidates.length >= MAX_FACTS) break;
        const text = sanitizeFact(raw);
        if (!text) continue;
        if (existing.some((f) => f.text.toLowerCase() === text.toLowerCase()) ||
            candidates.some((c) => c.toLowerCase() === text.toLowerCase())) continue;
        candidates.push(text);
      }
      if (candidates.length === 0) return [];

      // Confirmed writes only: the returned facts are the ones the API
      // accepted. When the add response carries data ids, use them; when it
      // doesn't, resolve ids by listing the dataset and matching text.
      const datasetId = await this.datasetId(address, true);
      if (!datasetId) return [];
      const result = await withTimeout(
        cogneeMemoryService.addData(this.dataset(address), candidates),
        WRITE_TIMEOUT_MS,
      ).catch(() => ({ success: false, ids: [] as string[] }));
      if (!result.success) return [];

      let ids = result.ids;
      if (ids.length < candidates.length) {
        const items = await cogneeMemoryService.listDataItems(datasetId, MAX_FACTS);
        ids = candidates.map((c) => {
          const hit = items?.find((i) => i.text === c || sanitizeFact(i.text) === c);
          return hit?.id || '';
        });
      }
      return candidates
        .map((text, i) => (ids[i] ? { id: ids[i], text, createdAt: new Date().toISOString() } : null))
        .filter((f): f is GuardianFact => !!f);
    } catch (error) {
      console.warn('[guardian-memory] cognee add failed:', error);
      return [];
    }
  }

  async remove(address: string, id: string): Promise<boolean> {
    try {
      const datasetId = await this.datasetId(address);
      if (!datasetId) return false;
      return await withTimeout(
        cogneeMemoryService.deleteDataItem(datasetId, id),
        WRITE_TIMEOUT_MS,
      ).catch(() => false);
    } catch (error) {
      console.warn('[guardian-memory] cognee remove failed:', error);
      return false;
    }
  }

  async forget(address: string): Promise<boolean> {
    try {
      const datasetId = await this.datasetId(address);
      if (!datasetId) return true; // nothing to forget
      return await withTimeout(
        cogneeMemoryService.deleteDataset(datasetId),
        WRITE_TIMEOUT_MS,
      ).catch(() => false);
    } catch {
      return false;
    }
  }
}

const PROVIDERS: GuardianMemoryProvider[] = [
  new TablestoreFactsProvider(),
  new CogneeFactsProvider(),
];

export interface GuardianProviderInfo {
  id: GuardianMemoryProviderId;
  location: string;
  /** configured && healthy — selectable in the UI. */
  available: boolean;
  reason?: GuardianProviderUnavailabilityReason;
}

export const guardianMemoryService = {
  providers: PROVIDERS,

  providerFor(id: unknown): GuardianMemoryProvider | null {
    return PROVIDERS.find((p) => p.id === id) ?? null;
  },

  /**
   * Health-aware availability: a provider is selectable only when it is
   * configured AND answers an authenticated probe. `reason` distinguishes
   * "not set up" from "set up but down" so the UI can label honestly.
   */
  async listAvailableProviders(): Promise<GuardianProviderInfo[]> {
    return Promise.all(
      PROVIDERS.map(async (p) => {
        if (!p.isAvailable()) {
          return { id: p.id, location: p.location, available: false, reason: 'not_configured' as const };
        }
        const ok = await p.health();
        return {
          id: p.id,
          location: p.location,
          available: ok,
          ...(ok ? {} : { reason: 'unreachable' as const }),
        };
      }),
    );
  },
};

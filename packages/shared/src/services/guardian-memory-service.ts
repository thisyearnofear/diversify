/**
 * Guardian Memory Provider Service
 *
 * Opt-in Guardian memory ("facts the user asked Guardian to remember") with
 * the user's choice of storage location:
 *
 *   - 'tablestore' — Alibaba Cloud Tablestore (mainland China region), one
 *     memory unit per fact in the dedicated `guardian_facts` agent scope,
 *     so per-fact delete is a native `deleteMemory` call.
 *   - 'cognee' — Cognee Cloud (AWS us-east-1). Per-memory delete isn't a
 *     reliable API surface there, so the wallet's facts live as ONE JSON
 *     document in a dedicated `guardian_facts_<address>` dataset:
 *     `remove`/`add` rewrite the document (delete-then-add, so the dataset
 *     never holds two generations), `forget` deletes the dataset.
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

export interface GuardianFact {
  id: string;
  text: string;
  createdAt: string;
}

export interface GuardianMemoryProvider {
  id: GuardianMemoryProviderId;
  /** Where the data physically lives — shown to the user when choosing. */
  location: string;
  isAvailable(): boolean;
  list(address: string): Promise<GuardianFact[]>;
  add(address: string, facts: string[]): Promise<GuardianFact[]>;
  remove(address: string, id: string): Promise<boolean>;
  forget(address: string): Promise<boolean>;
}

const LIST_TIMEOUT_MS = 800;
const WRITE_TIMEOUT_MS = 4000;
const FACT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FACTS = 12;
const FACT_MAX_CHARS = 140;

const GUARDIAN_FACTS_AGENT = 'guardian_facts';
const COGNEE_DATASET_PREFIX = 'guardian_facts_';
/** Fixed marker line inside the Cognee document so a stray search hit can
 *  never be parsed as facts. */
const COGNEE_DOC_MARKER = 'GUARDIAN_FACTS_V1';

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

function newFact(text: string): GuardianFact {
  return {
    id: `gf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    text,
    createdAt: new Date().toISOString(),
  };
}

// ── Tablestore: one memory unit per fact, dedicated agent scope ───────────

class TablestoreFactsProvider implements GuardianMemoryProvider {
  readonly id = 'tablestore' as const;
  readonly location = 'Alibaba Cloud — stored in mainland China';

  isAvailable(): boolean {
    return tablestoreMemoryService.isAvailable();
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
          added.push({
            id: result.id || `gf-${createdAt}`,
            text,
            createdAt,
          });
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

// ── Cognee: one JSON document per wallet, rewritten on change ─────────────

class CogneeFactsProvider implements GuardianMemoryProvider {
  readonly id = 'cognee' as const;
  readonly location = 'Cognee — stored in the USA (AWS)';

  private dataset(address: string): string {
    return `${COGNEE_DATASET_PREFIX}${address.toLowerCase()}`;
  }

  isAvailable(): boolean {
    return cogneeMemoryService.isAvailable();
  }

  private parseDoc(content: string): GuardianFact[] {
    if (!content.startsWith(COGNEE_DOC_MARKER)) return [];
    try {
      const parsed = JSON.parse(content.slice(COGNEE_DOC_MARKER.length));
      if (!parsed || !Array.isArray(parsed.facts)) return [];
      return pruneExpired(
        parsed.facts.filter(
          (f: unknown): f is GuardianFact =>
            !!f &&
            typeof (f as GuardianFact).id === 'string' &&
            typeof (f as GuardianFact).text === 'string' &&
            typeof (f as GuardianFact).createdAt === 'string',
        ),
      ).slice(0, MAX_FACTS);
    } catch {
      return [];
    }
  }

  private serialize(facts: GuardianFact[]): string {
    return `${COGNEE_DOC_MARKER}\n${JSON.stringify({ facts })}`;
  }

  private async readDoc(address: string): Promise<GuardianFact[]> {
    const { memories } = await withTimeout(
      cogneeMemoryService.recall('guardian remembered facts', address, {
        dataset: this.dataset(address),
        limit: 5,
      }),
      LIST_TIMEOUT_MS,
    ).catch(() => ({ memories: [] }));
    for (const m of memories) {
      const facts = this.parseDoc(m.content);
      if (facts.length > 0 || m.content.startsWith(COGNEE_DOC_MARKER)) return facts;
    }
    return [];
  }

  /** Cognee has no reliable per-memory delete: every mutation is
   *  delete-dataset-then-add, so the dataset holds at most one document. */
  private async writeDoc(address: string, facts: GuardianFact[]): Promise<boolean> {
    const dataset = this.dataset(address);
    await cogneeMemoryService.forget(address, { dataset });
    if (facts.length === 0) return true;
    const result = await cogneeMemoryService.remember(this.serialize(facts), address, { dataset });
    return result.success;
  }

  async list(address: string): Promise<GuardianFact[]> {
    try {
      return await this.readDoc(address);
    } catch (error) {
      console.warn('[guardian-memory] cognee list failed:', error);
      return [];
    }
  }

  async add(address: string, facts: string[]): Promise<GuardianFact[]> {
    try {
      const existing = await this.readDoc(address);
      const added: GuardianFact[] = [];
      for (const raw of facts) {
        if (existing.length + added.length >= MAX_FACTS) break;
        const text = sanitizeFact(raw);
        if (!text) continue;
        if (existing.concat(added).some((f) => f.text.toLowerCase() === text.toLowerCase())) continue;
        added.push(newFact(text));
      }
      if (added.length === 0) return [];
      await withTimeout(this.writeDoc(address, [...existing, ...added]), WRITE_TIMEOUT_MS).catch(() => false);
      return added;
    } catch (error) {
      console.warn('[guardian-memory] cognee add failed:', error);
      return [];
    }
  }

  async remove(address: string, id: string): Promise<boolean> {
    try {
      const existing = await this.readDoc(address);
      const remaining = existing.filter((f) => f.id !== id);
      if (remaining.length === existing.length) return false;
      return await withTimeout(this.writeDoc(address, remaining), WRITE_TIMEOUT_MS).catch(() => false);
    } catch (error) {
      console.warn('[guardian-memory] cognee remove failed:', error);
      return false;
    }
  }

  async forget(address: string): Promise<boolean> {
    try {
      const result = await withTimeout(
        cogneeMemoryService.forget(address, { dataset: this.dataset(address) }),
        WRITE_TIMEOUT_MS,
      ).catch(() => ({ success: false }));
      return result.success;
    } catch {
      return false;
    }
  }
}

const PROVIDERS: GuardianMemoryProvider[] = [
  new TablestoreFactsProvider(),
  new CogneeFactsProvider(),
];

export const guardianMemoryService = {
  providers: PROVIDERS,

  providerFor(id: unknown): GuardianMemoryProvider | null {
    return PROVIDERS.find((p) => p.id === id) ?? null;
  },

  listAvailableProviders(): Array<{ id: GuardianMemoryProviderId; location: string; available: boolean }> {
    return PROVIDERS.map((p) => ({ id: p.id, location: p.location, available: p.isAvailable() }));
  },
};

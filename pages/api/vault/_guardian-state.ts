import * as path from 'path';
import { readJsonFile, writeJsonFile } from '../agent/_json-store';

export interface GuardianRecommendationSnapshot {
  capturedAt: string;
  source: 'advisor-analysis' | 'proactive-yield';
  action?: string;
  targetToken?: string;
  oneLiner?: string;
  reasoning?: string;
  expectedSavings?: number;
  confidence?: number;
  riskLevel?: string;
  protocol?: string;
  chain?: string;
  marketSymbol?: string;
  apy?: number;
  tvl?: number;
  researchEvidence?: {
    summary?: string;
    bundle?: {
      confidence: number;
      agreementScore: number;
      freshnessScore: number;
      averageReputation: number;
      sourceCount: number;
    };
    sources?: Array<{
      sourceId: string;
      label: string;
      tier?: 'free' | 'paid';
      dataType?: string;
      category?: string;
      cost?: number;
      freshnessMinutes?: number;
      reputation?: number;
    }>;
  };
}

export interface GuardianStateRecord {
  latestRecommendation?: GuardianRecommendationSnapshot;
}

type GuardianStateStore = Record<string, GuardianStateRecord>;

const STORAGE_PATH =
  process.env.GUARDIAN_STATE_PATH ||
  path.join(process.cwd(), '.data', 'guardian-state.json');

function normalizeUserAddress(userAddress: string): string {
  return userAddress.trim().toLowerCase();
}

async function loadStore(): Promise<GuardianStateStore> {
  return readJsonFile<GuardianStateStore>(STORAGE_PATH, {});
}

async function saveStore(store: GuardianStateStore): Promise<void> {
  await writeJsonFile(STORAGE_PATH, store);
}

export async function getGuardianState(userAddress: string): Promise<GuardianStateRecord | null> {
  const store = await loadStore();
  return store[normalizeUserAddress(userAddress)] || null;
}

export async function updateGuardianState(
  userAddress: string,
  partial: Partial<GuardianStateRecord>,
): Promise<GuardianStateRecord> {
  const normalized = normalizeUserAddress(userAddress);
  const store = await loadStore();
  const nextRecord: GuardianStateRecord = {
    ...(store[normalized] || {}),
    ...partial,
  };
  store[normalized] = nextRecord;
  await saveStore(store);
  return nextRecord;
}

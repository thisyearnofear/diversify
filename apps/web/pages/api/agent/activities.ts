import type { NextApiRequest, NextApiResponse } from 'next';
import * as path from 'path';
import { readJsonFile, writeJsonFile } from './_json-store';

interface AgentActivityRecord {
  id: string;
  timestamp: number;
  type: string;
  tier: string;
  description?: string;
  status: string;
  details?: Record<string, any>;
}

const MAX_ACTIVITIES = 200;
const STORAGE_PATH = process.env.AGENT_ACTIVITY_PATH || path.join(process.cwd(), '.data', 'agent-activities.json');

let cachedActivities: AgentActivityRecord[] = [];
let loaded = false;

const normalizeActivities = (items: AgentActivityRecord[]): AgentActivityRecord[] => {
  return items.filter((activity) =>
    activity &&
    typeof activity.id === 'string' &&
    typeof activity.timestamp === 'number' &&
    typeof activity.type === 'string' &&
    typeof activity.tier === 'string' &&
    typeof activity.status === 'string'
  );
};

const hydrateFromDisk = async () => {
  if (loaded) return;
  loaded = true;
  const parsed = await readJsonFile<AgentActivityRecord[]>(STORAGE_PATH, []);
  if (!Array.isArray(parsed)) return;
  cachedActivities = normalizeActivities(parsed)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACTIVITIES);
};

const persistToDisk = async () => {
  try {
    await writeJsonFile(STORAGE_PATH, cachedActivities);
  } catch (error) {
    console.warn('[Agent Activities] Failed to persist to disk:', error);
  }
};

const upsertActivities = (activities: AgentActivityRecord[]) => {
  if (activities.length === 0) return;
  const existing = new Map(cachedActivities.map((activity) => [activity.id, activity]));
  activities.forEach((activity) => {
    existing.set(activity.id, activity);
  });
  cachedActivities = Array.from(existing.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACTIVITIES);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await hydrateFromDisk();

  if (req.method === 'GET') {
    return res.status(200).json({ activities: cachedActivities });
  }

  if (req.method === 'POST') {
    const payload = req.body;
    const incoming = Array.isArray(payload) ? payload : [payload];

    const normalized = normalizeActivities(
      incoming.map((activity) => {
        const id = activity?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const timestamp = typeof activity?.timestamp === 'number' ? activity.timestamp : Date.now();
        return {
          ...activity,
          id,
          timestamp,
        } as AgentActivityRecord;
      })
    );

    upsertActivities(normalized);
    await persistToDisk();
    return res.status(200).json({ success: true, activities: cachedActivities });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

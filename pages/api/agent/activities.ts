import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

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
const STORAGE_PATH = process.env.AGENT_ACTIVITY_PATH || '/tmp/diversifi-agent-activities.json';

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
  try {
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    cachedActivities = normalizeActivities(parsed)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_ACTIVITIES);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn('[Agent Activities] Failed to load from disk:', error);
    }
  }
};

const persistToDisk = async () => {
  try {
    await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true });
    await fs.writeFile(STORAGE_PATH, JSON.stringify(cachedActivities), 'utf8');
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

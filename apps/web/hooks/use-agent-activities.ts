import { useCallback, useEffect, useState } from "react";
import type { AgentActivity } from "./agent-types";

const ACTIVITY_STORAGE_KEY = "diversifi-agent-activities";
const ACTIVITY_API_PATH = "/api/agent/activities";

const normalizeActivities = (items: AgentActivity[]): AgentActivity[] => {
  return items.filter((activity) =>
    activity &&
    typeof activity.id === "string" &&
    typeof activity.timestamp === "number" &&
    typeof activity.type === "string" &&
    typeof activity.tier === "string" &&
    typeof activity.status === "string"
  );
};

const loadPersistedActivities = (): AgentActivity[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeActivities(parsed);
  } catch (error) {
    console.warn("[useAgentActivities] Failed to load persisted activities:", error);
    return [];
  }
};

const mergeActivities = (incoming: AgentActivity[]) => {
  if (incoming.length === 0) return;
  const existing = new Map(cachedActivities.map((activity) => [activity.id, activity]));
  incoming.forEach((activity) => {
    existing.set(activity.id, activity);
  });
  cachedActivities = Array.from(existing.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
};

let cachedActivities: AgentActivity[] = loadPersistedActivities();
const listeners = new Set<(activities: AgentActivity[]) => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(cachedActivities));
};

const persistActivities = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(cachedActivities));
  } catch (error) {
    console.warn("[useAgentActivities] Failed to persist activities:", error);
  }
};

const syncFromServer = async () => {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch(ACTIVITY_API_PATH);
    if (!response.ok) return;
    const payload = await response.json();
    if (Array.isArray(payload?.activities)) {
      mergeActivities(normalizeActivities(payload.activities));
      persistActivities();
      notifyListeners();
    }
  } catch (error) {
    console.warn("[useAgentActivities] Failed to sync from server:", error);
  }
};

const syncToServer = async (activity: AgentActivity) => {
  if (typeof window === "undefined") return;
  try {
    await fetch(ACTIVITY_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activity),
    });
  } catch (error) {
    console.warn("[useAgentActivities] Failed to sync activity:", error);
  }
};

const addActivityToCache = (activity: Omit<AgentActivity, "id" | "timestamp">) => {
  const newActivity: AgentActivity = {
    ...activity,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
  cachedActivities = [newActivity, ...cachedActivities].slice(0, 50);
  persistActivities();
  notifyListeners();
  void syncToServer(newActivity);
};

export function useAgentActivities() {
  const [activities, setActivities] = useState<AgentActivity[]>(cachedActivities);

  useEffect(() => {
    const listener = (next: AgentActivity[]) => setActivities(next);
    listeners.add(listener);
    mergeActivities(loadPersistedActivities());
    notifyListeners();
    void syncFromServer();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addActivity = useCallback((activity: Omit<AgentActivity, "id" | "timestamp">) => {
    addActivityToCache(activity);
  }, []);

  return { activities, addActivity };
}

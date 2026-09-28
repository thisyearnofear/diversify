/**
 * useGuardianMemory — client state for opt-in Guardian memory.
 *
 * Owns the localStorage preference + device facts (via lib/guardian-memory)
 * and the server facts for cloud mode. Cloud reads/writes ride the cached
 * wallet-session proof — the only prompt is the signature the user gives
 * when choosing "Across devices".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDeviceFacts,
  clearDeviceFacts,
  loadDeviceFacts,
  loadMemoryPreference,
  memoryRequestFor,
  removeDeviceFact,
  saveMemoryPreference,
  type GuardianFact,
  type GuardianMemoryMode,
  type GuardianMemoryPreference,
  type GuardianMemoryProviderId,
} from '@/lib/guardian-memory';
import { getWalletAuthHeaders } from '@/lib/wallet-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface GuardianMemoryProviderInfo {
  id: GuardianMemoryProviderId;
  location: string;
  available: boolean;
}

export interface GuardianMemoryState {
  pref: GuardianMemoryPreference;
  facts: GuardianFact[];
  providers: GuardianMemoryProviderInfo[] | null;
  /** For cloud mode when no session proof is cached — the view shows the
   *  fact list as unavailable until the user re-signs (choosing the mode
   *  again is the consent gesture). */
  cloudNeedsAuth: boolean;
  hydrated: boolean;
  /** The `memory` field for the next advisor request. */
  requestPayload: () => ReturnType<typeof memoryRequestFor>;
  /** Choose a mode. 'cloud' requires a wallet signature; returns false when
   *  the signature is declined so the caller can stay on the old mode. */
  chooseMode: (mode: GuardianMemoryMode, provider?: GuardianMemoryProviderId) => Promise<boolean>;
  loadProviders: () => Promise<void>;
  deleteFact: (fact: { id: string }) => Promise<void>;
  forgetAll: () => Promise<boolean>;
  reloadFacts: () => Promise<void>;
}

export function useGuardianMemory(
  address: string | null | undefined,
  signMessage?: (message: string) => Promise<string>,
): GuardianMemoryState {
  const [pref, setPref] = useState<GuardianMemoryPreference>({ mode: 'off' });
  const [facts, setFacts] = useState<GuardianFact[]>([]);
  const [providers, setProviders] = useState<GuardianMemoryProviderInfo[] | null>(null);
  const [cloudNeedsAuth, setCloudNeedsAuth] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const loadFacts = useCallback(
    async (p: GuardianMemoryPreference) => {
      if (p.mode === 'device') {
        setCloudNeedsAuth(false);
        setFacts(loadDeviceFacts(address));
        return;
      }
      if (p.mode === 'cloud' && p.provider && address) {
        const headers = await getWalletAuthHeaders(address);
        if (!headers) {
          // No cached session proof — memory stays private rather than
          // prompting a signature just to render the list.
          setCloudNeedsAuth(true);
          setFacts([]);
          return;
        }
        setCloudNeedsAuth(false);
        try {
          const res = await fetch(`${API_BASE}/api/agent/memory?provider=${p.provider}`, { headers });
          const data = res.ok ? await res.json() : null;
          setFacts(Array.isArray(data?.facts) ? data.facts : []);
        } catch {
          setFacts([]);
        }
        return;
      }
      setCloudNeedsAuth(false);
      setFacts([]);
    },
    [address],
  );

  useEffect(() => {
    const p = loadMemoryPreference(address);
    setPref(p);
    void loadFacts(p);
    setHydrated(true);
  }, [address, loadFacts]);

  const requestPayload = useCallback(
    () => memoryRequestFor(prefRef.current, address),
    [address],
  );

  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agent/memory?providers=1`);
      const data = res.ok ? await res.json() : null;
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
    } catch {
      setProviders([]);
    }
  }, []);

  const chooseMode = useCallback(
    async (mode: GuardianMemoryMode, provider?: GuardianMemoryProviderId) => {
      if (mode === 'cloud') {
        if (!address || !provider) return false;
        // Choosing across devices IS the consent signature.
        const headers = await getWalletAuthHeaders(address, signMessage);
        if (!headers) return false;
        const next: GuardianMemoryPreference = { mode, provider };
        saveMemoryPreference(address, next);
        setPref(next);
        setCloudNeedsAuth(false);
        // Fetch via the freshly-signed headers (cache may have just been
        // written inside getWalletAuthHeaders — loadFacts would re-read it).
        try {
          const res = await fetch(`${API_BASE}/api/agent/memory?provider=${provider}`, { headers });
          const data = res.ok ? await res.json() : null;
          setFacts(Array.isArray(data?.facts) ? data.facts : []);
        } catch {
          setFacts([]);
        }
        return true;
      }
      const next: GuardianMemoryPreference = { mode };
      saveMemoryPreference(address, next);
      setPref(next);
      void loadFacts(next);
      return true;
    },
    [address, signMessage, loadFacts],
  );

  const deleteFact = useCallback(
    async (fact: { id: string }) => {
      if (prefRef.current.mode === 'device') {
        setFacts(removeDeviceFact(fact.id, address));
        return;
      }
      if (prefRef.current.mode === 'cloud' && prefRef.current.provider && address) {
        const headers = await getWalletAuthHeaders(address);
        if (headers) {
          try {
            await fetch(
              `${API_BASE}/api/agent/memory?provider=${prefRef.current.provider}&id=${encodeURIComponent(fact.id)}`,
              { method: 'DELETE', headers },
            );
          } catch { /* fail soft — the row still disappears locally */ }
        }
        setFacts((prev) => prev.filter((f) => f.id !== fact.id));
      }
    },
    [address],
  );

  const forgetAll = useCallback(async () => {
    clearDeviceFacts(address);
    setFacts([]);
    let ok = true;
    if (address) {
      const headers = await getWalletAuthHeaders(address, signMessage);
      if (headers) {
        try {
          const res = await fetch(`${API_BASE}/api/agent/memory`, { method: 'DELETE', headers });
          ok = res.ok;
        } catch {
          ok = false;
        }
      }
    }
    return ok;
  }, [address, signMessage]);

  const reloadFacts = useCallback(() => loadFacts(prefRef.current), [loadFacts]);

  return {
    pref,
    facts,
    providers,
    cloudNeedsAuth,
    hydrated,
    requestPayload,
    chooseMode,
    loadProviders,
    deleteFact,
    forgetAll,
    reloadFacts,
  };
}

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { useToast } from '../components/ui/Toast';
import { DemoModeContext } from '../context/app/DemoModeContext';
import type { RewardActionKey } from '../constants/credits';
import {
  REWARD_ACTIONS,
  REQUIRES_PROOF,
  WALLET_DAILY_QUESTIONS,
  ANON_DAILY_QUESTIONS,
} from '../constants/credits';
// Deep leaf import — NOT the barrel — keeps the timeout helper available
// without dragging the AI/swap/ethers stack into first-load.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

/**
 * Daily-question allowance hook.
 *
 * The advisor gate counts one question per call against today's AgentUsage
 * doc — wallet subjects get WALLET_DAILY_QUESTIONS, walletless callers are
 * keyed by IP and get ANON_DAILY_QUESTIONS. Earn actions grant extra
 * questions (once per action per day). The server is authoritative; this
 * hook just mirrors its verdict. No dollars anywhere.
 */

const FETCH_TIMEOUT_MS = 8000;
const CHANGED_EVENT = 'diversifi-allowance-changed';
const EXHAUSTED_EVENT = 'diversifi-allowance-exhausted';

export interface AllowanceState {
  remaining: number;
  limit: number;
  bonus: number;
  resetsAt: string;
  earnedToday: RewardActionKey[];
}

export interface EarnAction {
  key: RewardActionKey;
  label: string;
  questions: number;
  emoji: string;
  requiresProof: boolean;
}

// ── Global fetch tap ─────────────────────────────────────────────────────
// use-agent-chat owns the advisor fetch and can't be edited from here, so
// this module installs one lightweight interceptor: it tags advisor calls
// with the demo header while demo mode is active, and watches for the
// gate's 429 so every mounted hook instance snaps to exhausted without a
// poll. Installed once, process-wide.
let demoModeActive = false;
let fetchPatched = false;

function ensureFetchPatched() {
  if (fetchPatched || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isAdvisor = url.includes('/api/agent/advisor');
    let nextInit = init;
    if (isAdvisor && demoModeActive) {
      const headers = new Headers(init?.headers);
      headers.set('x-demo-mode', '1');
      nextInit = { ...init, headers };
    }
    const res = await original(input, nextInit);
    if (isAdvisor && res.status === 429) {
      res.clone().json()
        .then((detail) => window.dispatchEvent(new CustomEvent(EXHAUSTED_EVENT, { detail })))
        .catch(() => window.dispatchEvent(new CustomEvent(EXHAUSTED_EVENT)));
    }
    return res;
  };
}

function broadcast(state: AllowanceState) {
  try {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: state }));
  } catch {}
}

export function useAllowance() {
  const { address } = useWalletContext();
  const { showToast } = useToast();
  // Soft read — the hook must not throw outside DemoModeProvider.
  const demoMode = useContext(DemoModeContext)?.demoMode;
  const isDemo = demoMode?.isActive === true;

  const [state, setState] = useState<AllowanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState<RewardActionKey | null>(null);

  const applyServer = useCallback((data: Partial<AllowanceState> | null | undefined) => {
    if (!data) return;
    setState((prev) => {
      const next: AllowanceState = {
        remaining: typeof data.remaining === 'number' ? data.remaining : prev?.remaining ?? 0,
        limit: typeof data.limit === 'number'
          ? data.limit
          : prev?.limit ?? (address ? WALLET_DAILY_QUESTIONS : ANON_DAILY_QUESTIONS),
        bonus: typeof data.bonus === 'number' ? data.bonus : prev?.bonus ?? 0,
        resetsAt: data.resetsAt ?? prev?.resetsAt ?? '',
        earnedToday: (data.earnedToday as RewardActionKey[] | undefined) ?? prev?.earnedToday ?? [],
      };
      broadcast(next);
      return next;
    });
    setLoading(false);
  }, [address]);

  const refresh = useCallback(async () => {
    try {
      const qs = address ? `?subject=${encodeURIComponent(address)}` : '';
      const res = await fetchWithTimeout(`/api/agent/credits${qs}`, {}, FETCH_TIMEOUT_MS);
      if (!res.ok) return;
      applyServer(await res.json());
    } catch {
      // Keep last-known state; the footer simply stays quiet.
      setLoading(false);
    }
  }, [address, applyServer]);

  // Initial + per-wallet load.
  useEffect(() => {
    if (isDemo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [refresh, isDemo]);

  // Keep every mounted instance in sync (chat drawer + panel).
  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<AllowanceState>).detail;
      if (detail) setState(detail);
    };
    const onExhausted = (e: Event) => {
      const detail = (e as CustomEvent<Partial<AllowanceState>>).detail;
      if (detail && typeof detail.limit === 'number') {
        setState((prev) => ({
          remaining: 0,
          limit: detail.limit ?? prev?.limit ?? 0,
          bonus: detail.bonus ?? prev?.bonus ?? 0,
          resetsAt: detail.resetsAt ?? prev?.resetsAt ?? '',
          earnedToday: prev?.earnedToday ?? [],
        }));
      } else {
        void refresh();
      }
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener(EXHAUSTED_EVENT, onExhausted);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener(EXHAUSTED_EVENT, onExhausted);
    };
  }, [refresh]);

  // Install the fetch tap and keep the demo flag current.
  useEffect(() => {
    demoModeActive = isDemo;
    ensureFetchPatched();
  }, [isDemo]);

  const grant = useCallback(async (action: RewardActionKey, proof?: string) => {
    if (isDemo) return { success: true, granted: 0 };
    setGranting(action);
    try {
      const res = await fetchWithTimeout(
        '/api/agent/credits',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, proof, subject: address ?? undefined }),
        },
        FETCH_TIMEOUT_MS,
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        applyServer(data);
        const reward = REWARD_ACTIONS[action];
        showToast(`${reward.emoji} +${reward.questions} questions — ${reward.label}`, 'success');
        return { success: true, granted: reward.questions };
      }
      if (data?.alreadyClaimed) {
        applyServer(data);
        showToast('Already claimed today — it resets at midnight UTC.', 'info');
        return { success: false, granted: 0 };
      }
      showToast(`❌ ${data?.error || 'Could not earn questions right now'}`, 'error');
      return { success: false, granted: 0 };
    } catch {
      showToast('Failed to earn questions', 'error');
      return { success: false, granted: 0 };
    } finally {
      setGranting(null);
    }
  }, [address, applyServer, showToast, isDemo]);

  const shareApp = useCallback(async () => {
    const url = 'https://diversifiapp.vercel.app';
    const text = 'Protecting my savings from inflation with DiversiFi 🌍 — AI-powered portfolio diversification for emerging markets. Try it free:';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DiversiFi', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        showToast('Link copied! Share it to earn questions.', 'info');
      }
    } catch {
      // Share sheet dismissed — no grant.
      return { success: false, granted: 0 };
    }
    return grant('share_app');
  }, [grant, showToast]);

  /** The single highest-value action not yet claimed today. */
  const nextAction: EarnAction | null = useMemo(() => {
    const earned = new Set(state?.earnedToday ?? []);
    const pending = (Object.entries(REWARD_ACTIONS) as Array<
      [RewardActionKey, (typeof REWARD_ACTIONS)[RewardActionKey]]
    >)
      .filter(([key]) => !earned.has(key))
      .sort((a, b) => b[1].questions - a[1].questions)
      .map(([key, val]) => ({ key, ...val, requiresProof: REQUIRES_PROOF.includes(key) }));
    return pending[0] ?? null;
  }, [state?.earnedToday]);

  return {
    remaining: state?.remaining ?? null,
    limit: state?.limit ?? (address ? WALLET_DAILY_QUESTIONS : ANON_DAILY_QUESTIONS),
    bonus: state?.bonus ?? 0,
    resetsAt: state?.resetsAt ?? null,
    earnedToday: state?.earnedToday ?? [],
    nextAction,
    isDemo,
    loading,
    granting,
    refresh,
    grant,
    shareApp,
  };
}

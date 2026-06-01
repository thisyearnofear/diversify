import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { useToast } from '../components/ui/Toast';
import type { RewardActionKey } from '../constants/credits';
import { REWARD_ACTIONS, FREE_TRIAL_DAYS, FREE_TRIAL_CREDITS, STORAGE_KEY, REQUIRES_PROOF } from '../constants/credits';

export interface CreditsStatus {
  trial: {
    active: boolean;
    daysRemaining: number;
    creditsGranted: number;
    startedAt: number;
  };
  credits: {
    bonus: number;
    currency: string;
  };
  referral: {
    code: string;
    completedActions: RewardActionKey[];
    availableActions: Array<{ key: RewardActionKey; label: string; credits: number; emoji: string }>;
    totalEarned: number;
  };
}

interface StoredCredits {
  startedAt: number;
  bonusCredits: number;
  completedActions: RewardActionKey[];
  referralCode: string;
}

function getStorageKey(address?: string | null) {
  return address ? `${STORAGE_KEY}-${address.toLowerCase()}` : STORAGE_KEY;
}

function loadStored(address?: string | null): StoredCredits {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    if (raw) return JSON.parse(raw);
  } catch {}
  const code = `DIVERSIFI-${(address?.slice(-6) ?? Math.random().toString(36).slice(2, 8)).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { startedAt: Date.now(), bonusCredits: FREE_TRIAL_CREDITS, completedActions: [], referralCode: code };
}

const CREDITS_CHANGED_EVENT = 'diversifi-credits-changed';

function saveStored(data: StoredCredits, address?: string | null) {
  try {
    localStorage.setItem(getStorageKey(address), JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(CREDITS_CHANGED_EVENT, { detail: data }));
  } catch {}
}

async function syncFromServer(address: string, local: StoredCredits): Promise<StoredCredits> {
  try {
    const res = await fetch(`/api/agent/credits?userAddress=${encodeURIComponent(address)}`);
    if (!res.ok) return local;
    const { completedActions, totalEarned } = await res.json();
    const serverActions: RewardActionKey[] = completedActions || [];
    const totalEarnedServer = totalEarned || 0;

    const mergedActions = [...new Set([...serverActions, ...local.completedActions])];
    const mergedCredits = Math.max(local.bonusCredits, FREE_TRIAL_CREDITS + totalEarnedServer);

    return { ...local, completedActions: mergedActions, bonusCredits: mergedCredits };
  } catch {
    return local;
  }
}

export function useCredits() {
  const { address } = useWalletContext();
  const { showToast } = useToast();
  const [stored, setStoredState] = useState<StoredCredits | null>(null);
  const [claimingAction, setClaimingAction] = useState<RewardActionKey | null>(null);

  useEffect(() => {
    const init = async () => {
      let data = loadStored(address);
      if (address) {
        data = await syncFromServer(address, data);
      }
      setStoredState(data);
      saveStored(data, address);
    };
    init();
  }, [address]);

  // Sync across multiple useCredits() instances in the same tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StoredCredits>).detail;
      if (detail) setStoredState(detail);
    };
    window.addEventListener(CREDITS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, handler);
  }, []);

  const updateStored = useCallback((updater: (prev: StoredCredits) => StoredCredits) => {
    setStoredState(prev => {
      const next = updater(prev ?? loadStored(address));
      saveStored(next, address);
      return next;
    });
  }, [address]);

  const status: CreditsStatus | null = stored ? (() => {
    const elapsed = (Date.now() - stored.startedAt) / (24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil(FREE_TRIAL_DAYS - elapsed));
    const active = daysRemaining > 0;
    const availableActions = (Object.entries(REWARD_ACTIONS) as [RewardActionKey, typeof REWARD_ACTIONS[RewardActionKey]][])
      .filter(([key]) => !stored.completedActions.includes(key))
      .map(([key, val]) => ({ key, ...val }));
    return {
      trial: { active, daysRemaining, creditsGranted: FREE_TRIAL_CREDITS, startedAt: stored.startedAt },
      credits: { bonus: parseFloat(stored.bonusCredits.toFixed(4)), currency: 'USDC' },
      referral: {
        code: stored.referralCode,
        completedActions: stored.completedActions,
        availableActions,
        totalEarned: stored.completedActions.reduce((sum, key) => {
          const reward = REWARD_ACTIONS[key as keyof typeof REWARD_ACTIONS];
          return sum + (reward ? reward.credits : 0);
        }, 0),
      },
    };
  })() : null;

  const claimReward = useCallback(async (action: RewardActionKey, proof?: string) => {
    if (!stored) return { success: false, creditsEarned: 0 };
    if (stored.completedActions.includes(action)) {
      showToast('You\'ve already claimed this reward.', 'info');
      return { success: false, creditsEarned: 0 };
    }
    if (REQUIRES_PROOF.includes(action) && !proof) {
      showToast('Please provide a URL as proof for this action.', 'error');
      return { success: false, creditsEarned: 0 };
    }
    setClaimingAction(action);
    try {
      const res = await fetch('/api/agent/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, proof, userAddress: address }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Verification failed' }));
        if (err.alreadyClaimed) {
          updateStored(prev => ({
            ...prev,
            completedActions: [...new Set([...prev.completedActions, action])],
          }));
        }
        showToast(`❌ ${err.error}`, 'error');
        return { success: false, creditsEarned: 0 };
      }
      const reward = REWARD_ACTIONS[action as keyof typeof REWARD_ACTIONS];
      if (!reward) return { success: false, creditsEarned: 0 };
      updateStored(prev => ({
        ...prev,
        completedActions: [...prev.completedActions, action],
        bonusCredits: prev.bonusCredits + reward.credits,
      }));
      showToast(`${reward.emoji} +$${reward.credits.toFixed(2)} USDC credits for: ${reward.label}`, 'success');
      return { success: true, creditsEarned: reward.credits };
    } catch {
      showToast('Failed to claim reward', 'error');
    } finally {
      setClaimingAction(null);
    }
    return { success: false, creditsEarned: 0 };
  }, [stored, address, updateStored, showToast]);

  const shareApp = useCallback(async () => {
    const url = 'https://diversifiapp.vercel.app';
    const text = 'Protecting my savings from inflation with DiversiFi 🌍 — AI-powered portfolio diversification for emerging markets. Try it free:';
    if (navigator.share) {
      await navigator.share({ title: 'DiversiFi', text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      showToast('Link copied! Share it to earn credits.', 'info');
    }
    return claimReward('share_app');
  }, [claimReward, showToast]);

  const deductCredits = useCallback((amount: number) => {
    if (amount <= 0) return;
    updateStored(prev => ({
      ...prev,
      bonusCredits: Math.max(0, prev.bonusCredits - amount),
    }));
  }, [updateStored]);

  return {
    status,
    loading: stored === null,
    claimingAction,
    fetchStatus: () => {},
    claimReward,
    deductCredits,
    shareApp,
  };
}
import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../context/app/WalletContext';
import { useToast } from '../components/ui/Toast';
import { REWARD_ACTIONS } from '../pages/api/agent/credits';
import type { RewardActionKey } from '../pages/api/agent/credits';

const FREE_TRIAL_DAYS = 7;
const FREE_TRIAL_CREDITS = 0.5;
const STORAGE_KEY = 'diversifi-credits';

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

function getStorageKey(address?: string) {
  return address ? `${STORAGE_KEY}-${address.toLowerCase()}` : STORAGE_KEY;
}

function loadStored(address?: string): StoredCredits {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    if (raw) return JSON.parse(raw);
  } catch {}
  const code = `DIVERSIFI-${(address?.slice(-6) ?? Math.random().toString(36).slice(2, 8)).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { startedAt: Date.now(), bonusCredits: FREE_TRIAL_CREDITS, completedActions: [], referralCode: code };
}

function saveStored(data: StoredCredits, address?: string) {
  try {
    localStorage.setItem(getStorageKey(address), JSON.stringify(data));
  } catch {}
}

export function useCredits() {
  const { address } = useWalletContext();
  const { showToast } = useToast();
  const [stored, setStoredState] = useState<StoredCredits | null>(null);
  const [claimingAction, setClaimingAction] = useState<RewardActionKey | null>(null);

  // Load from localStorage on mount / address change
  useEffect(() => {
    const data = loadStored(address);
    setStoredState(data);
    saveStored(data, address); // persist on first visit
  }, [address]);

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
        totalEarned: stored.completedActions.reduce((sum, key) => sum + REWARD_ACTIONS[key].credits, 0),
      },
    };
  })() : null;

  const claimReward = useCallback(async (action: RewardActionKey, proof?: string) => {
    if (!stored) return { success: false, creditsEarned: 0 };
    if (stored.completedActions.includes(action)) {
      showToast('You\'ve already claimed this reward.', 'info');
      return { success: false, creditsEarned: 0 };
    }
    const requiresProof: RewardActionKey[] = ['blog_post', 'youtube_video', 'twitter_thread'];
    if (requiresProof.includes(action) && !proof) {
      showToast('Please provide a URL as proof for this action.', 'error');
      return { success: false, creditsEarned: 0 };
    }
    setClaimingAction(action);
    try {
      // For verifiable actions, validate proof URL server-side first
      if (requiresProof.includes(action)) {
        const res = await fetch('/api/agent/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, proof }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Verification failed' }));
          showToast(`❌ ${err.error}`, 'error');
          return { success: false, creditsEarned: 0 };
        }
      }
      const reward = REWARD_ACTIONS[action];
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
  }, [stored, updateStored, showToast]);

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

  return {
    status,
    loading: stored === null,
    claimingAction,
    fetchStatus: () => {}, // no-op — state is local
    claimReward,
    shareApp,
  };
}

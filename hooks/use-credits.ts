import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../context/app/WalletContext';
import { useToast } from '../components/ui/Toast';
import type { RewardActionKey } from '../pages/api/agent/credits';

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

export function useCredits() {
  const { address } = useWalletContext();
  const { showToast } = useToast();
  const [status, setStatus] = useState<CreditsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimingAction, setClaimingAction] = useState<RewardActionKey | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const params = address ? `?address=${address}` : '';
      const res = await fetch(`/api/agent/credits${params}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // silently fail — credits are non-critical
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const claimReward = useCallback(async (action: RewardActionKey, proof?: string) => {
    setClaimingAction(action);
    try {
      const params = address ? `?address=${address}` : '';
      const res = await fetch(`/api/agent/credits${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, proof }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        await fetchStatus();
        return { success: true, creditsEarned: data.creditsEarned };
      } else if (res.status === 409) {
        showToast('You\'ve already claimed this reward.', 'info');
      } else {
        showToast(data.error || 'Failed to claim reward', 'error');
      }
    } catch {
      showToast('Failed to claim reward', 'error');
    } finally {
      setClaimingAction(null);
    }
    return { success: false, creditsEarned: 0 };
  }, [address, fetchStatus, showToast]);

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
    loading,
    claimingAction,
    fetchStatus,
    claimReward,
    shareApp,
  };
}

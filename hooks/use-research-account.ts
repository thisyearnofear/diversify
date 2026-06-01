import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgentActivities } from "./use-agent-activities";
import { useArcBalance } from "./use-arc-balance";
import { useCredits } from "./use-credits";

const PAYMENT_SETTINGS_KEY = "diversifi-research-payment-settings";

export interface ResearchPaymentSettings {
  autoPayEnabled: boolean;
  autoPayMaxUSDC: number;
}

const DEFAULT_PAYMENT_SETTINGS: ResearchPaymentSettings = {
  autoPayEnabled: false,
  autoPayMaxUSDC: 0.015,
};

function loadPaymentSettings(): ResearchPaymentSettings {
  if (typeof window === "undefined") return DEFAULT_PAYMENT_SETTINGS;
  try {
    const raw = localStorage.getItem(PAYMENT_SETTINGS_KEY);
    if (!raw) return DEFAULT_PAYMENT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      autoPayEnabled: Boolean(parsed.autoPayEnabled),
      autoPayMaxUSDC: Number.isFinite(Number(parsed.autoPayMaxUSDC))
        ? Math.max(0.001, Number(parsed.autoPayMaxUSDC))
        : DEFAULT_PAYMENT_SETTINGS.autoPayMaxUSDC,
    };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

export function useResearchPaymentSettings() {
  const [settings, setSettings] = useState<ResearchPaymentSettings>(DEFAULT_PAYMENT_SETTINGS);

  useEffect(() => {
    setSettings(loadPaymentSettings());
  }, []);

  const updateSettings = useCallback((next: Partial<ResearchPaymentSettings>) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        ...next,
        autoPayMaxUSDC: next.autoPayMaxUSDC !== undefined
          ? Math.max(0.001, Number(next.autoPayMaxUSDC))
          : prev.autoPayMaxUSDC,
      };
      try {
        localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  return { settings, updateSettings };
}

export function useResearchAccount() {
  const { balance: arcWalletBalance, isOnArc, loading, refresh } = useArcBalance();
  const { status: creditsStatus } = useCredits();
  const { activities } = useAgentActivities();
  const paymentSettings = useResearchPaymentSettings();

  return useMemo(() => {
    const researchPayments = activities.filter(activity => activity.type === "research_payment");
    const today = new Date().toDateString();
    const spentToday = researchPayments
      .filter(activity => activity.status === "success" && new Date(activity.timestamp).toDateString() === today)
      .reduce((sum, activity) => sum + (activity.details?.cost || 0), 0);

    return {
      arcWalletBalance,
      isOnArc,
      loading,
      refresh,
      trial: creditsStatus?.trial ?? null,
      bonusCredits: creditsStatus?.credits.bonus ?? 0,
      referral: creditsStatus?.referral ?? null,
      researchPayments,
      spentToday,
      lastResearchPayment: researchPayments[0] ?? null,
      paymentSettings: paymentSettings.settings,
      updatePaymentSettings: paymentSettings.updateSettings,
    };
  }, [activities, arcWalletBalance, creditsStatus, isOnArc, loading, paymentSettings.settings, paymentSettings.updateSettings, refresh]);
}

/**
 * Local payment-cycle draft for the free FX report (no server persistence yet).
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'diversifi-payment-cycle-draft';

export interface PaymentCycleDraft {
  localCurrency: string;
  targetCurrency: string;
  paymentDate: string;
  targetAmountUsd: string;
}

const DEFAULT_DRAFT: PaymentCycleDraft = {
  localCurrency: '',
  targetCurrency: 'USD',
  paymentDate: '',
  targetAmountUsd: '',
};

function loadDraft(): PaymentCycleDraft {
  if (typeof window === 'undefined') return { ...DEFAULT_DRAFT };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DRAFT };
    return { ...DEFAULT_DRAFT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DRAFT };
  }
}

function saveDraft(draft: PaymentCycleDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // best-effort
  }
}

export function usePaymentCycleDraft(defaultLocalCurrency?: string) {
  const [draft, setDraft] = useState<PaymentCycleDraft>(() => {
    const loaded = loadDraft();
    if (!loaded.localCurrency && defaultLocalCurrency) {
      return { ...loaded, localCurrency: defaultLocalCurrency };
    }
    return loaded;
  });

  useEffect(() => {
    if (defaultLocalCurrency && !draft.localCurrency) {
      setDraft((d) => ({ ...d, localCurrency: defaultLocalCurrency }));
    }
  }, [defaultLocalCurrency, draft.localCurrency]);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const updateDraft = useCallback((patch: Partial<PaymentCycleDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft({ ...DEFAULT_DRAFT, localCurrency: defaultLocalCurrency ?? '' });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [defaultLocalCurrency]);

  return { draft, updateDraft, clearDraft };
}

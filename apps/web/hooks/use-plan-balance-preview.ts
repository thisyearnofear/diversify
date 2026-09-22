import { useEffect, useState } from 'react';
import type { RiskTolerance } from '@/components/protection-cards/plan-preview';

export function usePlanBalancePreview({
  scopeKey,
  savedRisk,
  onCommit,
  canCommit = true,
}: {
  scopeKey: string;
  savedRisk: RiskTolerance | null;
  onCommit: (risk: RiskTolerance) => void;
  canCommit?: boolean;
}) {
  const saved = savedRisk ?? 'Balanced';
  const [draft, setDraft] = useState<{ scopeKey: string; saved: RiskTolerance; risk: RiskTolerance } | null>(null);
  useEffect(() => setDraft(null), [scopeKey, saved]);
  const risk = draft?.scopeKey === scopeKey && draft.saved === saved ? draft.risk : saved;
  const isPreviewing = risk !== saved;
  const cancel = () => setDraft(null);
  const select = (next: RiskTolerance) => setDraft({ scopeKey, saved, risk: next });
  const commit = () => {
    if (!isPreviewing || !canCommit) return false;
    onCommit(risk);
    setDraft(null);
    return true;
  };
  return { risk, isPreviewing, select, cancel, commit };
}

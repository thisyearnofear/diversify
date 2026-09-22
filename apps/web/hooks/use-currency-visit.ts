import { useEffect, useMemo, useRef, useState } from 'react';
import { compareCurrencyVisits, isCurrencyVisitReading, type CurrencyVisitReading, type CurrencyVisitSnapshot } from '@diversifi/shared/src/services/currency-visit.service';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { MIN_SNAPSHOT_AGE_MS, readSnapshot, writeSnapshot } from '@/lib/since-last-visit';

export function useCurrencyVisit(moment: NarrativeMoment, enabled = true) {
  const visitTime = useRef<number | null>(null);
  // Quiet memory: last session's delta for this exact moment (currency ×
  // benchmark × horizon), so a returning visitor sees what moved without
  // anyone claiming fresh insight. Rounded to 0.1 — sub-tenth noise is
  // not a memory worth keeping.
  const baselines = useRef(new Map<string, CurrencyVisitSnapshot | null>());
  const reading = useMemo<CurrencyVisitReading>(() => ({
    key: `${moment.iso2}:${moment.currencyCode}:${moment.benchmark}:${moment.horizon}`,
    delta: moment.delta,
    dataAsOf: moment.dataAsOf,
    source: moment.isLive ? 'feed' : 'curated',
  }), [moment.iso2, moment.currencyCode, moment.benchmark, moment.horizon, moment.delta, moment.dataAsOf, moment.isLive]);
  const key = `home-reading:v1:${reading.key}:${reading.source}`;
  const [baseline, setBaseline] = useState<{ key: string; snapshot: CurrencyVisitSnapshot | null } | null>(null);

  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const observing = enabled && documentVisible;

  useEffect(() => {
    if (!observing || !isCurrencyVisitReading(reading)) return;
    visitTime.current ??= Date.now();
    if (!baselines.current.has(key)) baselines.current.set(key, readSnapshot<CurrencyVisitReading>(key));
    setBaseline({ key, snapshot: baselines.current.get(key) ?? null });
    writeSnapshot(key, reading);
  }, [observing, key, reading]);

  return observing && baseline?.key === key && visitTime.current !== null
    ? compareCurrencyVisits(reading, baseline.snapshot, visitTime.current, MIN_SNAPSHOT_AGE_MS)
    : null;
}

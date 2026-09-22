export interface CurrencyVisitReading {
  key: string;
  delta: number;
  dataAsOf: string;
  source: 'feed' | 'curated';
}

export interface CurrencyVisitSnapshot {
  value: CurrencyVisitReading;
  at: number;
}

export interface CurrencyVisitComparison {
  previous: CurrencyVisitSnapshot;
  current: CurrencyVisitReading;
  changePoints: number;
  kind: 'updated' | 'unchanged' | 'same-data' | 'revised';
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function isCurrencyVisitReading(value: unknown): value is CurrencyVisitReading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as CurrencyVisitReading;
  return typeof reading.key === 'string' && reading.key.length > 0
    && typeof reading.delta === 'number' && Number.isFinite(reading.delta) && reading.delta >= -100
    && validDate(reading.dataAsOf)
    && (reading.source === 'feed' || reading.source === 'curated');
}

export function compareCurrencyVisits(
  current: CurrencyVisitReading,
  previous: unknown,
  now: number,
  minimumAgeMs: number,
): CurrencyVisitComparison | null {
  if (!isCurrencyVisitReading(current) || !previous || typeof previous !== 'object') return null;
  const snapshot = previous as CurrencyVisitSnapshot;
  if (!isCurrencyVisitReading(snapshot.value)
    || typeof snapshot.at !== 'number' || !Number.isFinite(snapshot.at)
    || !Number.isFinite(now) || !Number.isFinite(minimumAgeMs) || minimumAgeMs < 0
    || snapshot.at <= 0 || now - snapshot.at < minimumAgeMs
    || snapshot.value.key !== current.key || snapshot.value.source !== current.source
    || Date.parse(current.dataAsOf) < Date.parse(snapshot.value.dataAsOf)
    || Date.parse(current.dataAsOf) > now || Date.parse(snapshot.value.dataAsOf) > snapshot.at) return null;
  const before = Math.round(snapshot.value.delta * 10);
  const after = Math.round(current.delta * 10);
  const changePoints = (after - before) / 10;
  const newer = current.dataAsOf > snapshot.value.dataAsOf;
  return {
    previous: snapshot,
    current,
    changePoints,
    kind: newer ? (changePoints === 0 ? 'unchanged' : 'updated') : (changePoints === 0 ? 'same-data' : 'revised'),
  };
}

export function formatCurrencyVisitPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0%';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1).replace(/\.0$/, '')}%`;
}

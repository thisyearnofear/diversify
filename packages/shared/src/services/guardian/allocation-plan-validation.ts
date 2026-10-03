import { EXPOSURE_LABELS } from '../../config/exposures';
import type { ExposurePlan } from '../../config/allocation-plans';

export function validateAllocationPlan(value: unknown, strategy?: string): ExposurePlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const plan = value as ExposurePlan;
  if (!Array.isArray(plan.slices) || plan.slices.length < 2 || plan.slices.length > 6 ||
      !plan.rules || typeof plan.rules !== 'object' || Array.isArray(plan.rules) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(plan.rules)) ||
      Object.keys(plan.rules).some((key) => key !== 'excludeYield') ||
      (plan.rules.excludeYield !== undefined && typeof plan.rules.excludeYield !== 'boolean')) return null;
  if (strategy === 'islamic' && plan.rules.excludeYield !== true) return null;
  const keys = new Set<string>();
  const slices = [];
  for (const slice of plan.slices) {
    if (!slice || typeof slice !== 'object' || Array.isArray(slice) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(slice)) ||
        typeof slice.exposure !== 'string' || !Object.hasOwn(EXPOSURE_LABELS, slice.exposure) ||
        !Number.isFinite(slice.target) || slice.target <= 0 || slice.target > 100 ||
        (slice.prefer !== undefined && slice.prefer !== 'yield' && slice.prefer !== 'liquid') ||
        (plan.rules.excludeYield && slice.prefer === 'yield')) return null;
    const key = `${slice.exposure}:${slice.prefer === 'yield'}`;
    if (keys.has(key)) return null;
    keys.add(key);
    slices.push({ exposure: slice.exposure, target: slice.target,
      region: EXPOSURE_LABELS[slice.exposure], why: 'User-committed allocation target',
      ...(slice.prefer ? { prefer: slice.prefer } : {}) });
  }
  if (Math.abs(slices.reduce((sum, slice) => sum + slice.target, 0) - 100) > 1e-6) return null;
  return { slices, rules: plan.rules.excludeYield ? { excludeYield: true } : {} };
}

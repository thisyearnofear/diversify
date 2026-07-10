import type { FinancialStrategy } from '@diversifi/shared';

/** Protection philosophies that target APAC-regulated savings (see docs/apac-rail.md). */
export const APAC_PHILOSOPHIES = new Set<FinancialStrategy>([
  'confucian',
  'gotong_royong',
]);

/**
 * Whether to show honest "APAC rail not shipped yet" messaging.
 * Applies when the user chose an APAC-facing plan and is in the Asia region.
 */
export function needsApacRailHonesty(
  philosophy: string | null | undefined,
  region: string | null | undefined,
): boolean {
  return !!(
    philosophy &&
    APAC_PHILOSOPHIES.has(philosophy as FinancialStrategy) &&
    region === 'Asia'
  );
}

export const APAC_RAIL_HONESTY_COPY = {
  title: 'APAC savings rail coming soon',
  body: 'Your plan runs on Celo and Arbitrum today. A dedicated Asia savings rail is planned — protection still works on global chains until then.',
} as const;

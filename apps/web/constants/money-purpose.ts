/**
 * Money purpose — what this money is for (separate from philosophy/values).
 */

export type MoneyPurpose =
  | 'everyday_buffer'
  | 'long_term_savings'
  | 'upcoming_payment';

export const MONEY_PURPOSES: Array<{
  value: MoneyPurpose;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'everyday_buffer',
    label: 'Everyday buffer',
    description: 'Money you may need soon for daily expenses',
    icon: '💳',
  },
  {
    value: 'long_term_savings',
    label: 'Long-term savings',
    description: 'Building purchasing power over years, not days',
    icon: '🏦',
  },
  {
    value: 'upcoming_payment',
    label: 'Upcoming business or supplier payment',
    description: 'You need a specific amount in another currency by a date',
    icon: '📅',
  },
];

export function moneyPurposeLabel(purpose: MoneyPurpose | null | undefined): string {
  if (!purpose) return 'Not set';
  return MONEY_PURPOSES.find((p) => p.value === purpose)?.label ?? purpose;
}

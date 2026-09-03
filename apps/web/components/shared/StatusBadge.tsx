import React from 'react';

export type StatusTone = 'ready' | 'warning' | 'error' | 'neutral' | 'info';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  detail?: string;
  compact?: boolean;
  className?: string;
}

const TONE_STYLES: Record<StatusTone, string> = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200',
  neutral: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
};

const DOT_STYLES: Record<StatusTone, string> = {
  ready: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  neutral: 'bg-gray-500',
  info: 'bg-blue-500',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  detail,
  compact = false,
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      role="status"
      aria-label={`${label}${detail ? ` ${detail}` : ''}`}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold ${
        compact ? 'uppercase tracking-wide' : ''
      } ${TONE_STYLES[tone]} ${className}`.trim()}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT_STYLES[tone]}`} />
      <span>{label}</span>
      {detail ? <span className="font-medium text-current">{detail}</span> : null}
    </span>
  );
}

export default StatusBadge;

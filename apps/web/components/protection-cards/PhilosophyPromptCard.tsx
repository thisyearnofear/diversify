/**
 * PhilosophyPromptCard — neutral framing when no philosophy is selected yet.
 *
 * Used on the onboarding risk step and Home unconnected calculator.
 */
import React from 'react';

export interface PhilosophyPromptCardProps {
  variant?: 'inline' | 'panel';
  className?: string;
}

export function PhilosophyPromptCard({
  variant = 'inline',
  className = '',
}: PhilosophyPromptCardProps) {
  if (variant === 'panel') {
    return (
      <div
        className={`bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 ${className}`}
      >
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
          Different communities respond differently
        </p>
        <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
          Choose a protection philosophy that matches your values.
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
          No lock-ups. No subscriptions. Your values, your plan.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/40 ${className}`}
    >
      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
        Different communities respond differently
      </p>
      <p className="text-[11px] text-emerald-500 dark:text-emerald-300">
        Choose a protection philosophy that matches your values — from Africapitalism to Islamic Finance.
      </p>
    </div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Emoji icon displayed at the top */
  icon: string;
  /** Bold title text */
  title: string;
  /** Muted description below the title */
  description: string;
  /** Optional action button shown below the description */
  action?: EmptyStateAction;
  /** Additional CSS classes for the outer card */
  className?: string;
}

/**
 * EmptyState — Centered empty-state card with icon, title, description and optional action.
 *
 * Used for: "No wallet connected", "No protection plan yet", "No portfolio data", etc.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon="🛡️"
 *   title="No protection plan yet"
 *   description="Start by connecting a wallet and exploring your options."
 *   action={{ label: "Connect Wallet", onClick: handleConnect }}
 * />
 * ```
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 ${className}`}
    >
      <div className="flex flex-col items-center text-center gap-3">
        {/* Large icon */}
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl shrink-0">
          {icon}
        </div>

        {/* Bold title */}
        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
          {title}
        </h3>

        {/* Muted description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
          {description}
        </p>

        {/* Optional action button */}
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md"
          >
            {action.label}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default EmptyState;

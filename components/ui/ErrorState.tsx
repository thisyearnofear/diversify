import React from 'react';
import { motion } from 'framer-motion';

interface ErrorStateProps {
  /** Custom title for the error message */
  title?: string;
  /** Detailed error description */
  message?: string;
  /** Called when user clicks "Try Again" — if omitted, the button is hidden */
  onRetry?: () => void;
  /** Additional CSS classes for the outer card */
  className?: string;
}

/**
 * ErrorState — Friendly error card shown when something crashes or times out.
 *
 * Design:
 * - Dark-themed card with warning icon
 * - Clear, reassuring title and message
 * - Optional "Try Again" button connected to a retry callback
 *
 * Usage:
 * ```tsx
 * <ErrorState
 *   title="Loading Failed"
 *   message="We couldn't load your portfolio. Your funds are safe."
 *   onRetry={() => refetch()}
 * />
 * ```
 */
const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 p-6 ${className}`}
    >
      <div className="flex flex-col items-center text-center gap-3">
        {/* Warning icon */}
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-3xl shrink-0">
          ⚠️
        </div>

        {/* Title */}
        <h3 className="text-lg font-black text-red-800 dark:text-red-200 leading-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-red-700 dark:text-red-300/80 max-w-sm leading-relaxed">
          {message}
        </p>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md"
          >
            Try Again
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ErrorState;

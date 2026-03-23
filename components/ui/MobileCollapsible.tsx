import React from 'react';
import { useMobile } from '@/hooks/use-mobile';

interface MobileCollapsibleProps {
  /** Title shown in the accordion header */
  title: string;
  /** Icon emoji to show before title */
  icon?: string;
  /** Content to show when expanded */
  children: React.ReactNode;
  /** Whether to start collapsed on mobile (default: true) */
  defaultCollapsedOnMobile?: boolean;
  /** Whether to always show expanded on desktop (default: true) */
  alwaysExpandedOnDesktop?: boolean;
  /** Additional classes for the container */
  className?: string;
}

/**
 * Collapsible accordion wrapper that:
 * - Collapses by default on mobile to reduce vertical clutter
 * - Always expanded on desktop
 * Uses native <details> element for zero-JS overhead
 */
export function MobileCollapsible({
  title,
  icon,
  children,
  defaultCollapsedOnMobile = true,
  alwaysExpandedOnDesktop = true,
  className = '',
}: MobileCollapsibleProps) {
  const isMobile = useMobile();

  // On desktop, always render expanded (no accordion)
  if (!isMobile && alwaysExpandedOnDesktop) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  // On mobile (or if alwaysExpandedOnDesktop is false), use accordion
  return (
    <details 
      className={`group ${className}`}
      open={!defaultCollapsedOnMobile}
    >
      <summary className="flex items-center justify-between cursor-pointer list-none py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors tap-target-min">
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</span>
        </div>
        <svg 
          className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-2">
        {children}
      </div>
    </details>
  );
}

export default MobileCollapsible;

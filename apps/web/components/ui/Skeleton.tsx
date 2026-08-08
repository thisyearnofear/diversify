import { type ReactNode } from "react";

// ── Primitive building blocks ──────────────────────────────────────────────

interface SkeletonBoxProps {
  className?: string;
  rounded?: string;
}

/** A single shimmering placeholder box. */
export function SkeletonBox({ className = "", rounded = "rounded-md" }: SkeletonBoxProps) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

interface SkeletonRowProps {
  lines?: number;
  className?: string;
}

/** A stack of placeholder lines (text-like). */
export function SkeletonRow({ lines = 2, className = "" }: SkeletonRowProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={i === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  children?: ReactNode;
}

/** A card-shaped skeleton with optional custom content. */
export function SkeletonCard({ className = "", children }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-2xl bg-gray-100 dark:bg-gray-800 p-5 space-y-3 animate-pulse ${className}`}
      aria-hidden="true"
    >
      {children ?? (
        <>
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-10 w-10" rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-3 w-32" />
              <SkeletonBox className="h-3 w-48" />
            </div>
          </div>
          <SkeletonBox className="h-10 w-full" rounded="rounded-xl" />
        </>
      )}
    </div>
  );
}

// ── Composite skeletons ────────────────────────────────────────────────────

/** Full-page loading skeleton for tab content. */
export function TabSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4 pt-4" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => {
      const heightClass = i === 0 ? "h-10" : i === 1 ? "h-8" : "h-40";
      const radiusClass = i === 2 ? "rounded-2xl" : "rounded-xl";
      const widthClass = i === 1 ? "w-3/4" : "w-full";
      return (
        <div
          key={i}
          className={`${heightClass} ${radiusClass} ${widthClass} bg-gray-100 dark:bg-gray-800`}
        />
      );
    })}
    </div>
  );
}

/** Inline loading spinner for buttons / small areas. */
export function InlineSpinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

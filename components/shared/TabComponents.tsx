import React, { useState } from "react";
import { motion } from "framer-motion";
import NetworkSwitcher from "../swap/NetworkSwitcher";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";

// ============================================================================
// NEW: Progressive Disclosure Components (following Core Principles)
// ============================================================================

/** 
 * StepCard - Used for wizard-style progressive disclosure 
 * Shows one step at a time, reducing cognitive load
 */
export const StepCard = ({
  step,
  totalSteps,
  title,
  children,
  onNext,
  onSkip,
  onBack,
  canSkip = true,
  isLast = false,
  canProceed = true,
}: {
  step: number;
  totalSteps: number;
  title: string;
  children: React.ReactNode;
  onNext?: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  canSkip?: boolean;
  isLast?: boolean;
  canProceed?: boolean;
}) => (
  <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl p-4 border border-blue-100">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {step > 1 && onBack && (
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <span className="text-xs font-black uppercase text-blue-600 tracking-widest">
          Step {step} of {totalSteps}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-1 rounded-full ${i < step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
            />
          ))}
        </div>
      </div>
      {canSkip && onSkip && (
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 font-bold"
        >
          Skip →
        </button>
      )}
    </div>
    <h4 className="text-sm font-black text-gray-900 mb-4">{title}</h4>
    {children}
    {onNext && (
      <button
        onClick={onNext}
        disabled={!canProceed}
        className={`w-full mt-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${canProceed
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
      >
        {isLast ? 'Complete' : 'Continue'} →
      </button>
    )}
  </div>
);

/**
 * InsightCard - Primary actionable insight with clear hierarchy
 * Replaces multiple competing recommendation components
 * 
 * Note: Confidence is now shown via ProtectionScore component, not inline
 */
export const InsightCard = ({
  icon,
  title,
  description,
  impact,
  action,
  variant = 'default',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  impact?: string;
  action?: {
    label: string;
    onClick: () => void;
    cost?: string;
    disabled?: boolean;
    loading?: boolean;
  };
  variant?: 'urgent' | 'default' | 'success' | 'reward';
  children?: React.ReactNode;
}) => {
  const variants = {
    urgent: 'bg-amber-50 border-amber-200',
    default: 'bg-blue-50 border-blue-200',
    success: 'bg-emerald-50 border-emerald-200',
    reward: 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200',
  };

  return (
    <div className={`rounded-xl p-4 border-2 ${variants[variant]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0 ${variant === 'reward' ? 'bg-white' : 'bg-white'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-gray-900">{title}</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>

          {impact && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${variant === 'reward' ? 'text-green-700 bg-green-200' : 'text-green-600 bg-green-100'}`}>
                {impact}
              </span>
            </div>
          )}
        </div>
      </div>

      {children && (
        <div className="mt-3">
          {children}
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled || action.loading}
          className={`w-full mt-3 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${action.disabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : variant === 'reward'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {action.loading ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            action.label
          )}
          {action.cost && !action.loading && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
              {action.cost}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

/**
 * QuickSelect - Grid selection component for goals/preferences
 * Consolidates multiple selection UIs into one reusable component
 */
export const QuickSelect = <T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: ReadonlyArray<{ value: T; label: string; icon?: string; description?: string }>;
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) => {
  const gridCols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

  return (
    <div className={`grid ${gridCols[columns]} gap-2`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-3 border-2 rounded-xl text-center transition-all ${value === opt.value
              ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/10'
              : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
        >
          {opt.icon && <div className="text-xl mb-1">{opt.icon}</div>}
          <div className="text-[10px] font-black uppercase text-gray-900 leading-tight">
            {opt.label}
          </div>
          {opt.description && (
            <div className="text-[9px] text-gray-500 mt-0.5">{opt.description}</div>
          )}
        </button>
      ))}
    </div>
  );
};

/**
 * ProtectionScore - Single consolidated trust indicator
 * Replaces: confidence badges, "Oracle Live", "Analysis Confidence", factor breakdowns
 * 
 * Shows one score with collapsible breakdown for power users
 */
export interface ProtectionFactor {
  label: string;
  value: number; // 0-100
  status: string;
  icon: string;
}

// Radial ring circumference for r=18 circle: 2π×18 ≈ 113.1
const RING_C = 2 * Math.PI * 18;

export const ProtectionScore = ({
  score,
  factors,
  className = '',
  defaultOpen = false,
}: {
  score: number;
  factors?: ProtectionFactor[];
  className?: string;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isGood = score >= 80;
  const isOk   = score >= 60;

  const ringColor  = isGood ? '#10b981' : isOk ? '#f59e0b' : '#ef4444';
  const borderColor = isGood ? 'border-emerald-200' : isOk ? 'border-amber-200' : 'border-red-200';
  const bgColor     = isGood ? 'bg-emerald-50'      : isOk ? 'bg-amber-50'      : 'bg-red-50';
  const textColor   = isGood ? 'text-emerald-600'   : isOk ? 'text-amber-600'   : 'text-red-600';
  const statusText  = isGood ? 'Excellent' : isOk ? 'Good' : 'Needs attention';

  const filled = (score / 100) * RING_C;

  return (
    <div className={`rounded-2xl border ${bgColor} ${borderColor} overflow-hidden ${className}`}>
      {/* Main Score Row — radial ring + text */}
      <button
        onClick={() => factors && setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-4 p-4 ${factors ? 'hover:bg-black/5 cursor-pointer' : 'cursor-default'}`}
      >
        {/* SVG Radial Ring */}
        <div className="shrink-0 relative w-14 h-14">
          <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="4"
              className="opacity-10" style={{ color: ringColor }} />
            {/* Progress */}
            <circle cx="20" cy="20" r="18" fill="none" stroke={ringColor} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${filled.toFixed(1)} ${RING_C.toFixed(1)}`} />
          </svg>
          {/* Score label centred over the ring */}
          <div className={`absolute inset-0 flex items-center justify-center ${textColor}`}>
            <span className="text-[11px] font-black leading-none">{score}%</span>
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black ${textColor}`}>Protection Score</span>
          </div>
          <span className={`text-[11px] font-bold ${textColor} opacity-80`}>{statusText} protection</span>
        </div>

        {factors && (
          <svg className={`w-4 h-4 ${textColor} shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Factor Breakdown — collapsible */}
      {factors && isOpen && (
        <div className="px-4 pb-4 border-t border-black/5">
          <div className="pt-3 space-y-2">
            {factors.map((factor, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs w-4 shrink-0">{factor.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{factor.label}</span>
                    <span className="text-[9px] text-gray-500">{factor.status}</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        factor.value >= 80 ? 'bg-emerald-500' :
                        factor.value >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${factor.value}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ProtectionDashboard - Consolidated hero + score + factors
 * Combines: HeroValue + ProtectionScore into one dynamic card
 * 
 * Features:
 * - Score ring integrated into hero row
 * - Animated progress bars for each factor
 * - Staggered entrance animations
 * - Gradient backgrounds
 */
export interface DashboardFactor {
  label: string;
  value: number; // 0-100
  status: string;
  icon: string;
}

export const ProtectionDashboard = ({
  title,
  subtitle,
  icon,
  totalValue,
  chainCount,
  score,
  factors,
  isLoading = false,
  isStale = false,
  children,
  streak,
  canClaim,
  estimatedReward,
  onClaim,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  totalValue?: string;
  chainCount?: number;
  score: number;
  factors: DashboardFactor[];
  isLoading?: boolean;
  isStale?: boolean;
  children?: React.ReactNode;
  streak?: { daysActive: number } | null;
  canClaim?: boolean;
  estimatedReward?: string;
  onClaim?: () => void;
}) => {
  const isGood = score >= 80;
  const isOk = score >= 60;

  const ringColor = isGood ? '#10b981' : isOk ? '#f59e0b' : '#ef4444';
  const statusText = isGood ? 'Excellent' : isOk ? 'Good' : 'Needs attention';

  const filled = (score / 100) * RING_C;
  const hasStreak = streak && streak.daysActive > 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl overflow-hidden shadow-xl">
      {/* Hero Section */}
      <div className="p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            {title && (
              <h3 className="text-xl font-black uppercase tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
              <span className="text-2xl">{icon}</span>
            </div>
          )}
        </div>

        {/* Value + Score Row */}
        <div className="flex items-center justify-center gap-8">
          {/* Total Value */}
          <div className="text-center">
            {isLoading ? (
              <div className="h-9 w-24 bg-white/30 rounded-xl animate-pulse mx-auto" />
            ) : (
              <div className="text-3xl font-black tracking-tight">
                {totalValue || '$0'}
              </div>
            )}
            <div className="text-xs text-indigo-200 font-medium mt-1">
              {isLoading ? 'Loading...' : (chainCount ? `Protected across ${chainCount} chain${chainCount !== 1 ? 's' : ''}` : 'Total Value')}
            </div>
          </div>

          {/* Score Ring */}
          <div className="shrink-0 relative w-20 h-20">
            <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
              {/* Track */}
              <circle cx="22" cy="22" r="18" fill="none" stroke="white" strokeWidth="4" className="opacity-20" />
              {/* Progress */}
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${filled.toFixed(1)} ${RING_C.toFixed(1)}`}
              />
            </svg>
            {/* Score label */}
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-lg font-black leading-none" style={{ color: ringColor }}>
                {score}%
              </span>
              <span className="text-[8px] font-bold opacity-80" style={{ color: ringColor }}>
                {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* GoodDollar Streak - Miniaturized and integrated */}
        {hasStreak && (
          <button
            onClick={onClaim}
            className="w-full mt-4 flex items-center justify-between p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">💚</span>
              <div className="text-left">
                <span className="text-[10px] font-black text-white/90">
                  {canClaim ? "G$ Ready!" : `G$ · ${streak?.daysActive}-Day Streak`}
                </span>
                <p className="text-[9px] text-white/60">
                  {canClaim ? (estimatedReward || "Claim now") : "Free UBI on Celo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {canClaim && (
                <span className="size-1.5 bg-emerald-400 rounded-full animate-pulse" />
              )}
              <span className="text-[10px] font-black text-white/70 group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </button>
        )}

        {isStale && (
          <p className="text-xs text-white/60 mt-4 text-center">
            Data may be stale. Pull down to refresh.
          </p>
        )}
      </div>

      {/* Factors Section */}
      <div className="bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-black uppercase text-gray-400">Protection Factors</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {factors.map((factor, idx) => (
            <motion.div
              key={factor.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm">{factor.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{factor.label}</span>
                  <span className="text-[9px] text-gray-500">{factor.status}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${factor.value}%` }}
                    transition={{ duration: 0.5, delay: 0.2 + idx * 0.1 }}
                    className={`h-full rounded-full ${
                      factor.value >= 80 ? 'bg-emerald-500' :
                      factor.value >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {children && (
        <div className="bg-white dark:bg-gray-800 px-4 pb-4">
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * @deprecated Use ProtectionScore instead
 */
export const TrustBadge = ProtectionScore;

// Collapsible section for progressive disclosure
export const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-4 bg-white dark:bg-gray-900">{children}</div>}
    </div>
  );
};

// Consistent tab header with network controls
export const TabHeader = ({
  title,
  chainId = null,
  onRefresh,
  isLoading,
  onNetworkChange,
  showNetworkSwitcher = true,
  rightContent,
}: {
  title: string;
  chainId?: number | null;
  onRefresh?: () => void;
  isLoading?: boolean;
  onNetworkChange?: () => Promise<void>;
  showNetworkSwitcher?: boolean;
  rightContent?: React.ReactNode;
}) => {
  const networkName = ChainDetectionService.getNetworkName(chainId);

  return (
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {chainId && (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">
            {networkName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {rightContent}
        {showNetworkSwitcher && (
          <NetworkSwitcher
            currentChainId={chainId ?? null}
            onNetworkChange={onNetworkChange}
            compact
            className="min-w-0"
          />
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0"
            title="Refresh"
            disabled={isLoading}
          >
            <svg
              className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// Card container with consistent styling
export const Card = ({
  children,
  className = "",
  padding = "p-4",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 ${padding} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Empty state component
export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}) => (
  <div className="text-center py-8">
    <div className="flex justify-center mb-4">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-2xl">
        {icon}
      </div>
    </div>
    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm inline-flex items-center gap-2"
      >
        {action.icon}
        {action.label}
      </button>
    )}
  </div>
);

// Compact stat display
export const StatBadge = ({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: string | number;
  color?: "gray" | "green" | "blue" | "red" | "yellow" | "white";
}) => {
  const colors = {
    gray: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    green: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
    red: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
    yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
    white: "bg-white/20 text-white border border-white/30 backdrop-blur-sm",
  };
  return (
    <div className={`${colors[color]} px-4 py-2 rounded-xl text-center min-w-0 flex-1`}>
      <div className="text-xs opacity-80 mb-1">{label}</div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
};

// Primary action button
export const PrimaryButton = ({
  children,
  onClick,
  disabled,
  loading,
  icon,
  fullWidth,
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        inline-flex items-center justify-center gap-2
      `}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  );
};

// Secondary action button
export const SecondaryButton = ({
  children,
  onClick,
  disabled,
  icon,
  fullWidth,
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        inline-flex items-center justify-center gap-2
      `}
    >
      {icon}
      {children}
    </button>
  );
};

// Feature highlight card (for premium features like RWA vaults)
export const FeatureCard = ({
  title,
  badge,
  children,
  variant = "default",
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "premium";
}) => {
  const styles = {
    default: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    premium: "bg-gradient-to-br from-blue-600 to-indigo-700 text-white border border-blue-500/30",
  };
  return (
    <div className={`${styles[variant]} rounded-xl p-4 shadow-md`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className={`font-bold text-sm ${variant === "premium" ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </div>
  );
};

// Loading spinner
export const LoadingSpinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return (
    <svg className={`animate-spin ${sizes[size]} text-blue-600`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ENHANCEMENT: Connect wallet prompt with swap preview (standardized across tabs)
// Note: Buy crypto CTA handled in OverviewTab's empty wallet detection
export const ConnectWalletPrompt = ({
  message = "Connect your wallet to continue.",
  WalletButtonComponent,
  // Swap preview props
  userRegion,
  inflationData,
  availableTokens,
  experienceMode = "advanced",
}: {
  message?: string;
  WalletButtonComponent: React.ReactNode;
  userRegion?: string;
  inflationData?: Record<string, { avgRate: number }>;
  availableTokens?: Array<{ symbol: string; name: string; region: string }>;
  experienceMode?: "beginner" | "intermediate" | "advanced";
}) => {
  const isBeginner = experienceMode === "beginner";
  const homeInflation = inflationData?.[userRegion || "Global"]?.avgRate || 15.4;
  
  // Popular stablecoins and their typical inflation rates
  const STABLECOIN_RATES: Record<string, number> = {
    "USDm": 3.1,
    "USDC": 3.1,
    "USDT": 3.1,
    "EURm": 2.3,
    "EURC": 2.3,
    "PAXG": 0.5, // Gold-backed
  };

  // Calculate potential savings for top 3 recommendations
  const recommendations = [
    { symbol: "USDm", region: "Global", savings: homeInflation - 3.1 },
    { symbol: "EURm", region: "Europe", savings: homeInflation - 2.3 },
    { symbol: "PAXG", region: "Commodities", savings: homeInflation - 0.5 },
  ].filter(r => r.savings > 0).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Main prompt */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">🔓</span>
          <div className="flex-1">
            <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 mb-1">
              Connect Wallet to Start Protecting
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
              {isBeginner 
                ? `Your money in ${userRegion} is losing ${(homeInflation).toFixed(1)}% value per year. Let's fix that!`
                : message
              }
            </p>
          </div>
        </div>
        {WalletButtonComponent}
        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-3 text-center">
          🔒 Secure connection • No signup required • Free to use
        </p>
      </div>

      {/* Beginner: Simple savings calculator */}
      {isBeginner && recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💰</span>
            <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
              Potential Savings
            </h4>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.symbol} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-300">
                    {rec.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">{rec.symbol}</div>
                    <div className="text-[9px] text-gray-500">{rec.region} • {(STABLECOIN_RATES[rec.symbol] || 0).toFixed(1)}% inflation</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">+{rec.savings.toFixed(1)}%/yr</div>
                  <div className="text-[9px] text-gray-500">on $100</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-emerald-700 dark:text-emerald-400 mt-3 text-center font-medium italic">
            💡 Connect wallet to start saving — takes 2 minutes
          </p>
        </div>
      )}

      {/* Advanced: Available tokens preview */}
      {!isBeginner && availableTokens && availableTokens.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">Available Assets</h4>
            <span className="text-[10px] text-gray-500 font-bold">{availableTokens.length} tokens</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableTokens.slice(0, 6).map((token) => {
              const tokenRate = STABLECOIN_RATES[token.symbol] || homeInflation * 0.2;
              const savings = homeInflation - tokenRate;
              return (
                <div key={token.symbol} className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-black text-blue-700 dark:text-blue-300">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{token.symbol}</span>
                  </div>
                  <div className="text-[9px] text-gray-500 truncate">{token.region}</div>
                  {savings > 0 && (
                    <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      +{savings.toFixed(1)}% vs {userRegion}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {availableTokens.length > 6 && (
            <p className="text-[9px] text-gray-400 mt-2 text-center font-medium">
              +{availableTokens.length - 6} more tokens available after connecting
            </p>
          )}
        </div>
      )}

      {/* Inflation comparison (both modes) */}
      {inflationData && userRegion && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📊</span>
            <h4 className="text-sm font-black text-amber-900 dark:text-amber-100">
              {isBeginner ? "Why Diversify?" : "Inflation Comparison"}
            </h4>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Your Region</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{homeInflation.toFixed(1)}%</div>
              <div className="text-[9px] text-gray-500 mt-1">{userRegion}</div>
            </div>
            <div className="flex items-center px-4">
              <div className="text-gray-300 text-2xl">→</div>
              <div className="ml-2 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                Save up to {(homeInflation - 0.5).toFixed(1)}%
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Stablecoins</div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">0.5-3.1%</div>
              <div className="text-[9px] text-gray-500 mt-1">Global avg</div>
            </div>
          </div>
          {isBeginner && (
            <p className="text-[9px] text-amber-700 dark:text-amber-400 mt-3 text-center font-medium leading-relaxed">
              💡 <strong>Quick tip:</strong> Converting just $100 to stablecoins can save you <strong>${(100 * (homeInflation - 3.1) / 100).toFixed(2)}</strong> per year
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Layout Utilities
// ============================================================================

/**
 * Section - Consistent section wrapper with optional divider
 */
export const Section = ({
  children,
  className = '',
  divider = false,
}: {
  children: React.ReactNode;
  className?: string;
  divider?: boolean;
}) => (
  <div className={`${divider ? 'pt-4 mt-4 border-t border-gray-100 dark:border-gray-800' : ''} ${className}`}>
    {children}
  </div>
);

/**
 * HeroValue - Large value display for primary metrics
 * isLoading renders a skeleton so "$0 loading" ≠ "$0 empty"
 */
export const HeroValue = ({
  value,
  label,
  isLoading = false,
  trend,
}: {
  value: string;
  label: string;
  isLoading?: boolean;
  trend?: { value: string; positive: boolean };
}) => (
  <div className="text-center">
    {isLoading ? (
      <div className="h-9 w-28 bg-white/30 dark:bg-white/10 rounded-xl animate-pulse mx-auto" />
    ) : (
      <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
        {value}
      </div>
    )}
    <div className="flex items-center justify-center gap-2 mt-1">
      {isLoading ? (
        <div className="h-3 w-36 bg-white/20 dark:bg-white/10 rounded-full animate-pulse" />
      ) : (
        <>
          <span className="text-xs text-gray-500 font-medium">{label}</span>
          {trend && (
            <span className={`text-[10px] font-bold ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </>
      )}
    </div>
  </div>
);

import React, { useState } from "react";
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
  canSkip?: boolean;
  isLast?: boolean;
  canProceed?: boolean;
}) => (
  <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl p-4 border border-blue-100">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
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

  const colorClass = score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' :
      'text-red-600 bg-red-50 border-red-200';

  const dotColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={`rounded-xl border ${colorClass} overflow-hidden ${className}`}>
      {/* Main Score - Always Visible */}
      <button
        onClick={() => factors && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 ${factors ? 'hover:bg-black/5 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black">{score}% Protection Score</span>
              <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            </div>
            <span className="text-[10px] opacity-80">
              {score >= 80 ? 'Excellent protection' : score >= 60 ? 'Good protection' : 'Needs attention'}
            </span>
          </div>
        </div>
        {factors && (
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Factor Breakdown - Collapsible for Power Users */}
      {factors && isOpen && (
        <div className="px-3 pb-3 border-t border-black/5">
          <div className="pt-2 space-y-2">
            {factors.map((factor, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs">{factor.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-700">{factor.label}</span>
                    <span className="text-[9px] text-gray-500">{factor.status}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${factor.value >= 80 ? 'bg-emerald-500' :
                          factor.value >= 60 ? 'bg-amber-500' :
                            'bg-red-500'
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
    className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${padding} ${className}`}
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

// Connect wallet prompt (standardized across tabs)
export const ConnectWalletPrompt = ({
  message = "Connect your wallet to continue.",
  WalletButtonComponent,
}: {
  message?: string;
  WalletButtonComponent: React.ReactNode;
}) => (
  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-3">{message}</p>
    {WalletButtonComponent}
  </div>
);

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
 */
export const HeroValue = ({
  value,
  label,
  trend,
}: {
  value: string;
  label: string;
  trend?: { value: string; positive: boolean };
}) => (
  <div className="text-center">
    <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
      {value}
    </div>
    <div className="flex items-center justify-center gap-2 mt-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      {trend && (
        <span className={`text-[10px] font-bold ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>
      )}
    </div>
  </div>
);

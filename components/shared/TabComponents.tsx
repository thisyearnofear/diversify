import React, { useState } from "react";
import NetworkSwitcher from "../swap/NetworkSwitcher";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";

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
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 ${padding} ${className}`}>
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

/**
 * GuardianWDKStatus - Inline status for the Tether WDK settlement agent.
 * On mobile, shows compact summary with option to open full wizard.
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";
import GuardianMobileWizard from "./GuardianMobileWizard";

interface GuardianWDKStatusProps {
  agentStatus: "online" | "offline" | "uninitialized" | "loading";
  hasTokenVault?: boolean;
  agentIdentity: {
    agent_id: string;
    name: string;
    version: string;
    chains: string[];
  } | null;
  recentReceipts: Array<{
    id: string;
    timestamp: number;
    action: string;
    asset: string;
    amount: string;
    status: "success" | "error" | "pending";
    txHash?: string;
  }>;
  isExecuting: boolean;
  onTriggerHeartbeat: () => void;
}

const statusIndicator: Record<
  GuardianWDKStatusProps["agentStatus"],
  { color: string; label: string }
> = {
  online: { color: "bg-green-500", label: "Protected" },
  offline: { color: "bg-red-500", label: "Not Connected" },
  uninitialized: { color: "bg-gray-400", label: "Not Set Up" },
  loading: { color: "bg-amber-500", label: "Connecting…" },
};

const GuardianWDKStatus: React.FC<GuardianWDKStatusProps> = ({
  agentStatus,
  agentIdentity,
  recentReceipts,
  isExecuting,
  onTriggerHeartbeat,
  hasTokenVault = false,
}) => {
  const { color, label } = statusIndicator[agentStatus];
  const displayName = "Auto-Saver";
  const isMobile = useMobile();
  const [showWizard, setShowWizard] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const wasExecuting = React.useRef(false);

  useEffect(() => {
    if (wasExecuting.current && !isExecuting) {
      setLastCheckedAt(Date.now());
    }
    wasExecuting.current = isExecuting;
  }, [isExecuting]);

  const handleCheckClick = () => {
    onTriggerHeartbeat();
  };

  const lastCheckedLabel = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Show mobile wizard when triggered
  if (showWizard) {
    return (
      <GuardianMobileWizard
        userAddress=""
        onComplete={() => setShowWizard(false)}
        onCancel={() => setShowWizard(false)}
        onCreateVault={async () => true}
        onRequestPermission={async () => true}
      />
    );
  }

  // Mobile: Compact view with wizard trigger
  if (isMobile) {
    return (
      <div className="bg-green-50/60 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🛡️</span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
                Auto-Saver {agentStatus === "online" ? "On" : "Off"}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {agentStatus === "online" ? "Protecting your savings" : "Tap to set up"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {agentStatus === "online" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
            </span>
            <button
              onClick={() => setShowWizard(true)}
              className="px-3 py-2 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Configure
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Full view
  return (
    <div className="bg-green-50/60 dark:bg-green-900/20 rounded-xl p-3 space-y-2 border border-green-100 dark:border-green-800/50">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm flex-shrink-0">🛡️</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </span>
            {agentIdentity && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                Works across {agentIdentity.chains.length} networks
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
            <span className="relative flex h-2 w-2">
              {agentStatus === "online" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </span>
        </div>
      </div>

      {/* Management / Config Info */}
      <div className="text-sm text-gray-500 dark:text-gray-400 py-1">
        {agentStatus === "online"
          ? "Watching your savings and ready to help."
          : agentStatus === "loading"
            ? "Getting ready…"
            : "Tap below to wake it up."}
      </div>

      {/* Token Vault Badge */}
      {hasTokenVault && (
        <div className="flex items-center gap-1.5 py-1 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
          <span className="text-xs">🛡️</span>
          <span>Token Vault Enabled</span>
        </div>
      )}

      {/* Trigger Heartbeat / WDK Ping */}
      <div className="border-t border-green-200 dark:border-green-800 pt-2 space-y-1">
        <button
          onClick={handleCheckClick}
          disabled={isExecuting}
          className="w-full flex items-center justify-center gap-1.5 py-3 px-3 min-h-[44px] rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >
          {isExecuting ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="inline-block"
            >
              ⟳
            </motion.span>
          ) : (
            <span>🛡️</span>
          )}
          <span>{isExecuting ? "Checking…" : "Check now"}</span>
        </button>
        {lastCheckedLabel && !isExecuting && (
          <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
            Last checked {lastCheckedLabel}
          </p>
        )}
      </div>
    </div>
  );
};

export default GuardianWDKStatus;

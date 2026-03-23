/**
 * GuardianWDKStatus - Inline status for the Tether WDK settlement agent.
 * On mobile, shows compact summary with option to open full wizard.
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useMobile } from "@/hooks/use-mobile";
import GuardianMobileWizard from "./GuardianMobileWizard";

interface GuardianWDKStatusProps {
  agentStatus: "online" | "offline" | "uninitialized" | "loading";
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
  online: { color: "bg-green-500", label: "Online" },
  offline: { color: "bg-red-500", label: "Offline" },
  uninitialized: { color: "bg-gray-400", label: "Not Initialized" },
  loading: { color: "bg-amber-500", label: "Connecting…" },
};

const GuardianWDKStatus: React.FC<GuardianWDKStatusProps> = ({
  agentStatus,
  agentIdentity,
  recentReceipts,
  isExecuting,
  onTriggerHeartbeat,
}) => {
  const { color, label } = statusIndicator[agentStatus];
  const displayName = agentIdentity?.name ?? "Settlement Agent";
  const isMobile = useMobile();
  const [showWizard, setShowWizard] = useState(false);

  // Show mobile wizard when triggered
  if (showWizard) {
    return (
      <GuardianMobileWizard
        onComplete={() => setShowWizard(false)}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  // Mobile: Compact view with wizard trigger
  if (isMobile) {
    return (
      <div className="bg-green-50/60 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🌌</span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
                Guardian {agentStatus === "online" ? "Active" : "Inactive"}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {agentIdentity?.chains.join(", ") ?? "Not configured"}
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
          <span className="text-sm flex-shrink-0">🌌</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </span>
            {agentIdentity && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {agentIdentity.chains.join(", ")}
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
        Settlement agent is {agentStatus === "online" ? "active and scanning" : "waiting for connection"}.
      </div>

      {/* Trigger Heartbeat / WDK Ping */}
      <div className="border-t border-green-200 dark:border-green-800 pt-2">
        <button
          onClick={onTriggerHeartbeat}
          disabled={isExecuting || agentStatus === "offline"}
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
            <span>🛸</span>
          )}
          <span>{isExecuting ? "Executing Settlement…" : "Ping Settlement Agent"}</span>
        </button>
      </div>
    </div>
  );
};

export default GuardianWDKStatus;

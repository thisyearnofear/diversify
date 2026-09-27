import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { usePrivy } from "@privy-io/react-auth";
import { useVoiceEnabled } from "../ui/VoiceButton";
import { useToast } from "../ui/Toast";
import { useGuardianVisibility } from "@/context/app/GuardianVisibilityContext";

const AUTOMATION_STORAGE_KEY = "diversifi-automation-prefs";

function getStorageKey(address: string) {
  return `${AUTOMATION_STORAGE_KEY}-${address.toLowerCase()}`;
}

function loadPrefsFromStorage(address: string): AutomationPreferences | null {
  try {
    const raw = localStorage.getItem(getStorageKey(address));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePrefsToStorage(address: string, prefs: AutomationPreferences) {
  try {
    localStorage.setItem(getStorageKey(address), JSON.stringify(prefs));
  } catch {}
}

function getDefaultPreferences(): AutomationPreferences {
  return {
    email: {
      enabled: false,
      address: "",
      frequency: "immediate",
      types: ["rebalance_alert", "urgent_action"],
    },
    zapier: { enabled: false, triggers: ["high_urgency", "critical_urgency"] },
    slack: { enabled: false, urgencyThreshold: "HIGH" },
    google: { enabled: false, gmailEnabled: false, sheetsEnabled: false },
    thresholds: { minSavings: 25, urgencyLevel: "MEDIUM" },
  };
}

interface AutomationPreferences {
  email: {
    enabled: boolean;
    address: string;
    frequency: "immediate" | "daily" | "weekly";
    types: ("rebalance_alert" | "urgent_action" | "weekly_summary")[];
  };
  zapier: {
    enabled: boolean;
    webhookUrl?: string;
    triggers: ("high_urgency" | "critical_urgency" | "all_recommendations")[];
  };
  auth0UserId?: string;
  auth0RefreshToken?: string;
  slack: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
    urgencyThreshold: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  };
  google: {
    enabled: boolean;
    gmailEnabled: boolean;
    sheetsEnabled: boolean;
    spreadsheetId?: string;
  };
  thresholds: {
    minSavings: number;
    urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  };
}

interface AutomationSettingsProps {
  config?: {
    riskTolerance: string;
    goal: string;
    timeHorizon: string;
    spendingLimit: number;
    voiceResponsesEnabled?: boolean;
    walletProvider?: "CIRCLE_MPC" | "TETHER_WDK";
  };
  onConfigChange?: (config: any) => void;
}

export default function AutomationSettings({
  config,
  onConfigChange,
}: AutomationSettingsProps) {
  const { address } = useWalletContext();
  const { user } = usePrivy();
  const stableUserId = user?.id || address;

  const {
    isEnabled: voiceEnabled,
    enable: enableVoice,
    disable: disableVoice,
  } = useVoiceEnabled();
  const { showToast } = useToast();
  const {
    visibility,
    origin,
    setVisibility,
  } = useGuardianVisibility();
  const [preferences, setPreferences] = useState<AutomationPreferences | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAutomation, setTestingAutomation] = useState(false);
  const [verifyingConnection, setVerifyingConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { status: 'healthy' | 'error' | 'none', message?: string }>>({});

  const loadPreferences = useCallback(async () => {
    if (!stableUserId) return;

    const localFallback = loadPrefsFromStorage(stableUserId) || getDefaultPreferences();
    setPreferences(localFallback);

    // Check for "connected" or "error" in URL
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const authError = urlParams.get('error');

    if (connected === 'true') {
      showToast("✅ Successfully connected to Auth0 Token Vault", "success");
      // Remove params from URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authError) {
      showToast(`❌ Connection failed: ${authError}`, "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const response = await fetch(
        `/api/agent/automation?userAddress=${encodeURIComponent(stableUserId)}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const nextPreferences = payload?.preferences || localFallback;
      setPreferences(nextPreferences);
      savePrefsToStorage(stableUserId, nextPreferences);
    } catch (error) {
      console.warn("Failed to load automation preferences from server:", error);
      setPreferences(localFallback);
    } finally {
      setLoading(false);
    }
  }, [stableUserId, showToast]);

  useEffect(() => {
    if (stableUserId) {
      loadPreferences();
      return;
    }

    setPreferences(getDefaultPreferences());
    setLoading(false);
  }, [stableUserId, loadPreferences]);

  const savePreferences = async () => {
    if (!preferences || !stableUserId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/agent/automation?userAddress=${encodeURIComponent(stableUserId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      savePrefsToStorage(stableUserId, preferences);
      showToast("✅ Automation preferences saved successfully", "success");
    } catch (error) {
      console.error("Failed to save automation preferences:", error);
      showToast("❌ Failed to save automation preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const testZapierIntegration = async () => {
    setTestingAutomation(true);
    try {
      const response = await fetch("/api/agent/test-zapier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zapier: preferences?.zapier,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast(
          `✅ Zapier MCP test successful! ${result.message}`,
          "success",
        );
      } else {
        showToast(`❌ Zapier MCP test failed: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Zapier test failed:", error);
      showToast("❌ Zapier test failed. Check console for details.", "error");
    } finally {
      setTestingAutomation(false);
    }
  };

  const updatePreferences = <K extends keyof AutomationPreferences>(
    section: K,
    updates: Partial<AutomationPreferences[K]>,
  ) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [section]: {
        ...(preferences[section] as object),
        ...(updates as object),
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Failed to load automation preferences</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="text-2xl">🔐</span>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            Connect a wallet to manage notifications
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            Notification and integration settings appear here once a wallet is connected.
          </p>
        </div>
      </div>
    );
  }

  const verifyConnection = async (connection: string) => {
    if (!stableUserId) return;
    setVerifyingConnection(connection);
    try {
      const response = await fetch("/api/agent/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: stableUserId,
          connection
        }),
      });

      const result = await response.json();
      if (result.success) {
        setConnectionStatus(prev => ({
          ...prev,
          [connection]: { status: 'healthy', message: result.message }
        }));
        showToast(`✅ ${connection} connection verified`, "success");
      } else {
        setConnectionStatus(prev => ({
          ...prev,
          [connection]: { status: 'error', message: result.error }
        }));
        showToast(`❌ ${connection} verification failed: ${result.error}`, "error");
      }
    } catch (error) {
      setConnectionStatus(prev => ({
        ...prev,
        [connection]: { status: 'error', message: 'Failed to reach verification endpoint' }
      }));
    } finally {
      setVerifyingConnection(null);
    }
  };

  const isSaveDisabled =
    saving ||
    (preferences.email.enabled && !preferences.email.address?.trim());

  return (
    <div className="space-y-6">
      {/* This sheet is preferences only — limits and pause live in
          Limits & controls. No status tiles, no raw identity strings. */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        How Guardian reaches you and which outside services it may use. Your
        daily limit and pause live in Limits &amp; controls.
      </p>

      {/* AI Strategy Core */}
      {config && onConfigChange && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-xl">
              <span className="text-xl">🔮</span>
            </div>
            <div>
                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">
                  How Guardian advises
                </h3>
              <p className="text-xs sm:text-xs text-gray-600 dark:text-gray-400">
                Configure how Guardian analyzes your wealth
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                PRIMARY GOAL
              </label>
              <select
                value={config.goal}
                onChange={(e) =>
                  onConfigChange({ ...config, goal: e.target.value })
                }
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option>Inflation Hedge</option>
                <option>Capital Preservation</option>
                <option>Aggressive Growth</option>
                <option>Regional Balance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                RISK TOLERANCE
              </label>
              <select
                value={config.riskTolerance}
                onChange={(e) =>
                  onConfigChange({ ...config, riskTolerance: e.target.value })
                }
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option>Conservative</option>
                <option>Balanced</option>
                <option>Aggressive</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              GUARDIAN&apos;S FEE WALLET
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() =>
                  onConfigChange({ ...config, walletProvider: "CIRCLE_MPC" })
                }
                className={`flex flex-col p-4 rounded-xl border-2 transition-colors text-left ${
                  config.walletProvider === "CIRCLE_MPC" ||
                  !config.walletProvider
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⛽</span>
                  <span className="font-black text-sm uppercase tracking-tight">
                    Circle Managed Wallet
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  Hands-off wallet that pays gas + evidence fees in USDC. Powered by
                  Circle Programmable Wallets.
                </p>
              </button>

              <button
                onClick={() =>
                  onConfigChange({ ...config, walletProvider: "TETHER_WDK" })
                }
                className={`flex flex-col p-4 rounded-xl border-2 transition-colors text-left ${
                  config.walletProvider === "TETHER_WDK"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🌌</span>
                  <span className="font-black text-sm uppercase tracking-tight">
                    Tether Settlement (WDK)
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  You hold the keys. Built-in USD₮ and gold (XAU₮) support across
                  Celo, Arbitrum, Polygon, Avalanche, and Tron.
                </p>
              </button>
            </div>
            <p className="mt-3 text-[10px] text-gray-400 italic">
              * Tether Settlement (WDK) adds gold-hedging and cross-chain reach.
            </p>
          </div>
        </motion.div>
      )}

      {/* Voice Input Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎤</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Voice Input
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ask questions using your microphone
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) =>
                e.target.checked ? enableVoice() : disableVoice()
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="pl-11 space-y-2">
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Tap once to start, tap again to stop (no hold required)</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Microphone released immediately when you stop</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>Audio processed on-device before sending</span>
          </div>
          {!voiceEnabled && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Voice is disabled.</span> Toggle
                above to re-enable voice input across the app.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {config && onConfigChange && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔊</span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Voice Responses
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Read Guardian messages aloud after they arrive
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(config.voiceResponsesEnabled)}
                onChange={(e) =>
                  onConfigChange({ ...config, voiceResponsesEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="pl-11 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Disabled by default so Guardian stays quiet unless you opt in.</p>
            <p>Applies to normal replies and proactive alerts.</p>
          </div>
        </motion.div>
      )}

      {/* Guardian Updates Visibility */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🛡️</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Guardian Updates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              How much of the Guardian's work the app shows you
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["quiet", "informed"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setVisibility(mode, "user")}
              aria-pressed={visibility === mode}
              className={`flex flex-col p-4 rounded-xl border-2 transition-colors text-left ${
                visibility === mode
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
              }`}
            >
              <span className="font-black text-sm uppercase tracking-tight">
                {mode === "quiet" ? "Quiet" : "Informed"}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-1">
                {mode === "quiet"
                  ? "Decisions stay behind Ask Guardian — surfaces stay minimal."
                  : "Attribution lines, activity counts, and cadence stats on Home and Shield."}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
          {origin === "persona"
            ? "Following your Simple/Advanced mode. Choose above to decide independently."
            : origin === "agent"
              ? "Set by Guardian from a conversation — change it back here anytime."
              : "Set manually here."}{" "}
          You can also just tell Guardian: "show me less" or "explain every change".
        </p>
      </motion.div>

      {/* Email Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Email Notifications
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get notified about important recommendations
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.email.enabled}
              onChange={(e) =>
                updatePreferences("email", { enabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {preferences.email.enabled && (
          <div className="space-y-4 pl-11">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={preferences.email.address}
                onChange={(e) =>
                  updatePreferences("email", { address: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notification Types
              </label>
              <div className="space-y-2">
                {[
                  {
                    key: "rebalance_alert",
                    label: "Rebalancing Alerts",
                    desc: "When AI recommends portfolio changes",
                  },
                  {
                    key: "urgent_action",
                    label: "Urgent Actions",
                    desc: "Critical wealth protection alerts",
                  },
                  {
                    key: "weekly_summary",
                    label: "Weekly Summary",
                    desc: "Portfolio performance and insights",
                  },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.email.types.includes(
                        key as
                          | "rebalance_alert"
                          | "urgent_action"
                          | "weekly_summary",
                      )}
                      onChange={(e) => {
                        const types = e.target.checked
                          ? [
                              ...preferences.email.types,
                              key as
                                | "rebalance_alert"
                                | "urgent_action"
                                | "weekly_summary",
                            ]
                          : preferences.email.types.filter((t) => t !== key);
                        updatePreferences("email", { types });
                      }}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {label}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Zapier Integration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Zapier Integration
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Trigger custom workflows and automations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!preferences.zapier.enabled && process.env.NEXT_PUBLIC_AUTH0_DOMAIN && (
              <a
                href={`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}&connection=zapier&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback')}&scope=openid%20profile%20email%20offline_access&access_type=offline&prompt=consent&state=${stableUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg transition-colors border border-orange-100 dark:border-orange-800"
              >
                CONNECT ZAPIER
              </a>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.zapier.enabled}
                onChange={(e) =>
                  updatePreferences("zapier", { enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {preferences.zapier.enabled && (
          <div className="space-y-4 pl-11">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-800 dark:text-green-300">
                  {preferences.auth0RefreshToken ? (
                    <>✅ <strong>Connected via Token Vault.</strong> Guardian has delegated access to your Zapier account.</>
                  ) : (
                    <>⚠️ <strong>Setup Required.</strong> Please use the CONNECT button above to authorize the agent.</>
                  )}
                </p>
                {preferences.auth0RefreshToken && (
                  <button
                    onClick={() => verifyConnection('zapier')}
                    disabled={verifyingConnection === 'zapier'}
                    className="text-[10px] font-black uppercase text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
                  >
                    {verifyingConnection === 'zapier' ? 'Verifying...' : 'Test Connection'}
                  </button>
                )}
              </div>
              {connectionStatus['zapier']?.status === 'error' && (
                <p className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">
                  Error: {connectionStatus['zapier'].message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL (Optional)
              </label>
              <input
                type="url"
                value={preferences.zapier.webhookUrl || ""}
                onChange={(e) =>
                  updatePreferences("zapier", { webhookUrl: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                If provided, Agent will trigger this webhook in addition to the Vault integration.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Google Integration (Gmail & Sheets) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Google Workspace
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect Gmail and Google Sheets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!preferences.google.enabled && process.env.NEXT_PUBLIC_AUTH0_DOMAIN && (
              <a
                href={`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}&connection=google-oauth2&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/callback')}&scope=openid%20profile%20email%20offline_access&access_type=offline&prompt=consent&state=${stableUserId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 dark:border-blue-800"
              >
                CONNECT GOOGLE
              </a>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.google.enabled}
                onChange={(e) =>
                  updatePreferences("google", { enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {preferences.google.enabled && (
          <div className="space-y-4 pl-11">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-800 dark:text-green-300">
                  {preferences.auth0RefreshToken ? (
                    <>✅ <strong>Connected via Token Vault.</strong> Guardian has delegated access to your Google account.</>
                  ) : (
                    <>⚠️ <strong>Setup Required.</strong> Please use the CONNECT button above to authorize the agent.</>
                  )}
                </p>
                {preferences.auth0RefreshToken && (
                  <button
                    onClick={() => verifyConnection('google-oauth2')}
                    disabled={verifyingConnection === 'google-oauth2'}
                    className="text-[10px] font-black uppercase text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
                  >
                    {verifyingConnection === 'google-oauth2' ? 'Verifying...' : 'Test Connection'}
                  </button>
                )}
              </div>
              {connectionStatus['google-oauth2']?.status === 'error' && (
                <p className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">
                  Error: {connectionStatus['google-oauth2'].message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.google.gmailEnabled}
                  onChange={(e) => updatePreferences("google", { gmailEnabled: e.target.checked })}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Gmail Integration</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Allow agent to send notifications via your Gmail</div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.google.sheetsEnabled}
                  onChange={(e) => updatePreferences("google", { sheetsEnabled: e.target.checked })}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Google Sheets Logging</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Append analysis results to a spreadsheet</div>
                </div>
              </label>

              {preferences.google.sheetsEnabled && (
                <div className="mt-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    SPREADSHEET ID
                  </label>
                  <input
                    type="text"
                    value={preferences.google.spreadsheetId || ""}
                    onChange={(e) => updatePreferences("google", { spreadsheetId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1aBcD...eFgH"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Thresholds */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Automation Thresholds
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Control when automations are triggered
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Expected Savings
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">
                $
              </span>
              <input
                type="number"
                value={preferences.thresholds.minSavings}
                onChange={(e) =>
                  updatePreferences("thresholds", {
                    minSavings: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                inputMode="decimal"
                min="0"
                step="5"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Only trigger automations for recommendations with at least this
              much expected savings
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Urgency Level
            </label>
            <select
              value={preferences.thresholds.urgencyLevel}
              onChange={(e) => {
                const value = e.target.value as
                  | "LOW"
                  | "MEDIUM"
                  | "HIGH"
                  | "CRITICAL";
                updatePreferences("thresholds", { urgencyLevel: value });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low - All recommendations</option>
              <option value="MEDIUM">Medium - Important changes</option>
              <option value="HIGH">High - Urgent actions</option>
              <option value="CRITICAL">Critical - Emergency only</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={savePreferences}
          disabled={isSaveDisabled}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>💾 Save Preferences</>
          )}
        </button>

        {preferences.zapier.enabled && (
          <button
            onClick={testZapierIntegration}
            disabled={
              testingAutomation || !preferences.zapier.webhookUrl?.trim()
            }
            className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testingAutomation ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Testing...
              </>
            ) : (
              <>⚡ Test Zapier MCP</>
            )}
          </button>
        )}
      </div>

    </div>
  );
}

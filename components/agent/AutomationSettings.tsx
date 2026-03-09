import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWalletContext } from '../wallet/WalletProvider';
import { useVoiceEnabled } from '../ui/VoiceButton';
import { useToast } from '../ui/Toast';

const isDev = process.env.NODE_ENV === 'development';

interface AutomationPreferences {
    email: {
        enabled: boolean;
        address: string;
        frequency: 'immediate' | 'daily' | 'weekly';
        types: ('rebalance_alert' | 'urgent_action' | 'weekly_summary')[];
    };
    zapier: {
        enabled: boolean;
        webhookUrl?: string;
        triggers: ('high_urgency' | 'critical_urgency' | 'all_recommendations')[];
    };
    slack: {
        enabled: boolean;
        webhookUrl?: string;
        channel?: string;
        urgencyThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
    thresholds: {
        minSavings: number;
        urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
}

interface AutomationSettingsProps {
    config?: {
        riskTolerance: string;
        goal: string;
        timeHorizon: string;
        spendingLimit: number;
    };
    onConfigChange?: (config: any) => void;
    autonomousStatus?: {
        enabled: boolean;
        isTestnet: boolean;
        walletType: string;
        spendingLimit: number;
        spent: number;
        remaining: number;
    } | null;
}

export default function AutomationSettings({ config, onConfigChange, autonomousStatus }: AutomationSettingsProps) {
    const { address } = useWalletContext();
    const { isEnabled: voiceEnabled, enable: enableVoice, disable: disableVoice } = useVoiceEnabled();
    const { showToast } = useToast();
    const [preferences, setPreferences] = useState<AutomationPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingAutomation, setTestingAutomation] = useState(false);

    const loadPreferences = useCallback(async () => {
        try {
            const response = await fetch(`/api/agent/automation?userAddress=${address}`);
            const data = await response.json();
            setPreferences(data.preferences);
        } catch (error) {
            console.error('Failed to load automation preferences:', error);
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (address) {
            loadPreferences();
        }
    }, [address, loadPreferences]);

    const savePreferences = async () => {
        if (!preferences || !address) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/agent/automation?userAddress=${address}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences)
            });

            if (response.ok) {
                showToast('✅ Automation preferences saved successfully', 'success');
            } else {
                throw new Error('Failed to save preferences');
            }
        } catch (error) {
            console.error('Failed to save automation preferences:', error);
            showToast('❌ Failed to save automation preferences', 'error');
        } finally {
            setSaving(false);
        }
    };

    const testZapierIntegration = async () => {
        setTestingAutomation(true);
        try {
            const response = await fetch('/api/agent/test-zapier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (result.success) {
                showToast(`✅ Zapier MCP test successful! ${result.message}`, 'success');
            } else {
                showToast(`❌ Zapier MCP test failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Zapier test failed:', error);
            showToast('❌ Zapier test failed. Check console for details.', 'error');
        } finally {
            setTestingAutomation(false);
        }
    };

    const updatePreferences = (section: keyof AutomationPreferences, updates: Partial<AutomationPreferences[keyof AutomationPreferences]>) => {
        if (!preferences) return;

        setPreferences({
            ...preferences,
            [section]: {
                ...preferences[section],
                ...updates
            }
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

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
            <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">🤖 Agent Command Center</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monitor and control your AI wealth protection agents</p>
            </div>

            {/* Autonomous Guardian Wallet (if enabled) */}
            {autonomousStatus?.enabled && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-800 p-5 sm:p-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🛡️</span>
                            <div>
                                <h3 className="font-black text-purple-900 dark:text-purple-100 uppercase tracking-tight text-sm">Guardian Autonomous Wallet</h3>
                                <p className="text-xs sm:text-xs text-purple-700 dark:text-purple-300">Agent pays for its own data access via x402 protocol</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-xs font-black uppercase text-purple-400">STATUS</div>
                             <div className="text-xs font-black text-green-600">ACTIVE</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50">
                             <div className="text-xs text-gray-400 font-black uppercase tracking-wider">WALLET TYPE</div>
                             <div className="text-xs font-black text-gray-700 dark:text-gray-200">{autonomousStatus.walletType.toUpperCase()}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50">
                             <div className="text-xs text-gray-400 font-black uppercase tracking-wider">DAILY LIMIT</div>
                             <div className="text-xs font-black text-gray-700 dark:text-gray-200">${autonomousStatus.spendingLimit.toFixed(2)}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50">
                             <div className="text-xs text-gray-400 font-black uppercase tracking-wider">SPENT TODAY</div>
                             <div className="text-xs font-black text-purple-600 dark:text-purple-400">${autonomousStatus.spent.toFixed(4)}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-purple-100 dark:border-purple-900/50">
                             <div className="text-xs text-gray-400 font-black uppercase tracking-wider">REMAINING</div>
                             <div className="text-xs font-black text-green-600 dark:text-green-400">${autonomousStatus.remaining.toFixed(4)}</div>
                        </div>
                    </div>
                </motion.div>
            )}

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
                            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">AI Strategy Core</h3>
                            <p className="text-xs sm:text-xs text-gray-600 dark:text-gray-400">Configure how the Oracle analyzes your wealth</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">PRIMARY GOAL</label>
                            <select 
                                value={config.goal}
                                onChange={(e) => onConfigChange({...config, goal: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option>Inflation Hedge</option>
                                <option>Capital Preservation</option>
                                <option>Aggressive Growth</option>
                                <option>Regional Balance</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">RISK TOLERANCE</label>
                            <select 
                                value={config.riskTolerance}
                                onChange={(e) => onConfigChange({...config, riskTolerance: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            >
                                <option>Conservative</option>
                                <option>Balanced</option>
                                <option>Aggressive</option>
                            </select>
                        </div>
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
                            <h3 className="font-semibold text-gray-900 dark:text-white">Voice Input</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Ask questions using your microphone</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={voiceEnabled}
                            onChange={(e) => e.target.checked ? enableVoice() : disableVoice()}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                                <span className="font-medium">Voice is disabled.</span> Toggle above to re-enable voice input across the app.
                            </p>
                        </div>
                    )}
                </div>
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
                            <h3 className="font-semibold text-gray-900 dark:text-white">Email Notifications</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about important recommendations</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.email.enabled}
                            onChange={(e) => updatePreferences('email', { enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {preferences.email.enabled && (
                    <div className="space-y-4 pl-11">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                value={preferences.email.address}
                                onChange={(e) => updatePreferences('email', { address: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="your@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notification Types</label>
                            <div className="space-y-2">
                                {[
                                    { key: 'rebalance_alert', label: 'Rebalancing Alerts', desc: 'When AI recommends portfolio changes' },
                                    { key: 'urgent_action', label: 'Urgent Actions', desc: 'Critical wealth protection alerts' },
                                    { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Portfolio performance and insights' }
                                ].map(({ key, label, desc }) => (
                                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences.email.types.includes(key as 'rebalance_alert' | 'urgent_action' | 'weekly_summary')}
                                            onChange={(e) => {
                                                const types = e.target.checked
                                                    ? [...preferences.email.types, key as 'rebalance_alert' | 'urgent_action' | 'weekly_summary']
                                                    : preferences.email.types.filter(t => t !== key);
                                                updatePreferences('email', { types });
                                            }}
                                            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">{label}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{desc}</div>
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
                            <h3 className="font-semibold text-gray-900 dark:text-white">Zapier Integration</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Trigger custom workflows and automations</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.zapier.enabled}
                            onChange={(e) => updatePreferences('zapier', { enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {preferences.zapier.enabled && (
                    <div className="space-y-4 pl-11">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook URL</label>
                            <input
                                type="url"
                                value={preferences.zapier.webhookUrl || ''}
                                onChange={(e) => updatePreferences('zapier', { webhookUrl: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://hooks.zapier.com/hooks/catch/..."
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Create a webhook trigger in Zapier and paste the URL here
                            </p>
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
                        <h3 className="font-semibold text-gray-900 dark:text-white">Automation Thresholds</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Control when automations are triggered</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Expected Savings
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                            <input
                                type="number"
                                value={preferences.thresholds.minSavings}
                                onChange={(e) => updatePreferences('thresholds', { minSavings: parseInt(e.target.value) || 0 })}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                step="5"
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Only trigger automations for recommendations with at least this much expected savings
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Urgency Level
                        </label>
                        <select
                            value={preferences.thresholds.urgencyLevel}
                            onChange={(e) => {
                                const value = e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
                                updatePreferences('thresholds', { urgencyLevel: value });
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
                    disabled={saving}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            💾 Save Preferences
                        </>
                    )}
                </button>

                <button
                    onClick={testZapierIntegration}
                    disabled={testingAutomation}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {testingAutomation ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Testing...
                        </>
                    ) : (
                        <>
                            ⚡ Test Zapier MCP
                        </>
                    )}
                </button>

            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <span className="text-blue-600 text-xl">💡</span>
                    <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">How It Works</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            Your AI agent analyzes your portfolio continuously and triggers automations when it detects
                            wealth protection opportunities that meet your configured thresholds.
                            {isDev && ' All analysis costs are paid autonomously by the agent using x402 micropayments on Arc Network.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
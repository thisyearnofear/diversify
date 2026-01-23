import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWalletContext } from './WalletProvider';

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

export default function AutomationSettings() {
    const { address } = useWalletContext();
    const [preferences, setPreferences] = useState<AutomationPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingAutomation, setTestingAutomation] = useState(false);

    useEffect(() => {
        if (address) {
            loadPreferences();
        }
    }, [address]);

    const loadPreferences = async () => {
        try {
            const response = await fetch(`/api/agent/automation?userAddress=${address}`);
            const data = await response.json();
            setPreferences(data.preferences);
        } catch (error) {
            console.error('Failed to load automation preferences:', error);
        } finally {
            setLoading(false);
        }
    };

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
                console.log('Automation preferences saved successfully');
            } else {
                throw new Error('Failed to save preferences');
            }
        } catch (error) {
            console.error('Failed to save automation preferences:', error);
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
                alert(`✅ Zapier MCP test successful!\n\n${result.message}\n\nNext steps:\n${result.nextSteps.join('\n')}`);
            } else {
                alert(`❌ Zapier MCP test failed:\n\n${result.error}\n\nTroubleshooting:\n${result.troubleshooting?.join('\n') || 'Check console for details'}`);
            }
        } catch (error) {
            console.error('Zapier test failed:', error);
            alert('❌ Zapier test failed. Check console for details.');
        } finally {
            setTestingAutomation(false);
        }
    };

    const updatePreferences = (section: keyof AutomationPreferences, updates: any) => {
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
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">🤖 AI Agent Automation</h2>
                <p className="text-gray-600">Configure how your AI agent notifies you about wealth protection opportunities</p>
            </div>

            {/* Email Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📧</span>
                        <div>
                            <h3 className="font-semibold text-gray-900">Email Notifications</h3>
                            <p className="text-sm text-gray-600">Get notified about important recommendations</p>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                value={preferences.email.address}
                                onChange={(e) => updatePreferences('email', { address: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="your@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Notification Types</label>
                            <div className="space-y-2">
                                {[
                                    { key: 'rebalance_alert', label: 'Rebalancing Alerts', desc: 'When AI recommends portfolio changes' },
                                    { key: 'urgent_action', label: 'Urgent Actions', desc: 'Critical wealth protection alerts' },
                                    { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Portfolio performance and insights' }
                                ].map(({ key, label, desc }) => (
                                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences.email.types.includes(key as any)}
                                            onChange={(e) => {
                                                const types = e.target.checked
                                                    ? [...preferences.email.types, key as any]
                                                    : preferences.email.types.filter(t => t !== key);
                                                updatePreferences('email', { types });
                                            }}
                                            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">{label}</div>
                                            <div className="text-sm text-gray-600">{desc}</div>
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
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <h3 className="font-semibold text-gray-900">Zapier Integration</h3>
                            <p className="text-sm text-gray-600">Trigger custom workflows and automations</p>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                            <input
                                type="url"
                                value={preferences.zapier.webhookUrl || ''}
                                onChange={(e) => updatePreferences('zapier', { webhookUrl: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://hooks.zapier.com/hooks/catch/..."
                            />
                            <p className="text-xs text-gray-500 mt-1">
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
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🎯</span>
                    <div>
                        <h3 className="font-semibold text-gray-900">Automation Thresholds</h3>
                        <p className="text-sm text-gray-600">Control when automations are triggered</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Expected Savings
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                                type="number"
                                value={preferences.thresholds.minSavings}
                                onChange={(e) => updatePreferences('thresholds', { minSavings: parseInt(e.target.value) || 0 })}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                step="5"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Only trigger automations for recommendations with at least this much expected savings
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Urgency Level
                        </label>
                        <select
                            value={preferences.thresholds.urgencyLevel}
                            onChange={(e) => updatePreferences('thresholds', { urgencyLevel: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <button
                    onClick={() => {/* Keep old test for email */ }}
                    disabled={testingAutomation || !preferences.email.enabled}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {testingAutomation ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Testing...
                        </>
                    ) : (
                        <>
                            📧 Test Email
                        </>
                    )}
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <span className="text-blue-600 text-xl">💡</span>
                    <div>
                        <h4 className="font-medium text-blue-900 mb-1">How It Works</h4>
                        <p className="text-sm text-blue-800">
                            Your AI agent analyzes your portfolio continuously and triggers automations when it detects
                            wealth protection opportunities that meet your configured thresholds. All analysis costs are
                            paid autonomously by the agent using x402 micropayments on Arc Network.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
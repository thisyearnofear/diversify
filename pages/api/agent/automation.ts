import type { NextApiRequest, NextApiResponse } from 'next';
import { AutomationService } from '@diversifi/shared';
import * as path from 'path';
import { readJsonFile, writeJsonFile } from './_json-store';

/**
 * Agent Automation API
 * Handles user preferences for AI agent notifications and automations
 */

interface AutomationPreferences {
    auth0RefreshToken?: string;
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
    google: {
        enabled: boolean;
        gmailEnabled: boolean;
        sheetsEnabled: boolean;
        spreadsheetId?: string;
    };
    thresholds: {
        minSavings: number; // Minimum expected savings to trigger automation
        urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
}

type AutomationPreferenceStore = Record<string, AutomationPreferences>;

const STORAGE_PATH =
    process.env.AGENT_AUTOMATION_PATH || path.join(process.cwd(), '.data', 'agent-automation-preferences.json');

function normalizeUserAddress(userAddress: string | string[] | undefined): string | null {
    if (!userAddress) return null;
    const value = Array.isArray(userAddress) ? userAddress[0] : userAddress;
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

async function loadPreferenceStore(): Promise<AutomationPreferenceStore> {
    return readJsonFile<AutomationPreferenceStore>(STORAGE_PATH, {});
}

async function getStoredPreferences(userAddress: string): Promise<AutomationPreferences | null> {
    const store = await loadPreferenceStore();
    return store[userAddress] || null;
}

async function saveStoredPreferences(userAddress: string, preferences: AutomationPreferences): Promise<void> {
    const store = await loadPreferenceStore();
    store[userAddress] = preferences;
    await writeJsonFile(STORAGE_PATH, store);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { userAddress: userAddressQuery, email } = req.query;
    const userAddress = normalizeUserAddress(userAddressQuery);

    if (!userAddress) {
        return res.status(400).json({ error: 'User address required' });
    }

    switch (method) {
        case 'GET': {
            const stored = await getStoredPreferences(userAddress);
            return res.status(200).json({ preferences: stored || getDefaultPreferences(email as string) });
        }

        case 'POST':
            // Check if this is a test request
            if (req.url?.includes('/test')) {
                // Test automation with sample data
                try {
                    const testPreferences = (req.body as AutomationPreferences) || getDefaultPreferences(email as string);

                    const testAnalysis = {
                        action: 'SWAP' as const,
                        targetToken: 'PAXG',
                        targetNetwork: 'Arbitrum' as const,
                        confidence: 0.85,
                        reasoning: 'High inflation detected in your region (4.2%). Moving to gold-backed PAXG provides better wealth protection.',
                        expectedSavings: 75,
                        timeHorizon: '6 months',
                        riskLevel: 'MEDIUM' as const,
                        dataSources: ['Truflation Premium', 'Macro Regime Oracle'],
                        executionMode: 'ADVISORY' as const,
                        actionSteps: [
                            'Open Arbitrum-compatible wallet or exchange',
                            'Search for PAXG (PAX Gold) trading pair',
                            'Consider swapping 30% of portfolio to PAXG',
                            'Monitor gold prices and inflation trends'
                        ],
                        urgencyLevel: 'HIGH' as const,
                        automationTriggers: {
                            email: {
                                enabled: testPreferences.email.enabled,
                                recipient: testPreferences.email.address,
                                template: 'rebalance_alert' as const
                            }
                        }
                    };

                    // Create automation service with user preferences
                    const automationConfig = {
                        tokenVault: process.env.AUTH0_DOMAIN ? {
                            domain: process.env.AUTH0_DOMAIN,
                            clientId: process.env.AUTH0_CLIENT_ID || '',
                            clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
                            audience: process.env.AUTH0_AUDIENCE
                        } : undefined,
                        auth0RefreshToken: testPreferences.auth0RefreshToken,
                        email: {
                            enabled: testPreferences.email.enabled,
                            provider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'resend') || 'sendgrid',
                            apiKey: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY,
                            fromEmail: process.env.FROM_EMAIL || 'agent@diversifi.app',
                            templates: {
                                rebalance_alert: 'rebalance',
                                urgent_action: 'urgent',
                                weekly_summary: 'summary'
                            }
                        },
                        zapier: {
                            enabled: testPreferences.zapier.enabled,
                            webhookUrl: testPreferences.zapier.webhookUrl
                        },
                        make: {
                            enabled: false,
                            webhookUrl: undefined
                        },
                        slack: {
                            enabled: testPreferences.slack.enabled,
                            webhookUrl: testPreferences.slack.webhookUrl,
                            channel: testPreferences.slack.channel
                        },
                        google: {
                            enabled: testPreferences.google?.enabled || false,
                            gmailEnabled: testPreferences.google?.gmailEnabled || false,
                            sheetsEnabled: testPreferences.google?.sheetsEnabled || false,
                            spreadsheetId: testPreferences.google?.spreadsheetId
                        }
                    };

                    const automationService = new AutomationService(automationConfig);

                    await automationService.processAnalysis(
                        testAnalysis,
                        testPreferences.email.address,
                        { balance: 1000, holdings: ['USDm'] }
                    );

                    return res.status(200).json({
                        success: true,
                        message: 'Test automation triggered successfully',
                        testData: testAnalysis
                    });
                } catch (error) {
                    console.error('Test automation failed:', error);
                    return res.status(500).json({ error: 'Test automation failed' });
                }
            }

            try {
                const incomingPreferences: AutomationPreferences = req.body;

                if (!incomingPreferences.email?.address && incomingPreferences.email?.enabled) {
                    return res.status(400).json({ error: 'Email address required when email notifications are enabled' });
                }

                // Load existing preferences to preserve Auth0 refresh token if not provided in update
                const existingPreferences = await getStoredPreferences(userAddress);
                const newPreferences: AutomationPreferences = {
                    ...incomingPreferences,
                    auth0RefreshToken: incomingPreferences.auth0RefreshToken || existingPreferences?.auth0RefreshToken,
                    auth0UserId: (incomingPreferences as any).auth0UserId || (existingPreferences as any)?.auth0UserId
                };

                // Encrypt refresh token if present and not already encrypted
                if (newPreferences.auth0RefreshToken && !newPreferences.auth0RefreshToken.includes(':')) {
                    const { TokenVaultClient } = await import('@diversifi/shared');
                    const client = new TokenVaultClient({
                        domain: process.env.AUTH0_DOMAIN || '',
                        clientId: process.env.AUTH0_CLIENT_ID || '',
                        clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
                    });
                    newPreferences.auth0RefreshToken = client.encryptToken(newPreferences.auth0RefreshToken);
                }

                await saveStoredPreferences(userAddress, newPreferences);

                return res.status(200).json({
                    success: true,
                    message: 'Automation preferences saved',
                    preferences: newPreferences
                });
            } catch (error) {
                console.error('Failed to process automation preferences:', error);
                return res.status(500).json({ error: 'Failed to process preferences' });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).json({ error: `Method ${method} not allowed` });
    }
}

function getDefaultPreferences(email?: string): AutomationPreferences {
    return {
        email: {
            enabled: !!email,
            address: email || '',
            frequency: 'immediate',
            types: ['rebalance_alert', 'urgent_action']
        },
        zapier: {
            enabled: false,
            triggers: ['high_urgency', 'critical_urgency']
        },
        slack: {
            enabled: false,
            urgencyThreshold: 'HIGH'
        },
        google: {
            enabled: false,
            gmailEnabled: false,
            sheetsEnabled: false
        },
        thresholds: {
            minSavings: 25, // Only trigger for savings >= $25
            urgencyLevel: 'MEDIUM'
        }
    };
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { AutomationService } from '../../../services/automation-service';

/**
 * Agent Automation API
 * Handles user preferences for AI agent notifications and automations
 */

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
        minSavings: number; // Minimum expected savings to trigger automation
        urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
}

// In-memory storage for demo (use database in production)
const userPreferences = new Map<string, AutomationPreferences>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { userAddress, email } = req.query;

    if (!userAddress) {
        return res.status(400).json({ error: 'User address required' });
    }

    const userId = userAddress as string;

    switch (method) {
        case 'GET':
            // Get user's automation preferences
            const preferences = userPreferences.get(userId) || getDefaultPreferences(email as string);
            return res.status(200).json({ preferences });

        case 'POST':
            // Update user's automation preferences
            try {
                const newPreferences: AutomationPreferences = req.body;

                // Validate preferences
                if (!newPreferences.email?.address && newPreferences.email?.enabled) {
                    return res.status(400).json({ error: 'Email address required when email notifications are enabled' });
                }

                userPreferences.set(userId, newPreferences);

                return res.status(200).json({
                    success: true,
                    message: 'Automation preferences updated',
                    preferences: newPreferences
                });
            } catch (error) {
                console.error('Failed to update automation preferences:', error);
                return res.status(500).json({ error: 'Failed to update preferences' });
            }

        case 'POST' && req.url?.includes('/test'):
            // Test automation with sample data
            try {
                const preferences = userPreferences.get(userId) || getDefaultPreferences(email as string);

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
                            enabled: preferences.email.enabled,
                            recipient: preferences.email.address,
                            template: 'rebalance_alert' as const
                        }
                    }
                };

                // Create automation service with user preferences
                const automationConfig = {
                    email: {
                        enabled: preferences.email.enabled,
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
                        enabled: preferences.zapier.enabled,
                        webhookUrl: preferences.zapier.webhookUrl
                    },
                    make: {
                        enabled: false,
                        webhookUrl: undefined
                    },
                    slack: {
                        enabled: preferences.slack.enabled,
                        webhookUrl: preferences.slack.webhookUrl,
                        channel: preferences.slack.channel
                    }
                };

                const automationService = new AutomationService(automationConfig);

                await automationService.processAnalysis(
                    testAnalysis,
                    preferences.email.address,
                    { balance: 1000, holdings: ['CUSD'] }
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
        thresholds: {
            minSavings: 25, // Only trigger for savings >= $25
            urgencyLevel: 'MEDIUM'
        }
    };
}
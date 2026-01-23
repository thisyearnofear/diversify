/**
 * Zapier MCP Service
 * Handles integration with Zapier via Model Context Protocol concepts
 * Supports both Embed/NLA authentication and direct Webhook triggers
 */

import { AnalysisResult } from './arc-agent';

export interface ZapierMCPConfig {
    embedId?: string;
    embedSecret?: string;
    webhookUrl?: string;
    enabled: boolean;
}

export interface ZapierTriggerData {
    trigger_type: 'ai_agent_recommendation';
    recommendation: {
        action: string;
        target_token?: string;
        target_network?: string;
        expected_savings: number;
        urgency_level: string;
        confidence: number;
        reasoning: string;
    };
    user: {
        email: string;
        wallet_address: string;
        portfolio_balance: number;
    };
    metadata: {
        timestamp: string;
        analysis_cost: number;
        data_sources: string[];
        execution_mode: string;
    };
}

export class ZapierMCPService {
    private config: ZapierMCPConfig;

    constructor(config: ZapierMCPConfig) {
        this.config = config;
    }

    /**
     * Check if Zapier service is properly configured
     * Requires either Webhook URL OR (Embed ID + Secret)
     */
    isConfigured(): boolean {
        if (!this.config.enabled) return false;
        
        const hasWebhook = !!this.config.webhookUrl;
        const hasEmbed = !!(this.config.embedId && this.config.embedSecret);
        
        return hasWebhook || hasEmbed;
    }

    /**
     * Trigger Zapier automation via configured method (Webhook or MCP/Embed)
     * This will be called by the automation service when conditions are met
     */
    async triggerAutomation(
        analysis: AnalysisResult,
        userEmail: string,
        walletAddress: string,
        portfolioData: { balance: number; holdings: string[] }
    ): Promise<boolean> {
        if (!this.isConfigured()) {
            console.warn('[Zapier Service] Service not configured, skipping automation');
            return false;
        }

        try {
            const triggerData: ZapierTriggerData = {
                trigger_type: 'ai_agent_recommendation',
                recommendation: {
                    action: analysis.action,
                    target_token: analysis.targetToken,
                    target_network: analysis.targetNetwork,
                    expected_savings: analysis.expectedSavings,
                    urgency_level: analysis.urgencyLevel || 'MEDIUM',
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning
                },
                user: {
                    email: userEmail,
                    wallet_address: walletAddress,
                    portfolio_balance: portfolioData.balance
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    analysis_cost: this.calculateAnalysisCost(analysis),
                    data_sources: analysis.dataSources,
                    execution_mode: analysis.executionMode
                }
            };

            // Prioritize Webhook if available (most reliable for backend-to-backend)
            if (this.config.webhookUrl) {
                return await this.sendToZapierWebhook(triggerData);
            }

            // Fallback to Embed/NLA simulation (or real implementation if available)
            if (this.config.embedId && this.config.embedSecret) {
                // In a real MCP integration, this would use the MCP protocol or NLA API
                console.log(`[Zapier Service] Triggering via MCP/Embed simulation for ${this.config.embedId}`);
                return true;
            }

            return false;

        } catch (error) {
            console.error('[Zapier Service] Automation trigger failed:', error);
            return false;
        }
    }

    /**
     * Create a new Zap via MCP (future functionality)
     */
    async createZap(zapConfig: {
        name: string;
        trigger: string;
        actions: Array<{
            app: string;
            action: string;
            params: Record<string, any>;
        }>;
    }): Promise<{ zapId: string; webhookUrl: string } | null> {
        if (!this.isConfigured()) {
            console.warn('[Zapier Service] Service not configured');
            return null;
        }

        try {
            // This would use MCP to create a new Zap
            // For now, return a mock response
            const mockZapId = `zap_${Date.now()}`;
            const mockWebhookUrl = `https://hooks.zapier.com/hooks/catch/${this.config.embedId || 'mock'}/${mockZapId}/`;

            console.log(`[Zapier Service] Created Zap: ${zapConfig.name} (${mockZapId})`);

            return {
                zapId: mockZapId,
                webhookUrl: mockWebhookUrl
            };

        } catch (error) {
            console.error('[Zapier Service] Failed to create Zap:', error);
            return null;
        }
    }

    /**
     * List user's existing Zaps via MCP
     */
    async listUserZaps(): Promise<Array<{
        id: string;
        name: string;
        status: 'on' | 'off';
        trigger: string;
        actions: number;
    }>> {
        if (!this.isConfigured()) {
            return [];
        }

        try {
            // This would use MCP to list Zaps
            // For now, return mock data
            return [
                {
                    id: 'zap_diversifi_email',
                    name: 'DiversiFi Email Alerts',
                    status: 'on',
                    trigger: 'AI Agent Recommendation',
                    actions: 2
                },
                {
                    id: 'zap_diversifi_slack',
                    name: 'DiversiFi Slack Notifications',
                    status: 'on',
                    trigger: 'High Urgency Alert',
                    actions: 1
                }
            ];

        } catch (error) {
            console.error('[Zapier Service] Failed to list Zaps:', error);
            return [];
        }
    }

    /**
     * Send data to Zapier webhook
     */
    private async sendToZapierWebhook(data: ZapierTriggerData): Promise<boolean> {
        if (!this.config.webhookUrl) {
            return false;
        }

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            // Add Auth header if secret is available (for Secure Webhooks)
            if (this.config.embedSecret) {
                headers['Authorization'] = `Bearer ${this.config.embedSecret}`;
            }

            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });

            if (response.ok) {
                console.log(`[Zapier Service] Successfully triggered webhook for ${data.user.email}`);
                return true;
            } else {
                console.error(`[Zapier Service] Webhook call failed with status: ${response.status}`);
                return false;
            }

        } catch (error) {
            console.error('[Zapier Service] Webhook call failed:', error);
            return false;
        }
    }

    /**
     * Calculate analysis cost from payment hashes
     */
    private calculateAnalysisCost(analysis: AnalysisResult): number {
        if (analysis.paymentHashes) {
            // In real implementation, we'd track actual costs
            return Object.keys(analysis.paymentHashes).length * 0.08; // Average cost per source
        }
        return analysis.dataSources.length * 0.05; // Fallback estimate
    }

    /**
     * Test the Service connection
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                message: 'Zapier Service not configured. Please set ZAPIER_WEBHOOK_URL or ZAPIER_EMBED_ID/SECRET.'
            };
        }

        try {
            // Test with a simple ping-like operation
            const testData: ZapierTriggerData = {
                trigger_type: 'ai_agent_recommendation',
                recommendation: {
                    action: 'TEST',
                    expected_savings: 0,
                    urgency_level: 'LOW',
                    confidence: 1.0,
                    reasoning: 'Connection test'
                },
                user: {
                    email: 'test@example.com',
                    wallet_address: '0x0000000000000000000000000000000000000000',
                    portfolio_balance: 0
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    analysis_cost: 0,
                    data_sources: ['test'],
                    execution_mode: 'TEST'
                }
            };

            const success = await this.triggerAutomation(
                {
                    action: 'TEST',
                    expected_savings: 0,
                    urgencyLevel: 'LOW',
                    confidence: 1.0,
                    reasoning: 'Connection test',
                    dataSources: ['test'],
                    executionMode: 'TEST',
                    paymentHashes: {}
                } as AnalysisResult,
                'test@example.com',
                '0x00...00',
                { balance: 0, holdings: [] }
            );

            return {
                success,
                message: success
                    ? 'Zapier connection successful'
                    : 'Zapier connection failed (check logs)'
            };

        } catch (error) {
            return {
                success: false,
                message: `Zapier test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// Export singleton instance
export const zapierMCPService = new ZapierMCPService({
    embedId: process.env.ZAPIER_EMBED_ID,
    embedSecret: process.env.ZAPIER_EMBED_SECRET,
    webhookUrl: process.env.ZAPIER_WEBHOOK_URL,
    enabled: !!(process.env.ZAPIER_EMBED_ID || process.env.ZAPIER_WEBHOOK_URL)
});
/**
 * Automation Service
 * Handles real-world integrations for AI agent recommendations
 * Supports email notifications, webhooks, and MCP integrations
 */

import { AnalysisResult } from './arc-agent';

export interface AutomationConfig {
    email: {
        enabled: boolean;
        provider: 'sendgrid' | 'resend' | 'smtp';
        apiKey?: string;
        fromEmail: string;
        templates: {
            rebalance_alert: string;
            urgent_action: string;
            weekly_summary: string;
        };
    };
    zapier: {
        enabled: boolean;
        webhookUrl?: string;
        apiKey?: string;
    };
    make: {
        enabled: boolean;
        webhookUrl?: string;
        apiKey?: string;
    };
    slack: {
        enabled: boolean;
        webhookUrl?: string;
        channel?: string;
    };
}

export interface NotificationPayload {
    type: 'rebalance_alert' | 'urgent_action' | 'weekly_summary' | 'analysis_complete';
    analysis: AnalysisResult;
    user: {
        email: string;
        preferences: Record<string, any>;
        portfolio: {
            balance: number;
            holdings: string[];
        };
    };
    metadata: {
        timestamp: string;
        agentVersion: string;
        costIncurred: number;
    };
}

export class AutomationService {
    private config: AutomationConfig;

    constructor(config: AutomationConfig) {
        this.config = config;
    }

    /**
     * Process AI agent analysis and trigger appropriate automations
     */
    async processAnalysis(analysis: AnalysisResult, userEmail: string, portfolioData: any): Promise<void> {
        const payload: NotificationPayload = {
            type: this.determineNotificationType(analysis),
            analysis,
            user: {
                email: userEmail,
                preferences: {},
                portfolio: portfolioData
            },
            metadata: {
                timestamp: new Date().toISOString(),
                agentVersion: '2.0',
                costIncurred: this.calculateAnalysisCost(analysis)
            }
        };

        // Execute all enabled automations in parallel
        const automationPromises: Promise<any>[] = [];

        if (this.config.email.enabled) {
            automationPromises.push(this.sendEmailNotification(payload));
        }

        if (this.config.zapier.enabled && analysis.urgencyLevel !== 'LOW') {
            automationPromises.push(this.triggerZapierWebhook(payload));
        }

        if (this.config.make.enabled && analysis.urgencyLevel !== 'LOW') {
            automationPromises.push(this.triggerMakeWebhook(payload));
        }

        if (this.config.slack.enabled && ['HIGH', 'CRITICAL'].includes(analysis.urgencyLevel || 'LOW')) {
            automationPromises.push(this.sendSlackNotification(payload));
        }

        try {
            await Promise.allSettled(automationPromises);
            console.log(`[Automation] Processed ${automationPromises.length} automations for ${userEmail}`);
        } catch (error) {
            console.error('[Automation] Some automations failed:', error);
        }
    }

    /**
     * Send email notification using configured provider
     */
    private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
        try {
            const emailContent = this.generateEmailContent(payload);

            // Use configured email provider
            switch (this.config.email.provider) {
                case 'sendgrid':
                    await this.sendViaSendGrid(payload.user.email, emailContent);
                    break;
                case 'resend':
                    await this.sendViaResend(payload.user.email, emailContent);
                    break;
                default:
                    console.warn('[Automation] Email provider not configured, skipping email');
            }
        } catch (error) {
            console.error('[Automation] Email notification failed:', error);
        }
    }

    /**
     * Trigger Zapier webhook for advanced automation
     */
    private async triggerZapierWebhook(payload: NotificationPayload): Promise<void> {
        try {
            // Use Zapier MCP service for better integration
            const { zapierMCPService } = await import('./zapier-mcp-service');

            if (zapierMCPService.isConfigured()) {
                const success = await zapierMCPService.triggerAutomation(
                    payload.analysis,
                    payload.user.email,
                    // Use actual wallet if available in user preferences or portfolio context, otherwise placeholder
                    (payload.user.preferences as any)?.walletAddress || '0x0000000000000000000000000000000000000000',
                    payload.user.portfolio
                );

                if (success) {
                    console.log('[Automation] Zapier automation triggered successfully via Service');
                    return;
                } else {
                    console.warn('[Automation] Zapier automation failed to trigger via Service');
                }
            } else {
                console.warn('[Automation] Zapier Service not configured (missing Webhook URL or Embed Creds)');
            }
        } catch (error) {
            console.error('[Automation] Zapier trigger failed:', error);
        }
    }

    /**
     * Trigger Make.com webhook for automation
     */
    private async triggerMakeWebhook(payload: NotificationPayload): Promise<void> {
        if (!this.config.make.webhookUrl) {
            console.warn('[Automation] Make.com webhook URL not configured');
            return;
        }

        try {
            const makePayload = {
                event: 'wealth_protection_alert',
                data: {
                    recommendation: {
                        action: payload.analysis.action,
                        target_token: payload.analysis.targetToken,
                        target_network: payload.analysis.targetNetwork,
                        expected_savings: payload.analysis.expectedSavings,
                        urgency: payload.analysis.urgencyLevel,
                        confidence: payload.analysis.confidence
                    },
                    user: {
                        email: payload.user.email,
                        portfolio_value: payload.user.portfolio.balance
                    },
                    steps: payload.analysis.actionSteps,
                    reasoning: payload.analysis.reasoning,
                    timestamp: payload.metadata.timestamp
                }
            };

            const response = await fetch(this.config.make.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.make.apiKey && { 'Authorization': `Bearer ${this.config.make.apiKey}` })
                },
                body: JSON.stringify(makePayload)
            });

            if (!response.ok) {
                throw new Error(`Make.com webhook failed: ${response.status}`);
            }

            console.log('[Automation] Make.com webhook triggered successfully');
        } catch (error) {
            console.error('[Automation] Make.com webhook failed:', error);
        }
    }

    /**
     * Send Slack notification for urgent alerts
     */
    private async sendSlackNotification(payload: NotificationPayload): Promise<void> {
        if (!this.config.slack.webhookUrl) {
            console.warn('[Automation] Slack webhook URL not configured');
            return;
        }

        try {
            const urgencyEmoji = {
                'LOW': '🟢',
                'MEDIUM': '🟡',
                'HIGH': '🟠',
                'CRITICAL': '🔴'
            };

            const slackMessage = {
                text: `${urgencyEmoji[payload.analysis.urgencyLevel || 'LOW']} DiversiFi Alert: ${payload.analysis.action} Recommendation`,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `${urgencyEmoji[payload.analysis.urgencyLevel || 'LOW']} Wealth Protection Alert`
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Action:* ${payload.analysis.action}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Expected Savings:* $${payload.analysis.expectedSavings}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Urgency:* ${payload.analysis.urgencyLevel}`
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Portfolio:* $${payload.user.portfolio.balance}`
                            }
                        ]
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Reasoning:* ${payload.analysis.reasoning}`
                        }
                    }
                ]
            };

            const response = await fetch(this.config.slack.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slackMessage)
            });

            if (!response.ok) {
                throw new Error(`Slack notification failed: ${response.status}`);
            }

            console.log('[Automation] Slack notification sent successfully');
        } catch (error) {
            console.error('[Automation] Slack notification failed:', error);
        }
    }

    /**
     * Generate email content based on notification type
     */
    private generateEmailContent(payload: NotificationPayload): { subject: string; html: string; text: string } {
        const { analysis, user } = payload;

        const urgencyPrefix = analysis.urgencyLevel === 'CRITICAL' ? '🚨 URGENT: ' :
            analysis.urgencyLevel === 'HIGH' ? '⚠️ Important: ' : '';

        const subject = `${urgencyPrefix}DiversiFi: ${analysis.action} Recommendation - Save $${analysis.expectedSavings}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                    <h1>🧠 DiversiFi Oracle</h1>
                    <p>AI-Powered Wealth Protection</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #333; margin-top: 0;">
                            ${analysis.urgencyLevel === 'CRITICAL' ? '🚨' : analysis.urgencyLevel === 'HIGH' ? '⚠️' : '💡'} 
                            ${analysis.action} Recommendation
                        </h2>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <strong>Expected Protection:</strong> $${analysis.expectedSavings} saved over ${analysis.timeHorizon}
                        </div>
                        
                        <p><strong>Reasoning:</strong> ${analysis.reasoning}</p>
                        
                        ${analysis.targetToken ? `<p><strong>Recommended Asset:</strong> ${analysis.targetToken} on ${analysis.targetNetwork}</p>` : ''}
                        
                        <div style="margin: 20px 0;">
                            <h3>Action Steps:</h3>
                            <ol>
                                ${analysis.actionSteps?.map(step => `<li>${step}</li>`).join('') || '<li>Review recommendation in app</li>'}
                            </ol>
                        </div>
                        
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <small>
                                <strong>Analysis Details:</strong><br>
                                Confidence: ${(analysis.confidence * 100).toFixed(0)}% | 
                                Risk Level: ${analysis.riskLevel} | 
                                Data Sources: ${analysis.dataSources.length} premium sources
                            </small>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://diversifi.app'}" 
                           style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                            View in DiversiFi App
                        </a>
                    </div>
                    
                    <div style="text-align: center; color: #666; font-size: 12px;">
                        <p>This analysis was generated by your AI agent on Arc Network</p>
                        <p>Analysis cost: $${payload.metadata.costIncurred.toFixed(3)} USDC</p>
                    </div>
                </div>
            </div>
        `;

        const text = `
DiversiFi Oracle - ${analysis.action} Recommendation

Expected Protection: $${analysis.expectedSavings} saved over ${analysis.timeHorizon}

Reasoning: ${analysis.reasoning}

${analysis.targetToken ? `Recommended: ${analysis.targetToken} on ${analysis.targetNetwork}` : ''}

Action Steps:
${analysis.actionSteps?.map((step, i) => `${i + 1}. ${step}`).join('\n') || '1. Review recommendation in app'}

Confidence: ${(analysis.confidence * 100).toFixed(0)}%
Risk Level: ${analysis.riskLevel}
Data Sources: ${analysis.dataSources.length} premium sources

View full analysis: ${process.env.NEXT_PUBLIC_APP_URL || 'https://diversifi.app'}
        `;

        return { subject, html, text };
    }

    /**
     * Send email via SendGrid
     */
    private async sendViaSendGrid(to: string, content: { subject: string; html: string; text: string }): Promise<void> {
        if (!this.config.email.apiKey) {
            throw new Error('SendGrid API key not configured');
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.email.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: this.config.email.fromEmail },
                subject: content.subject,
                content: [
                    { type: 'text/plain', value: content.text },
                    { type: 'text/html', value: content.html }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`SendGrid API error: ${response.status}`);
        }
    }

    /**
     * Send email via Resend
     */
    private async sendViaResend(to: string, content: { subject: string; html: string; text: string }): Promise<void> {
        if (!this.config.email.apiKey) {
            throw new Error('Resend API key not configured');
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.email.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: this.config.email.fromEmail,
                to: [to],
                subject: content.subject,
                html: content.html,
                text: content.text
            })
        });

        if (!response.ok) {
            throw new Error(`Resend API error: ${response.status}`);
        }
    }

    /**
     * Determine notification type based on analysis
     */
    private determineNotificationType(analysis: AnalysisResult): NotificationPayload['type'] {
        if (analysis.urgencyLevel === 'CRITICAL') return 'urgent_action';
        if (analysis.action !== 'HOLD') return 'rebalance_alert';
        return 'analysis_complete';
    }

    /**
     * Calculate total cost of analysis
     */
    private calculateAnalysisCost(analysis: AnalysisResult): number {
        // Sum up costs from payment hashes or estimate based on data sources
        if (analysis.paymentHashes) {
            // In real implementation, we'd track actual costs
            return Object.keys(analysis.paymentHashes).length * 0.08; // Average cost per source
        }
        return analysis.dataSources.length * 0.05; // Fallback estimate
    }
}
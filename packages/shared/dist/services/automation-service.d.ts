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
export declare class AutomationService {
    private config;
    constructor(config: AutomationConfig);
    /**
     * Process AI agent analysis and trigger appropriate automations
     */
    processAnalysis(analysis: AnalysisResult, userEmail: string, portfolioData: any): Promise<void>;
    /**
     * Send email notification using configured provider
     */
    private sendEmailNotification;
    /**
     * Trigger Zapier webhook for advanced automation
     */
    private triggerZapierWebhook;
    /**
     * Trigger Make.com webhook for automation
     */
    private triggerMakeWebhook;
    /**
     * Send Slack notification for urgent alerts
     */
    private sendSlackNotification;
    /**
     * Generate email content based on notification type
     */
    private generateEmailContent;
    /**
     * Send email via SendGrid
     */
    private sendViaSendGrid;
    /**
     * Send email via Resend
     */
    private sendViaResend;
    /**
     * Determine notification type based on analysis
     */
    private determineNotificationType;
    /**
     * Calculate total cost of analysis
     */
    private calculateAnalysisCost;
}
//# sourceMappingURL=automation-service.d.ts.map
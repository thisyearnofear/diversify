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
export declare class ZapierMCPService {
    private config;
    constructor(config: ZapierMCPConfig);
    /**
     * Check if Zapier service is properly configured
     * Requires either Webhook URL OR (Embed ID + Secret)
     */
    isConfigured(): boolean;
    /**
     * Trigger Zapier automation via configured method (Webhook or MCP/Embed)
     * This will be called by the automation service when conditions are met
     */
    triggerAutomation(analysis: AnalysisResult, userEmail: string, walletAddress: string, portfolioData: {
        balance: number;
        holdings: string[];
    }): Promise<boolean>;
    /**
     * Create a new Zap via MCP (future functionality)
     */
    createZap(zapConfig: {
        name: string;
        trigger: string;
        actions: Array<{
            app: string;
            action: string;
            params: Record<string, any>;
        }>;
    }): Promise<{
        zapId: string;
        webhookUrl: string;
    } | null>;
    /**
     * List user's existing Zaps via MCP
     */
    listUserZaps(): Promise<Array<{
        id: string;
        name: string;
        status: 'on' | 'off';
        trigger: string;
        actions: number;
    }>>;
    /**
     * Send data to Zapier webhook
     */
    private sendToZapierWebhook;
    /**
     * Calculate analysis cost from payment hashes
     */
    private calculateAnalysisCost;
    /**
     * Test the Service connection
     */
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const zapierMCPService: ZapierMCPService;
//# sourceMappingURL=zapier-mcp-service.d.ts.map
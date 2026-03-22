import type { NextApiRequest, NextApiResponse } from 'next';
import { zapierMCPService, ZapierMCPService } from '@diversifi/shared';

/**
 * Test Zapier MCP Integration
 * Endpoint to test the Zapier MCP connection and trigger a sample automation
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { zapier: userZapierConfig } = req.body;

        // Use custom instance if user provided webhookUrl, otherwise fallback to global
        let serviceToUse = zapierMCPService;
        
        if (userZapierConfig?.webhookUrl || userZapierConfig?.embedId) {
            serviceToUse = new ZapierMCPService({
                embedId: userZapierConfig.embedId || process.env.ZAPIER_EMBED_ID,
                embedSecret: userZapierConfig.embedSecret || process.env.ZAPIER_EMBED_SECRET,
                webhookUrl: userZapierConfig.webhookUrl || process.env.ZAPIER_WEBHOOK_URL,
                enabled: true
            });
        }

        // Test the MCP connection first
        const connectionTest = await serviceToUse.testConnection();

        if (!connectionTest.success) {
            return res.status(400).json({
                success: false,
                error: connectionTest.message,
                configuration: {
                    embedId: !!process.env.ZAPIER_EMBED_ID,
                    embedSecret: !!process.env.ZAPIER_EMBED_SECRET,
                    webhookUrl: !!(userZapierConfig?.webhookUrl || process.env.ZAPIER_WEBHOOK_URL)
                }
            });
        }

        // If connection test passes, execute a genuine agent run to test the entire pipeline safely
        const { ArcAgent } = await import('@diversifi/shared');
        const agent = new ArcAgent({ 
            userId: 'test-zapier@agent.user',
            spendingLimit: 0 // Pass a zero spending limit to strictly prevent live execution side-effects
        });

        const realAnalysis = await agent.analyzePortfolioAutonomously(
            { balance: 1000, holdings: ['USDC'] }, 
            userZapierConfig || {}, 
            { chainId: 11142220, name: 'Celo Sepolia' } // Contextual testnet targeting
        );

        const automationSuccess = await serviceToUse.triggerAutomation(
            realAnalysis,
            'test@example.com',
            '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
            { balance: 1000, holdings: ['USDm'] }
        );

        // Get user's Zaps for additional info
        const userZaps = await serviceToUse.listUserZaps();

        return res.status(200).json({
            success: true,
            message: 'Zapier MCP test completed successfully',
            results: {
                connectionTest: connectionTest.success,
                automationTrigger: automationSuccess,
                userZaps: userZaps.length,
                testData: realAnalysis
            },
            configuration: {
                embedId: process.env.ZAPIER_EMBED_ID?.substring(0, 8) + '...',
                embedSecretConfigured: !!process.env.ZAPIER_EMBED_SECRET,
                webhookUrlConfigured: !!process.env.ZAPIER_WEBHOOK_URL,
                mcpServerEnabled: true
            },
            nextSteps: [
                'Check your Zapier dashboard for triggered Zaps',
                'Verify email notifications if configured',
                'Monitor webhook logs for successful triggers'
            ]
        });

    } catch (error) {
        console.error('Zapier MCP test failed:', error);

        return res.status(500).json({
            success: false,
            error: 'Zapier MCP test failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            troubleshooting: [
                'Verify ZAPIER_WEBHOOK_URL is set for direct integration',
                'Verify ZAPIER_EMBED_ID and ZAPIER_EMBED_SECRET are set for NLA',
                'Check that MCP server is running (uvx zapier-mcp-server@latest)',
                'Ensure Zapier embed is properly configured'
            ]
        });
    }
}
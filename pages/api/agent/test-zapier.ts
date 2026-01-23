import type { NextApiRequest, NextApiResponse } from 'next';
import { zapierMCPService } from '../../../services/zapier-mcp-service';

/**
 * Test Zapier MCP Integration
 * Endpoint to test the Zapier MCP connection and trigger a sample automation
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Test the MCP connection first
        const connectionTest = await zapierMCPService.testConnection();

        if (!connectionTest.success) {
            return res.status(400).json({
                success: false,
                error: connectionTest.message,
                configuration: {
                    embedId: !!process.env.ZAPIER_EMBED_ID,
                    embedSecret: !!process.env.ZAPIER_EMBED_SECRET,
                    webhookUrl: !!process.env.ZAPIER_WEBHOOK_URL
                }
            });
        }

        // If connection test passes, try a real automation trigger
        const testAnalysis = {
            action: 'SWAP' as const,
            targetToken: 'PAXG',
            targetNetwork: 'Arbitrum' as const,
            confidence: 0.85,
            reasoning: 'Test automation: High inflation detected. Moving to gold-backed PAXG provides better wealth protection.',
            expectedSavings: 50,
            timeHorizon: '6 months',
            riskLevel: 'MEDIUM' as const,
            dataSources: ['Truflation Premium', 'Macro Regime Oracle'],
            executionMode: 'ADVISORY' as const,
            actionSteps: [
                'Open Arbitrum-compatible wallet',
                'Search for PAXG trading pair',
                'Consider swapping 20% of portfolio',
                'Monitor gold prices'
            ],
            urgencyLevel: 'HIGH' as const
        };

        const automationSuccess = await zapierMCPService.triggerAutomation(
            testAnalysis,
            'test@example.com',
            '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
            { balance: 1000, holdings: ['CUSD'] }
        );

        // Get user's Zaps for additional info
        const userZaps = await zapierMCPService.listUserZaps();

        return res.status(200).json({
            success: true,
            message: 'Zapier MCP test completed successfully',
            results: {
                connectionTest: connectionTest.success,
                automationTrigger: automationSuccess,
                userZaps: userZaps.length,
                testData: testAnalysis
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
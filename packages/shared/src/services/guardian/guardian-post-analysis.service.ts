import type { AnalysisResult, AgentWalletProvider } from '../arc-agent';
import { utils } from 'ethers';

export class GuardianPostAnalysisService {
  static async recordAnalysisOnChain(params: {
    ensureInitialized: () => Promise<void>;
    wallet: AgentWalletProvider;
    agentAddress: string;
    analysis: Partial<AnalysisResult>;
  }): Promise<string> {
    await params.ensureInitialized();
    const analysisHash = utils.keccak256(
      utils.toUtf8Bytes(JSON.stringify(params.analysis))
    );

    console.log(`[Arc Agent] Recording analysis hash on-chain: ${analysisHash}`);
    const tx = await params.wallet.sendTransaction({
      to: params.agentAddress,
      value: 0,
      data: analysisHash
    });

    const receipt = await tx.wait ? await tx.wait() : tx;
    return receipt.transactionHash || tx.hash;
  }

  static async triggerAutomations(params: {
    analysis: AnalysisResult;
    userPreferences: any;
    portfolioData: any;
    userId?: string;
  }): Promise<void> {
    try {
      const { AutomationService } = await import('../automation-service');

      const userEmail = params.userId || 'anonymous@agent.user';
      const automationConfig = {
        tokenVault: process.env.AUTH0_DOMAIN ? {
          domain: process.env.AUTH0_DOMAIN,
          clientId: process.env.AUTH0_CLIENT_ID || '',
          clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
          audience: process.env.AUTH0_AUDIENCE
        } : undefined,
        email: {
          enabled: true,
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
          enabled: !!(params.userPreferences?.zapier?.webhookUrl || process.env.ZAPIER_WEBHOOK_URL),
          webhookUrl: params.userPreferences?.zapier?.webhookUrl || process.env.ZAPIER_WEBHOOK_URL
        },
        make: {
          enabled: !!process.env.MAKE_WEBHOOK_URL,
          webhookUrl: process.env.MAKE_WEBHOOK_URL
        },
        slack: {
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#diversifi-alerts'
        },
        google: {
          enabled: !!params.userPreferences?.google?.enabled,
          gmailEnabled: !!params.userPreferences?.google?.gmailEnabled,
          sheetsEnabled: !!params.userPreferences?.google?.sheetsEnabled,
          spreadsheetId: params.userPreferences?.google?.spreadsheetId
        }
      };

      const automationService = new AutomationService(automationConfig);
      await automationService.processAnalysis(params.analysis, userEmail, params.portfolioData);
      console.log(`[Arc Agent] Automations triggered for ${userEmail} (ID: ${params.userId || 'anonymous'})`);
    } catch (error) {
      console.error('[Arc Agent] Automation trigger failed:', error);
    }
  }
}

# 🔗 Zapier Integration Setup Guide

## Overview
DiversiFi Oracle integrates with Zapier via Model Context Protocol (MCP) to trigger custom automations when your AI agent detects wealth protection opportunities.

## 🔑 Required Credentials

You have been provided with:
- **Embed ID**: `060b059bca0e327d297b17197d9e2400`
- **Embed Secret**:

⚠️ **Security Warning**: Treat the embed secret like a password. Never share it publicly.

## 🚀 Quick Setup

### 1. Environment Configuration
Add these to your `.env.local` file:

```bash
# Zapier MCP Integration
ZAPIER_EMBED_ID=060b059bca0e327d297b17197d9e2400
ZAPIER_EMBED_SECRET

# Optional: Direct webhook for fallback
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your_webhook_id/
```

### 2. Install MCP Server
The MCP server is automatically configured in `.kiro/settings/mcp.json`. To test it manually:

```bash
# Install Zapier MCP server
uvx zapier-mcp-server@latest

# Test connection
curl -X POST http://localhost:3001/api/agent/test-zapier
```

### 3. Test Integration
1. Go to Automation Settings in the DiversiFi app
2. Click "Test Zapier MCP" button
3. Check the response for success/failure details

## 🔧 Zapier Workflow Setup

### Recommended Zaps

#### 1. Email Alerts for High-Priority Recommendations
**Trigger**: AI Agent Recommendation (via webhook)
**Actions**:
- Send email with recommendation details
- Add to Google Sheets for tracking
- Create calendar reminder to review

#### 2. Slack Notifications for Critical Alerts
**Trigger**: AI Agent Recommendation (urgency = CRITICAL)
**Actions**:
- Send Slack message to #finance channel
- Create Notion page with analysis details

#### 3. Portfolio Tracking Automation
**Trigger**: AI Agent Recommendation (action = SWAP)
**Actions**:
- Log to Airtable portfolio tracker
- Send SMS via Twilio for urgent actions
- Update personal finance dashboard

### Sample Webhook Data
When your AI agent triggers an automation, Zapier receives:

```json
{
  "trigger_type": "ai_agent_recommendation",
  "recommendation": {
    "action": "SWAP",
    "target_token": "PAXG",
    "target_network": "Arbitrum",
    "expected_savings": 75,
    "urgency_level": "HIGH",
    "confidence": 0.85,
    "reasoning": "High inflation detected. Moving to gold-backed PAXG provides better wealth protection."
  },
  "user": {
    "email": "user@example.com",
    "wallet_address": "0x...",
    "portfolio_balance": 1000
  },
  "metadata": {
    "timestamp": "2025-01-23T10:30:00Z",
    "analysis_cost": 0.43,
    "data_sources": ["Truflation Premium", "Macro Regime Oracle"],
    "execution_mode": "ADVISORY"
  }
}
```

## 🎯 Automation Triggers

Your AI agent will trigger Zapier automations when:

1. **High/Critical Urgency**: Expected savings > $50
2. **Specific Actions**: SWAP, BRIDGE recommendations
3. **Risk Thresholds**: When portfolio risk exceeds user tolerance
4. **Market Events**: Significant inflation or economic changes detected

## 🛠 Troubleshooting

### Common Issues

#### "Zapier MCP not configured"
- Verify `ZAPIER_EMBED_ID` and `ZAPIER_EMBED_SECRET` are set
- Check `.env.local` file exists and is properly formatted
- Restart your development server

#### "MCP server not responding"
- Install MCP server: `uvx zapier-mcp-server@latest`
- Check MCP configuration in `.kiro/settings/mcp.json`
- Verify network connectivity

#### "Webhook not triggering"
- Test with `/api/agent/test-zapier` endpoint
- Check Zapier webhook URL is correct
- Verify embed secret authentication

### Debug Steps

1. **Test MCP Connection**:
   ```bash
   curl -X POST http://localhost:3001/api/agent/test-zapier
   ```

2. **Check Environment Variables**:
   ```bash
   echo $ZAPIER_EMBED_ID
   echo $ZAPIER_EMBED_SECRET
   ```

3. **Verify MCP Server**:
   ```bash
   ps aux | grep zapier-mcp-server
   ```

## 📊 Monitoring & Analytics

### Zapier Dashboard
- Monitor Zap execution history
- Check success/failure rates
- View webhook payload details

### DiversiFi Analytics
- Track automation trigger frequency
- Monitor user engagement with recommendations
- Measure cost vs. value of automations

## 🔐 Security Best Practices

1. **Embed Secret Protection**:
   - Never commit to version control
   - Use environment variables only
   - Rotate if compromised

2. **Webhook Security**:
   - Use HTTPS endpoints only
   - Validate webhook signatures
   - Implement rate limiting

3. **Data Privacy**:
   - Only send necessary user data
   - Anonymize sensitive information
   - Comply with privacy regulations

## 🚀 Advanced Usage

### Custom Zap Creation
Use the MCP service to programmatically create Zaps:

```typescript
import { zapierMCPService } from './services/zapier-mcp-service';

const newZap = await zapierMCPService.createZap({
  name: 'DiversiFi Portfolio Alerts',
  trigger: 'ai_agent_recommendation',
  actions: [
    {
      app: 'gmail',
      action: 'send_email',
      params: {
        to: 'user@example.com',
        subject: 'Portfolio Alert: {{recommendation.action}}',
        body: '{{recommendation.reasoning}}'
      }
    }
  ]
});
```

### Multi-User Management
Scale automations across multiple users:

```typescript
// Trigger automations for all users with high-urgency recommendations
const users = await getUsersWithHighUrgencyRecommendations();
for (const user of users) {
  await zapierMCPService.triggerAutomation(
    user.analysis,
    user.email,
    user.walletAddress,
    user.portfolio
  );
}
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Test with the `/api/agent/test-zapier` endpoint
3. Review Zapier webhook logs
4. Contact support with error details and configuration

## 🎉 Success Indicators

Your integration is working correctly when:

- ✅ Test endpoint returns `success: true`
- ✅ Zapier receives webhook data
- ✅ Zaps execute successfully
- ✅ Users receive notifications
- ✅ Analytics show automation engagement

Happy automating! 🤖✨
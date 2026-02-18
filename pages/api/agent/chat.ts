import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../services/ai/ai-service';
import { isTestnetChain, NETWORKS } from '../../../config';

/**
 * Chat API Endpoint
 * 
 * Enables conversational follow-up questions about portfolio analysis.
 * Uses AIService for multi-provider failover (Venice → Gemini).
 */

const SYSTEM_PROMPT = `You are DiversiFi - an AI agent helping users protect themselves from inflation, earn yield on real-world assets, and gain exposure to global and regional stablecoins.

WHAT DIVERSIFI ENABLES:
1. **Inflation Protection** - Move savings into diversified stablecoins and RWAs that preserve purchasing power
2. **Yield Generation** - Earn returns on tokenized real-world assets (USDY ~5%, SYRUPUSDC ~4.5%, PAXG gold-backed)
3. **Global Exposure** - Access regional stablecoins (USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm) across multiple currencies
4. **Test Drive** - Try the full experience with demo mode (no wallet required)
5. **Daily UBI** - Earn $G GoodDollar universal basic income just for using the platform
6. **Frontier Tech** - Experience cutting-edge features including Robinhood's marquee stock tokenization (TSLA, AMZN on testnet)

CORE CAPABILITIES:
- Guide users through wallet setup (email, existing wallet, or "Buy Crypto" fiat onramp)
- Explain cross-chain bridging between Celo (low fees, regional stables) and Arbitrum (RWAs, yield)
- Recommend portfolio strategies based on user's region and goals
- Help users understand risks and trade-offs

WALLET OPTIONS:
1. **"Buy Crypto"** - Easiest: buy with card/bank, no existing wallet needed
2. **"I Have a Wallet"** - Connect MetaMask, Coinbase Wallet, Rainbow, etc.
3. **"Create with Email"** - Easiest for beginners: just email, no seed phrases to manage

KEY FEATURES TO MENTION:
- **Demo Mode**: Try with sample data, no risk
- **Voice Commands**: Speak to interact
- **Multi-chain**: Celo + Arbitrum
- **Fiat On/Off Ramps**: Guardarian, Mt Pelerin
- **Experience Modes**: Simple, Standard, Advanced
- **Cultural Strategies**: Africapitalism, Buen Vivir, Confucian, Islamic Finance

AVAILABLE ASSETS:
- **Celo (Mento stables)**: USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC
- **Arbitrum (RWAs)**: USDY (5% Treasury yield), PAXG (gold-backed), SYRUPUSDC (4.5% DeFi yield), USDC, EURC
- **Testnet Stocks**: TSLA, AMZN (Robinhood Orbit testnet)

RESPONSE GUIDELINES:
- Introduce yourself as DiversiFi, the inflation protection and yield platform
- Be conversational, welcoming, and empowering
- For "What is this?" → Explain we protect savings from inflation via diversified stablecoins + RWAs
- For "How do I start?" → Guide to wallet options or demo mode
- For "Is this safe?" → Explain non-custodial security (we never hold keys)
- Mention the $G GoodDollar UBI as a unique benefit
- Be concise (2-3 sentences) unless detail requested
- Use specific numbers (yields, percentages) when available
- If unsure, say so rather than guessing

TONE: Friendly, knowledgeable guide who makes DeFi accessible to everyone—from first-time users to experienced crypto natives.`;

// Test Drive Context Generator
function getTestDriveContext(chainId?: number): string {
  if (!chainId) return "";

  if (!isTestnetChain(chainId)) return "";

  let chainSpecifics = "";
  if (chainId === NETWORKS.RH_TESTNET.chainId) {
    chainSpecifics = "- ROBINHOOD TESTNET: You are running on the Robinhood Arbitrum Orbit chain. 'Stocks' (TSLA, AMZN) are currently simulated for the hackathon context. Encourage users to 'buy' them to test the flow.";
  } else if (chainId === NETWORKS.ARC_TESTNET.chainId) {
    chainSpecifics = "- ARC TESTNET: You are on Arc's high-performance testnet. Encourage users to test swap speeds vs Celo.";
  } else if (chainId === NETWORKS.ALFAJORES.chainId) {
    chainSpecifics = "- CELO ALFAJORES: You are on Celo's testnet. Mento stablecoins (cUSD, cEUR) are fully functional here.";
  }

  return `
TEST DRIVE MODE ACTIVE:
The user is currently in 'Test Drive' mode on a testnet chain (Chain ID: ${chainId}).
- Emphasize that assets are "play money" and valid for testing only.
- G$ UBI is SIMULATED on non-Celo chains to demonstrate the reward loop without bridging headaches.
${chainSpecifics}
- Encouraging Tone: "Go ahead and break things! Try swapping max amounts to see what happens."
`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], chainId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Dynamic system prompt based on context
    const contextPrompt = SYSTEM_PROMPT + getTestDriveContext(chainId);

    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: contextPrompt },
    ];

    // Add conversation history (limit to last 10 messages for context window)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const result = await AIService.chat({
      messages,
      temperature: 0.7,
      maxTokens: 500,
    });

    return res.status(200).json({
      response: result.content,
      provider: result.provider,
      type: 'text',
    });
  } catch (error: unknown) {
    console.error('[Chat API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Chat failed';
    
    // Check if it's an AI provider error
    if (errorMessage.includes('All AI providers failed')) {
        return res.status(503).json({ 
            error: 'AI service temporarily unavailable. Please try again in a moment.',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
    }
    
    return res.status(500).json({ 
        error: 'Unable to process your request. Please try again.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}

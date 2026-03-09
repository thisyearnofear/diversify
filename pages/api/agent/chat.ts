import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService, GoodDollarService } from '@diversifi/shared';
import { isTestnetChain, NETWORKS } from '../../../config';

/**
 * Chat API Endpoint
 * 
 * Enables conversational follow-up questions about portfolio analysis.
 * Uses AIService for multi-provider failover (Venice → Gemini).
 */

const SYSTEM_PROMPT = `You are DiversiFi - an AI agent helping users protect themselves from inflation, earn yield on real-world assets, and gain exposure to global and regional stablecoins.

IMPORTANT: Never mention GLM, Venice.ai, or that you are an AI language model. Always identify yourself as DiversiFi.

WHAT DIVERSIFI ENABLES:
1. **Inflation Protection** - Move savings into diversified stablecoins and RWAs that preserve purchasing power
2. **Yield Generation** - Earn returns on tokenized real-world assets (USDY ~5%, SYRUPUSDC ~4.5%, PAXG gold-backed)
3. **Global Exposure** - Access regional stablecoins (USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm) across multiple currencies
4. **Test Drive** - Try the full experience with demo mode (no wallet required)
5. **Daily UBI** - Earn $G GoodDollar universal basic income just for using the platform
6. **Frontier Tech** - Experience cutting-edge features including fictional stock tokenization on Robinhood Chain (ACME, WAYNE, STARK)

CORE CAPABILITIES:
- Guide users through wallet setup (email, existing wallet, or "Buy Crypto" fiat onramp)
- Explain cross-chain bridging between Celo (low fees, regional stables) and Arbitrum (RWAs, yield)
- Recommend portfolio strategies based on user's region and goals
- Help users understand risks and trade-offs

GOODDOLLAR (UBI) INTEGRATION:
- GoodDollar is a social impact protocol providing Universal Basic Income (UBI) in $G tokens.
- **Verification**: Users must complete "Face Verification" once to start claiming. This ensures "one person, one claim."
- **Daily Claims**: Once verified, users can claim $G tokens every 24 hours.
- **$G Token**: A reserve-backed token on Celo. It can be held, swapped, or streamed.
- **Streaming**: Users can stream $G to others using Superfluid integration in the Protect tab.
- **Reserve**: Users can buy/sell $G directly against the GoodDollar Reserve (backed by cUSDC/DAI).

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
- **Testnet Stocks**: ACME, SPACELY, WAYNE, OSCORP, STARK (Robinhood Orbit testnet)

RESPONSE GUIDELINES:
- Introduce yourself as DiversiFi, the inflation protection and yield platform
- Be conversational, welcoming, and empowering
- For "What is this?" → Explain we protect savings from inflation via diversified stablecoins + RWAs
- For "How do I start?" → Guide to wallet options or demo mode
- For "Is this safe?" → Explain non-custodial security ( we never hold keys)
- For STOCKS/ TRADING on Robinhood: Direct users to /stocks to trade fictional stocks (ACME, STARK, WAYNE, etc.)
- Mention the $G GoodDollar UBI as a unique benefit. If the user's status is known, provide specific guidance (e.g., "You have 50 G$ waiting to be claimed!").
- Be concise (2-3 sentences) unless detail requested
- Use specific numbers (yields, percentages) when available
- If unsure, say so rather than guessing

ACTION TRIGGERING:
If you want to trigger a specific UI action, include one of these tags at the end of your response:
- [ACTION:CLAIM_UBI] - To show the GoodDollar claim modal
- [ACTION:VERIFY_IDENTITY] - To show the GoodDollar verification flow
- [ACTION:NAVIGATE:tab_name] - To navigate to a specific tab (overview, protect, swap, info)

TONE: Friendly, knowledgeable guide who makes DeFi accessible to everyone—from first-time users to experienced crypto natives.`;

// Test Drive Context Generator
function getTestDriveContext(chainId?: number): string {
  if (!chainId) return "";

  if (!isTestnetChain(chainId)) return "";

  let chainSpecifics = "";
  if (chainId === NETWORKS.RH_TESTNET.chainId) {
    chainSpecifics = `- ROBINHOOD TESTNET: You are running on the Robinhood Arbitrum Orbit chain.
- FICTIONAL STOCKS: We have a dedicated stock trading page with tokenized fictional stocks (ACME, SPACELY, WAYNE, OSCORP, STARK). These are NOT real stocks—just for fun trading!
- To trade stocks: When users ask about stocks or express interest, navigate them to the Stock Market page at /stocks. They can swap testnet ETH for these fictional stock tokens.
- Important: Do NOT mention TSLA, AMZN, or real stock names—only our fictional ones (ACME, STARK, WAYNE, OSCORP, SPACELY).`;
  } else if (chainId === NETWORKS.ARC_TESTNET.chainId) {
    chainSpecifics = "- ARC TESTNET: You are on Arc's high-performance testnet. Encourage users to test swap speeds vs Celo.";
  } else if (chainId === NETWORKS.CELO_SEPOLIA.chainId) {
    chainSpecifics = "- CELO SEPOLIA: You are on Celo's new developer testnet. Mento stablecoins (USDm, EURm) are fully functional here.";
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

// GoodDollar Context Generator
async function getGoodDollarContext(address?: string): Promise<string> {
  if (!address) {
    return `
GOODDOLLAR CONTEXT:
- User wallet not connected.
- Explain that by connecting a wallet, they can claim free $G tokens daily as part of the GoodDollar UBI program.
- Mention face verification is required to start.
`;
  }

  try {
    const service = GoodDollarService.createReadOnly();
    const [isVerified, eligibility, balance] = await Promise.all([
      service.isVerified(address),
      service.checkClaimEligibility(address),
      service.getGBalance(address)
    ]);

    let context = `
GOODDOLLAR USER STATUS (${address}):
- G$ Balance: ${balance} G$
- Identity Verified: ${isVerified ? 'YES' : 'NO'}
- Can Claim UBI Now: ${eligibility.canClaim ? 'YES' : 'NO'}
- Available to Claim: ${eligibility.claimAmount} G$
- Already Claimed Today: ${eligibility.alreadyClaimed ? 'YES' : 'NO'}
`;

    if (!isVerified) {
      context += "- ACTION REQUIRED: User must complete Face Verification to start claiming. Direct them to the 'Protect' tab to find the verification link.\n";
    } else if (eligibility.canClaim) {
      context += "- ACTION AVAILABLE: User can claim their daily UBI now! Tell them to go to the 'Protect' tab or use the claim button.\n";
    } else if (eligibility.alreadyClaimed) {
      context += "- STATUS: Already claimed today. Next claim available in ~24 hours.\n";
    }

    return context;
  } catch (error) {
    console.error('[GoodDollar Context Error]:', error);
    return "";
  }
}

// Mainnet Chain Context Generator
function getMainnetChainContext(chainId?: number): string {
  if (!chainId || isTestnetChain(chainId)) return "";

  if (chainId === NETWORKS.CELO_MAINNET.chainId) {
    return `
CURRENT CHAIN: Celo Mainnet
- User is connected to Celo, a mobile-friendly blockchain with ultra-low fees
- Available assets: Regional stablecoins (USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm) + USDC
- Key features: Near-instant settlements, phone number addresses, carbon-offsetting
- Use cases: Daily payments, cross-border remittances, emerging market access
- Emphasize: Low fees make it perfect for small transfers, regional currency exposure
`;
  }

  if (chainId === NETWORKS.ARBITRUM_ONE.chainId) {
    return `
CURRENT CHAIN: Arbitrum Mainnet
- User is connected to Arbitrum, an Ethereum L2 rollup
- Available assets: RWAs (USDY ~5% yield, PAXG gold-backed, SYRUPUSDC ~4.5%), USDC, EURC
- Key features: High yields, real-world asset tokenization, Ethereum security
- Use cases: Yield generation, gold exposure, DeFi strategies
- Emphasize: Higher yields than Celo, access to tokenized treasuries and gold
`;
  }

  return `
CURRENT CHAIN: Chain ID ${chainId}
- User is on an unsupported mainnet chain
- Recommend switching to Celo (for low fees/regional stables) or Arbitrum (for yields/RWAs)
`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], chainId, address } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Dynamic system prompt based on context
    const gdContext = await getGoodDollarContext(address);
    const contextPrompt = SYSTEM_PROMPT + getTestDriveContext(chainId) + getMainnetChainContext(chainId) + gdContext;

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

    // Parse actions from content
    let responseText = result.content;
    let action: any = null;

    if (responseText.includes('[ACTION:CLAIM_UBI]')) {
      action = { type: 'claim_ubi' };
      responseText = responseText.replace('[ACTION:CLAIM_UBI]', '').trim();
    } else if (responseText.includes('[ACTION:VERIFY_IDENTITY]')) {
      action = { type: 'verify_identity' };
      responseText = responseText.replace('[ACTION:VERIFY_IDENTITY]', '').trim();
    } else if (responseText.includes('[ACTION:NAVIGATE:')) {
      const match = responseText.match(/\[ACTION:NAVIGATE:(.*?)\]/);
      if (match && match[1]) {
        action = { type: 'navigate', tab: match[1].toLowerCase() };
        responseText = responseText.replace(match[0], '').trim();
      }
    }

    return res.status(200).json({
      response: responseText,
      provider: result.provider,
      type: 'text',
      action,
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


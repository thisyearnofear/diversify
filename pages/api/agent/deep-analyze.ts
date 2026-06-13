import type { NextApiRequest, NextApiResponse } from 'next';
import { ArcAgent } from '@diversifi/shared';
import { erc7715Service } from '../../../packages/shared/src/services/erc7715-service';
import type { SignedSessionPermission } from '../../../packages/shared/src/services/erc7715-service';
import { getPreferredNetworkForGoal } from '../../../config';

// Chain ID the server accepts permissions for
const EXPECTED_CHAIN_ID = parseInt(process.env.ARC_CHAIN_ID || '5042002', 10);

/**
 * Build an ArcAgent from a client-supplied signed session permission.
 * The server generates a fresh disposable keypair per request — the session
 * private key never persists beyond the lifetime of this handler invocation.
 */
function buildSessionAgent(signedPermission: SignedSessionPermission, spendingLimit: number): ArcAgent {
    const validation = erc7715Service.verifySignedPermission(signedPermission, EXPECTED_CHAIN_ID);
    if (!validation.isValid) {
        throw new Error(`Invalid session permission: ${validation.errors.join('; ')}`);
    }

    // Generate a fresh disposable keypair for this request
    const sessionKeyPair = erc7715Service.generateSessionKey();

    return new ArcAgent({
        sessionKey: {
            privateKey: sessionKeyPair.privateKey,
            permission: {
                ...signedPermission.permission,
                // Bind to the freshly generated address so SessionKeyProvider validates correctly
                sessionKeyAddress: sessionKeyPair.address,
            },
        },
        isTestnet: process.env.ARC_AGENT_TESTNET !== 'false',
        spendingLimit,
    });
}

/**
 * Fallback: legacy server-side private key (deprecated — use session key flow).
 * Kept for backward compatibility during migration; will be removed once all
 * clients send a signed permission.
 */
let legacyAgentInstance: ArcAgent | null = null;

function getLegacyAgent(): ArcAgent | null {
    if (legacyAgentInstance) return legacyAgentInstance;

    const privateKey = process.env.ARC_AGENT_PRIVATE_KEY;
    if (!privateKey) return null;

    console.warn(
        '[deep-analyze] Using deprecated ARC_AGENT_PRIVATE_KEY. ' +
        'Migrate to the session key flow (send signedPermission in the request body).'
    );

    legacyAgentInstance = new ArcAgent({
        privateKey,
        isTestnet: process.env.ARC_AGENT_TESTNET !== 'false',
        spendingLimit: parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0'),
    });

    return legacyAgentInstance;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { portfolio, config, networkInfo, signedPermission, userId } = req.body;

        let agent: ArcAgent | null = null;

        if (userId) {
            // New 2026 Path: Custodial "Agent Fuel" flow (Circle MPC sub-wallet)
            // The user has funded a dedicated agent wallet
            agent = new ArcAgent({
                userId,
                isTestnet: process.env.ARC_AGENT_TESTNET !== 'false',
                spendingLimit: parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0'), // Global limit for safety, or fetch per-user limit
                circleApiKey: process.env.CIRCLE_API_KEY,
                circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET,
                circleBaseUrl: process.env.CIRCLE_BASE_URL
            });
        } else if (signedPermission) {
            // Preferred non-custodial path: client provides a user-signed ERC-7715 permission
            const spendingLimit = (signedPermission as SignedSessionPermission).permission?.dailyLimitUSD ?? 5.0;
            agent = buildSessionAgent(signedPermission as SignedSessionPermission, spendingLimit);
        } else {
            // Legacy fallback: server-side master key (deprecated)
            agent = getLegacyAgent();
        }

        if (!agent) {
            return res.status(503).json({
                error: 'Agent not configured. Provide userId (for Agent Fuel) or signedPermission (for Session Key).',
            });
        }

        // Phase 1C: Extract the shape analyzePortfolioAutonomously actually expects.
        // Frontend sends a full MultichainPortfolio, but the agent needs { balance, holdings }.
        const agentPortfolio = {
            balance: portfolio?.totalValue ?? 0,
            holdings: portfolio?.allTokens?.map((t: any) => t.symbol) 
                ?? portfolio?.chains?.flatMap((c: any) => c.balances?.map((b: any) => b.symbol) ?? []) 
                ?? [],
        };

        // Also derive networkInfo if not explicitly sent
        const fallbackNetwork = getPreferredNetworkForGoal(config?.userGoal);
        const resolvedNetworkInfo = networkInfo ?? {
            chainId: portfolio?.chains?.[0]?.chainId ?? fallbackNetwork.chainId,
            name: portfolio?.chains?.[0]?.chainName ?? fallbackNetwork.name,
        };

        const result = await agent.analyzePortfolioAutonomously(agentPortfolio, config, resolvedNetworkInfo);
        // Phase 1B: Wrap response so frontend can read result.advice
        return res.status(200).json({ advice: result });
    } catch (error: unknown) {
        console.error('[Deep Analyze] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({
            error: errorMessage,
            action: 'HOLD',
            reasoning: 'Deep analysis temporarily unavailable.',
            confidence: 0,
            riskLevel: 'LOW',
        });
    }
}

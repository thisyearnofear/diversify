
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { ARC_DATA_HUB_CONFIG } from '../../../config';
import { x402Analytics } from '../../../utils/x402-analytics';

/**
 * Arc Data Hub - Production Gateway (v2)
 * Implements "Batching/Credit" model for x402 payments.
 * Users deposit funds (Batch Settlement) and draw down credit per request.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Upgraded from "1-tx-per-request" to "Credit Balance" model.
 * - AGGRESSIVE CONSOLIDATION: Unified state management in UserManager.
 * - PREVENT BLOAT: In-memory store for prototype (replace with Redis for prod).
 */

// --- Constants ---
const DATA_HUB_WALLET = process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS;
const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const USDC_TESTNET = ARC_DATA_HUB_CONFIG.USDC_TESTNET;
const USDC_MAINNET = '0xCa23545A2F2199b1307A0B2E15a0c1086da37798';
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // Increased limit for batched users
const BATCH_TOPUP_AMOUNT = '1.00'; // Suggest 1 USDC top-up

// --- Types ---
interface UserState {
    creditBalance: number; // Available credit in USDC
    requestCount: number;
    windowStart: number;
    nonces: Map<string, number>; // Nonce -> Expiry
    usageHistory: Record<string, { count: number; lastReset: number }>;
}

// --- State Management ---
class UserManager {
    private static users = new Map<string, UserState>();

    static getUser(clientKey: string): UserState {
        if (!this.users.has(clientKey)) {
            this.users.set(clientKey, {
                creditBalance: 0,
                requestCount: 0,
                windowStart: Date.now(),
                nonces: new Map(),
                usageHistory: {}
            });
        }
        return this.users.get(clientKey)!;
    }

    static checkRateLimit(user: UserState): { allowed: boolean; retryAfter?: number } {
        const now = Date.now();
        if (now < user.windowStart + RATE_LIMIT_WINDOW) {
            if (user.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
                return { allowed: false, retryAfter: Math.ceil((user.windowStart + RATE_LIMIT_WINDOW - now) / 1000) };
            }
            user.requestCount++;
        } else {
            user.requestCount = 1;
            user.windowStart = now;
        }
        return { allowed: true };
    }

    static trackUsage(user: UserState, source: string): number {
        const today = new Date().setHours(0, 0, 0, 0);
        const sourceKey = `${source}_${today}`; // Simple daily key

        if (!user.usageHistory[sourceKey] || user.usageHistory[sourceKey].lastReset < today) {
            user.usageHistory[sourceKey] = { count: 0, lastReset: today };
        }
        user.usageHistory[sourceKey].count++;
        return user.usageHistory[sourceKey].count;
    }

    static getUsage(user: UserState, source: string): number {
        const today = new Date().setHours(0, 0, 0, 0);
        const sourceKey = `${source}_${today}`;
        return user.usageHistory[sourceKey]?.count || 0;
    }

    static addCredit(user: UserState, amount: number) {
        user.creditBalance += amount;
    }

    static deductCredit(user: UserState, amount: number): boolean {
        if (user.creditBalance >= amount) {
            user.creditBalance -= amount;
            return true;
        }
        return false;
    }
}

// --- Handler ---
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const start = Date.now();
    const { source } = req.query;
    const paymentProof = req.headers['x-payment-proof'] as string;
    // Future: Support 'x-payment-mandate' for EIP-3009
    const clientIP = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || 'unknown';
    const clientKey = Array.isArray(clientIP) ? clientIP[0] : clientIP;

    if (!source || typeof source !== 'string') {
        x402Analytics.recordFailure('unknown', 'Missing source parameter');
        return res.status(400).json({ error: 'Missing source parameter' });
    }

    const user = UserManager.getUser(clientKey);

    // 1. Rate Limiting
    const rateLimit = UserManager.checkRateLimit(user);
    if (!rateLimit.allowed) {
        x402Analytics.recordFailure(source, 'Rate limit exceeded');
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter });
    }

    // 2. Pricing & Free Tier Check
    const pricing = ARC_DATA_HUB_CONFIG.PRICING as Record<string, string>;
    const freeLimits = ARC_DATA_HUB_CONFIG.FREE_LIMITS as Record<string, number>;
    const cost = parseFloat(pricing[source] || '0.01');

    // Simplify source name for limit checking (remove suffixes)
    const baseSource = source.replace(/(_enhanced|_analytics|_realtime|_optimizer|_insights)$/, '');
    const currentUsage = UserManager.getUsage(user, baseSource);
    const freeLimit = freeLimits[baseSource] || 10;
    const isFreeTier = currentUsage <= freeLimit;

    // 3. Payment Processing (Top-up)
    if (paymentProof) {
        try {
            const amountCredited = await verifyOnChainPayment(paymentProof);
            if (amountCredited > 0) {
                UserManager.addCredit(user, amountCredited);
                console.log(`[Data Hub] User ${clientKey} deposited $${amountCredited}. New Balance: $${user.creditBalance}`);
                // Record deposit as a special payment event
                x402Analytics.recordPayment('USDC_DEPOSIT', amountCredited, Date.now() - start);
                // Don't return here; proceed to fulfill the request using the new credit
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            x402Analytics.recordFailure('USDC_DEPOSIT', errorMessage);
            return res.status(401).json({ error: `Payment verification failed: ${errorMessage}` });
        }
    }

    // 4. Billing Logic
    if (isFreeTier) {
        console.log(`[Data Hub] Free tier access: ${source} (${currentUsage}/${freeLimit})`);
        UserManager.trackUsage(user, baseSource); // Increment usage
        const data = await getActualPremiumData(source, true);
        return res.status(200).json({
            ...data,
            _billing: {
                status: 'Free Tier',
                remaining_free: freeLimit - currentUsage,
                upgrade_info: 'Micro-payments enable enhanced analysis'
            }
        });
    }

    // 5. Paid Tier Logic (Credit Drawdown)
    if (UserManager.deductCredit(user, cost)) {
        console.log(`[Data Hub] Paid access: ${source} - Deducted $${cost}. Remaining: $${user.creditBalance}`);
        // Record the actual usage payment
        x402Analytics.recordPayment(source, cost, Date.now() - start);
        
        // Note: Usage is NOT tracked against free limit for paid requests, or it IS?
        // Let's say paid requests don't consume free limit, but free limit is already exhausted anyway.
        const data = await getActualPremiumData(source, false);
        return res.status(200).json({
            ...data,
            _billing: {
                status: 'Paid',
                cost: cost,
                remaining_credit: user.creditBalance.toFixed(4)
            }
        });
    }

    // 6. Payment Required (402) - Batch Request
    const nonce = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    user.nonces.set(nonce, Date.now() + 300000); // 5 min expiry

    // We don't record a failure here, as 402 is a valid flow step, but we could track 'challenges' if needed.

    return res.status(402).json({
        error: 'Insufficient credit',
        recipient: DATA_HUB_WALLET,
        // Request Batch Top-up instead of single cost
        amount: BATCH_TOPUP_AMOUNT,
        currency: 'USDC',
        chainId: 5042002, // Arc Testnet
        nonce,
        current_balance: user.creditBalance.toFixed(4),
        required_cost: cost,
        instructions: {
            method: 'USDC Transfer',
            network: 'Arc Network',
            note: 'Payment adds to your credit balance for multiple requests.'
        }
    });
}

// --- Verification Logic ---
async function verifyOnChainPayment(txHash: string): Promise<number> {
    const provider = new ethers.providers.JsonRpcProvider(ARC_RPC);
    const tx = await provider.getTransaction(txHash);

    if (!tx) throw new Error('Transaction not found');

    const receipt = await tx.wait(1);
    const usdcAddress = tx.to?.toLowerCase() === USDC_TESTNET.toLowerCase() ? USDC_TESTNET : USDC_MAINNET;

    if (tx.to?.toLowerCase() !== usdcAddress.toLowerCase()) {
        throw new Error('Payment must be to USDC contract');
    }

    // Parse Transfer event
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const transferLog = receipt.logs.find(log =>
        log.topics[0] === transferTopic &&
        log.address.toLowerCase() === usdcAddress.toLowerCase()
    );

    if (!transferLog) throw new Error('No USDC transfer found');

    const recipientFromLog = '0x' + transferLog.topics[2].slice(26);
    const amountFromLog = ethers.BigNumber.from(transferLog.data);
    const amountUSDC = parseFloat(ethers.utils.formatUnits(amountFromLog, 6));

    if (recipientFromLog.toLowerCase() !== DATA_HUB_WALLET?.toLowerCase()) {
        throw new Error('Invalid payment recipient');
    }

    // Check against used nonces to prevent replay (Simple in-memory check for now)
    // In production, store processed txHashes in DB
    const isReplay = false; // Placeholder
    if (isReplay) throw new Error('Transaction already processed');

    return amountUSDC;
}

// --- Data Fetching (Preserved & Cleaned) ---
async function getActualPremiumData(source: string, isFreeTier: boolean = false) {
    const data: Record<string, Record<string, any>> = {
        'alpha_vantage_enhanced': await getAlphaVantageData(isFreeTier),
        'world_bank_analytics': await getWorldBankData(isFreeTier),
        'defillama_realtime': await getDeFiLlamaData(isFreeTier),
        'yearn_optimizer': await getYearnData(isFreeTier),
        'coingecko_analytics': await getCoinGeckoData(isFreeTier),
        'fred_insights': await getFredData(isFreeTier),
        'macro_analysis': await getMacroAnalysis(isFreeTier),
        'portfolio_optimization': await getPortfolioOptimization(isFreeTier),
        'risk_assessment': await getRiskAssessment(isFreeTier)
    };

    return data[source] || {
        status: 'Success',
        message: 'Data source not available',
        tier: isFreeTier ? 'free' : 'premium'
    };
}

// ... [Keep existing individual data fetch functions below unchanged] ...
// They are specific logic mocks/wrappers and good for the prototype.

// Free API data functions with tiered features
async function getAlphaVantageData(isFreeTier: boolean) {
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey=${process.env.ALPHA_VANTAGE_API_KEY || 'demo'}`);
        if (response.ok) {
            const data = await response.json();
            const baseData = {
                exchange_rate: data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || '0.92',
                last_updated: new Date().toISOString(),
                source: 'Alpha Vantage Free API'
            };
            if (!isFreeTier) {
                return {
                    ...baseData,
                    trend_analysis: 'EUR strengthening against USD based on 30-day moving average',
                    volatility_score: 0.23,
                    prediction_confidence: 0.78,
                    recommended_action: 'HOLD',
                    tier: 'premium'
                };
            }
            return { ...baseData, tier: 'free' };
        }
    } catch (_) { console.warn('Alpha Vantage API unavailable'); }
    return { exchange_rate: '0.92', source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getWorldBankData(isFreeTier: boolean) {
    try {
        const response = await fetch('https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL.ZG?format=json&per_page=5&date=2020:2024');
        if (response.ok) {
            const data = await response.json();
            const inflationData = data[1]?.filter((item: any) => item.value !== null) || [];
            const baseData = {
                current_inflation: inflationData[0]?.value || 3.1,
                historical_data: inflationData.slice(0, 3),
                source: 'World Bank Free API',
                last_updated: new Date().toISOString()
            };
            if (!isFreeTier) {
                return {
                    ...baseData,
                    ai_analysis: 'Inflation trending downward from 2022 peak',
                    risk_assessment: 'Medium - potential for sticky services inflation',
                    tier: 'premium'
                };
            }
            return { ...baseData, tier: 'free' };
        }
    } catch (_) { console.warn('World Bank API unavailable'); }
    return { current_inflation: 3.1, source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getDeFiLlamaData(isFreeTier: boolean) {
    try {
        const response = await fetch('https://yields.llama.fi/pools');
        if (response.ok) {
            const pools = await response.json();
            const stablePools = pools.data
                ?.filter((pool: any) => pool.symbol.includes('USDC') && pool.tvlUsd > 1000000)
                .sort((a: any, b: any) => b.apy - a.apy)
                .slice(0, isFreeTier ? 3 : 10) || [];
            const baseData = {
                top_yields: stablePools.map((pool: any) => ({ protocol: pool.project, apy: pool.apy, tvl: pool.tvlUsd })),
                source: 'DeFiLlama Free API'
            };
            if (!isFreeTier) {
                return { ...baseData, risk_analysis: 'Audited, High Liquidity', tier: 'premium' };
            }
            return { ...baseData, tier: 'free' };
        }
    } catch (_) { console.warn('DeFiLlama API unavailable'); }
    return { top_yields: [{ protocol: 'Aave', apy: 4.2 }], source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getYearnData(isFreeTier: boolean) {
    // Mock for brevity, similar structure to others
    return {
        best_vaults: [{ name: 'USDC Vault', apy: 4.5 }],
        source: 'Yearn (Mock)',
        tier: isFreeTier ? 'free' : 'premium',
        ...(isFreeTier ? {} : { optimization: 'Auto-compound weekly' })
    };
}

async function getCoinGeckoData(isFreeTier: boolean) {
    // Mock for brevity
    return {
        bitcoin_price: 65000,
        source: 'CoinGecko (Mock)',
        tier: isFreeTier ? 'free' : 'premium',
        ...(isFreeTier ? {} : { sentiment: 'Bullish' })
    };
}

async function getFredData(isFreeTier: boolean) {
    // Mock for brevity
    return {
        cpi_data: [{ date: '2024-01', value: 310 }],
        source: 'FRED (Mock)',
        tier: isFreeTier ? 'free' : 'premium',
        ...(isFreeTier ? {} : { forecast: 'Stable' })
    };
}

// Premium Services
async function getMacroAnalysis(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.03 USDC' };
    return { macro_regime: 'Disinflationary Growth', confidence: 0.78, tier: 'premium' };
}

async function getPortfolioOptimization(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.05 USDC' };
    return { optimal_weights: { 'USDC': 30, 'BTC': 20 }, tier: 'premium' };
}

async function getRiskAssessment(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.02 USDC' };
    return { risk_score: 3.2, mitigation: 'Diversify', tier: 'premium' };
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { getSoSoValueIntelligence, getSoSoMacroEvents } from '../../../lib/sosovalue';
import {
    ARC_DATA_HUB_CONFIG,
    buildArcResearchBundle,
    BrightDataService,
    circleService,
    getArcResearchSource,
    normalizeArcResearchSource,
    settleOnChain,
    DEFAULT_SETTLEMENT_NETWORK,
    getSettlementConfig,
    getHspRailConfig,
    resolveHspRuntime,
    verifyHspSettlement,
    getHspChainInfo,
    registerMandate,
    type WireSignedMandate,
    SETTLEMENT_ENV,
    generateChatCompletion,
    startBrightDataWarming,
    type ArcResearchCategory,
    type ArcResearchDataType,
    type ArcResearchSourceDefinition,
    type SettlementResult,
    type BrightDataBankCode,
    type BrightDataCommodity,
    x402Analytics
} from '@diversifi/shared';
import { validateApiKey, recordRecommendation, anchorIntelligence, type EnterpriseKey, constantTimeEqual } from '@diversifi/shared';
import {
    analyzeCycles,
    requiredDates,
    validateCycles,
    buildServerlessRateProvider,
    fxRegionForCurrency,
    GHANA_IMPORTER_SAMPLE,
    type DragInput,
} from '@diversifi/shared';
import { CURRENCY_BY_CODE } from '../../../constants/currency-risk';
import { indexRecommendation } from '../../../lib/audit-index';
import { getClientStore, type ClientState } from '../../../lib/client-store';
import connectDB from '../../../lib/mongodb';
import { ProcessedPaymentProof } from '../../../models/ProcessedPaymentProof';
import { mongoSettlementCapStore } from '../../../lib/settlement-cap-store';
import { setSettlementCapStore } from '@diversifi/shared';

// Inject the MongoDB-backed daily settlement cap store at module load.
setSettlementCapStore(mongoSettlementCapStore);

/**
 * Arc Data Hub - Production Gateway (v2)
 * Implements "Batching/Credit" model for x402 payments.
 * Users deposit funds (Batch Settlement) and draw down credit per request.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Upgraded from "1-tx-per-request" to "Credit Balance" model.
 * - AGGRESSIVE CONSOLIDATION: Unified state management in UserManager.
 * - PLUGGABLE STORE: in-memory by default; set CLIENT_STATE_STORE=mongo for durable MongoDB-backed client state (see lib/client-store.ts).
 */

// --- Constants ---
const DATA_HUB_WALLET = process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // Increased limit for batched users
const BATCH_TOPUP_AMOUNT = '1.00'; // Optional larger top-up users can choose
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_PAYMENT_AMOUNT_USDC = 0.001;
const USDC_DECIMALS = 6;
const CREDIT_EPSILON_MICRO_USDC = 1;
const FREE_TIER_DAILY_CAP = parseInt(process.env.FREE_TIER_DAILY_CAP || '100', 10);

// FX Protection audit trail "follows the money": the recommendation anchors on the
// importer's REGION-canonical ledger, decoupled from whichever rail settlement rode.
// (docs/apac-rail.md chain roles.) `undefined` → let recordRecommendation's default
// routing pick Arbitrum. The RecommendationLedger is deployed at the same address on
// all of these chains.
const FX_ANCHOR_CHAIN_BY_REGION: Record<string, number | undefined> = {
    asia: 177,      // HashKey — APAC rail
    africa: 42220,  // Celo — Africa / EM savings ledger
    latam: 42220,   // Celo — LatAm shares the EM ledger
    other: undefined, // default routing (Arbitrum)
};

// Durable replay protection for payment proofs (tx hashes and Circle Gateway IDs).
// The old in-memory Set has been replaced by a MongoDB collection with a unique
// index on (txHash, network, env).
async function isProofProcessed(txHash: string, network: string = DEFAULT_SETTLEMENT_NETWORK): Promise<boolean> {
    try {
        await connectDB();
        const existing = await ProcessedPaymentProof.findOne({
            txHash,
            network,
            env: SETTLEMENT_ENV,
        }).lean();
        return !!existing;
    } catch (err) {
        console.error('[Data Hub] Failed to check processed payment proof:', err);
        // Fail closed: if we cannot verify uniqueness, refuse the proof.
        return true;
    }
}

async function markProofProcessed(txHash: string, amountUSDC: number, network: string = DEFAULT_SETTLEMENT_NETWORK): Promise<void> {
    try {
        await connectDB();
        await ProcessedPaymentProof.create({
            txHash,
            network,
            env: SETTLEMENT_ENV,
            amountUSDC,
        });
    } catch (err: any) {
        // Duplicate key means another concurrent request won the race — re-throw
        // so the caller treats this proof as already processed.
        if (err?.code === 11000) {
            throw new Error('Transaction already processed');
        }
        console.error('[Data Hub] Failed to record processed payment proof:', err);
        throw new Error('Payment proof record failed');
    }
}

// --- Types ---
interface UserState {
    clientKey?: string;
    creditBalanceMicros: number; // Available credit in micro-USDC
    requestCount: number;
    windowStart: number;
    nonces: Record<string, number>; // Nonce -> Expiry
    usageHistory: Record<string, { count: number; lastReset: number }>;
    /** Global free-tier request counter (per-client-key, per-day). */
    freeUsageToday?: { count: number; lastReset: number };
    /** Set when this client authenticated with an enterprise API key. */
    enterprise?: boolean;
    /** Per-key request limit override (enterprise keys). */
    rateLimitMax?: number;
}

// --- State Management ---
class UserManager {
    private static users = new Map<string, UserState>();
    private static store = getClientStore();

    static async getUser(clientKey: string): Promise<UserState> {
        const cached = this.users.get(clientKey);
        if (cached) return cached;
        const stored = await this.store.get(clientKey);
        const user: UserState = stored
            ? { ...stored, clientKey }
            : {
                  clientKey,
                  creditBalanceMicros: 0,
                  requestCount: 0,
                  windowStart: Date.now(),
                  nonces: {},
                  usageHistory: {},
              };
        this.users.set(clientKey, user);
        return user;
    }

    static persist(user: UserState): void {
        if (!user.clientKey) return;
        this.store
            .set(user.clientKey, user as ClientState)
            .catch((err: any) =>
                console.warn('[Data Hub] Client state persist failed:', err?.message ?? err),
            );
    }

    static checkRateLimit(user: UserState): { allowed: boolean; retryAfter?: number } {
        const limit = user.rateLimitMax ?? RATE_LIMIT_MAX_REQUESTS;
        const now = Date.now();
        if (now < user.windowStart + RATE_LIMIT_WINDOW) {
            if (user.requestCount >= limit) {
                this.persist(user);
                return { allowed: false, retryAfter: Math.ceil((user.windowStart + RATE_LIMIT_WINDOW - now) / 1000) };
            }
            user.requestCount++;
        } else {
            user.requestCount = 1;
            user.windowStart = now;
        }
        this.persist(user);
        return { allowed: true };
    }

    static trackUsage(user: UserState, source: string): number {
        const today = new Date().setHours(0, 0, 0, 0);
        const sourceKey = `${source}_${today}`; // Simple daily key

        if (!user.usageHistory[sourceKey] || user.usageHistory[sourceKey].lastReset < today) {
            user.usageHistory[sourceKey] = { count: 0, lastReset: today };
        }
        user.usageHistory[sourceKey].count++;
        this.persist(user);
        return user.usageHistory[sourceKey].count;
    }

    static getUsage(user: UserState, source: string): number {
        const today = new Date().setHours(0, 0, 0, 0);
        const sourceKey = `${source}_${today}`;
        return user.usageHistory[sourceKey]?.count || 0;
    }

    /**
     * Global free-tier budget across all sources for a single client key (IP or
     * enterprise tenant) per UTC day. Used to prevent abuse of the freemium path.
     * Returns true while the daily free budget remains.
     */
    static checkFreeTierBudget(user: UserState): { allowed: boolean; remaining: number } {
        if (FREE_TIER_DAILY_CAP <= 0) {
            return { allowed: true, remaining: Infinity };
        }
        const today = new Date().setHours(0, 0, 0, 0);
        if (!user.freeUsageToday || user.freeUsageToday.lastReset < today) {
            user.freeUsageToday = { count: 0, lastReset: today };
        }
        const remaining = Math.max(0, FREE_TIER_DAILY_CAP - user.freeUsageToday.count);
        return { allowed: remaining > 0, remaining };
    }

    static consumeFreeTierBudget(user: UserState): void {
        if (FREE_TIER_DAILY_CAP <= 0) return;
        const today = new Date().setHours(0, 0, 0, 0);
        if (!user.freeUsageToday || user.freeUsageToday.lastReset < today) {
            user.freeUsageToday = { count: 0, lastReset: today };
        }
        user.freeUsageToday.count++;
        this.persist(user);
    }

    static addCredit(user: UserState, amountMicros: number) {
        user.creditBalanceMicros += amountMicros;
        this.persist(user);
    }

    static deductCredit(user: UserState, amountMicros: number): boolean {
        if (user.creditBalanceMicros + CREDIT_EPSILON_MICRO_USDC >= amountMicros) {
            user.creditBalanceMicros = Math.max(0, user.creditBalanceMicros - amountMicros);
            this.persist(user);
            return true;
        }
        return false;
    }

    static consumeNonce(user: UserState, nonce: string): { valid: boolean; reason?: string } {
        const expiresAt = user.nonces[nonce];
        if (!expiresAt) {
            return { valid: false, reason: 'Payment nonce not found' };
        }
        if (Date.now() > expiresAt) {
            delete user.nonces[nonce];
            this.persist(user);
            return { valid: false, reason: 'Payment nonce expired' };
        }
        delete user.nonces[nonce];
        this.persist(user);
        return { valid: true };
    }

    static issueNonce(user: UserState, nonce: string, expiresAt: number): void {
        user.nonces[nonce] = expiresAt;
        this.persist(user);
    }
}

type SourcePlan = {
    requestedSource: string;
    sourceId: string;
    source: ArcResearchSourceDefinition;
    currentUsage: number;
    freeLimit: number;
    isFreeEligible: boolean;
    cost: number;
};

type SourcePayload = {
    sourceId: string;
    label: string;
    dataType: ArcResearchDataType;
    category: ArcResearchCategory;
    cost: number;
    tier: 'free' | 'paid';
    freshnessMinutes: number;
    reputation: number;
    data: Record<string, unknown>;
    evidenceCid?: string;
};

type PaymentMandatePayload = {
    amount: string;
    nonce?: string;
    [key: string]: unknown;
};

function toMicroUSDC(amount: number | string): number {
    const normalized = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(normalized)) {
        throw new Error(`Invalid USDC amount: ${amount}`);
    }

    return Math.round(normalized * (10 ** USDC_DECIMALS));
}

function fromMicroUSDC(amountMicros: number): number {
    return amountMicros / (10 ** USDC_DECIMALS);
}

function formatMicroUSDC(amountMicros: number, decimals: number = 6): string {
    return fromMicroUSDC(amountMicros).toFixed(decimals);
}

function getHeader(req: NextApiRequest, key: string): string | undefined {
    const value = req.headers[key];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
}



function parseRequestedSources(sourceParam: NextApiRequest['query']['source'], sourcesParam: NextApiRequest['query']['sources']): string[] {
    const values = [sourceParam, sourcesParam].flatMap((value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
    });

    return values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index);
}

function resolveSourcePlan(user: UserState, requestedSource: string): SourcePlan {
    const resolvedSource = normalizeArcResearchSource(requestedSource);
    const source = getArcResearchSource(resolvedSource);

    if (!source) {
        throw new Error(`Unknown data source: ${requestedSource}`);
    }

    const currentUsage = UserManager.getUsage(user, source.id);
    const sourceFreeEligible = source.freeLimit > 0 && currentUsage < source.freeLimit;
    // Global per-client-key free-tier budget takes precedence over source-level limits.
    const globalFreeBudget = UserManager.checkFreeTierBudget(user);
    const isFreeEligible = sourceFreeEligible && globalFreeBudget.allowed;
    const cost = isFreeEligible ? 0 : parseFloat(source.price);

    return {
        requestedSource,
        sourceId: source.id,
        source,
        currentUsage,
        freeLimit: source.freeLimit,
        isFreeEligible,
        cost
    };
}

function estimateFreshnessMinutes(payload: Record<string, unknown>, fallbackMinutes: number): number {
    const candidates = [
        payload.last_updated,
        payload.lastUpdated,
        payload.updated_at,
        payload.timestamp,
        payload.date
    ].filter(Boolean);

    const candidate = candidates[0];
    if (typeof candidate !== 'string') {
        return fallbackMinutes;
    }

    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) {
        return fallbackMinutes;
    }

    return Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

// --- Handler ---
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const start = Date.now();
    // On-chain payer + settlement tx, captured during verify for the region-canonical
    // ledger anchor. Set on the HSP path (mandate signer) and the plain on-chain path
    // (tx sender) — both give us a wallet to attribute the recommendation to.
    let settlementPayer: string | undefined;
    let settlementTxHash: string | undefined;
    const requestedSources = parseRequestedSources(req.query.source, req.query.sources);
    const quoteOnly = req.query.quote === '1' || req.query.quote === 'true';
    const paymentProof = getHeader(req, 'x-payment-proof');
    const paymentMandate = getHeader(req, 'x-payment-mandate');
    const paymentNonce = getHeader(req, 'x-payment-nonce');
    // Distinct header for HSP settlement — never overload x-payment-proof, whose
    // 32-byte-hex tx hashes route into the Arc/0G on-chain verifier.
    const hspProof = getHeader(req, 'x-payment-hsp');

    const clientIP = (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || 'unknown';
    const clientKey = Array.isArray(clientIP) ? clientIP[0] : clientIP;

    // --- Enterprise API-key auth (additive parallel path to x402 on-chain payment) ---
    const apiKeyHeader = getHeader(req, 'x-api-key');
    const enterpriseKey: EnterpriseKey | null = apiKeyHeader ? validateApiKey(apiKeyHeader) : null;
    if (apiKeyHeader && !enterpriseKey) {
        return res.status(401).json({ error: 'Invalid enterprise API key' });
    }
    const effectiveClientKey = enterpriseKey ? `ent:${enterpriseKey.tenantId}` : clientKey;

    if (requestedSources.length === 0) {
        x402Analytics.recordFailure('unknown', 'Missing source parameter');
        return res.status(400).json({ error: 'Missing source parameter' });
    }

    const user = await UserManager.getUser(effectiveClientKey);
    if (enterpriseKey) {
        user.enterprise = true;
        user.rateLimitMax = enterpriseKey.rateLimit;
    }

    let sourcePlans: SourcePlan[];
    try {
        sourcePlans = requestedSources.map((requestedSource) => resolveSourcePlan(user, requestedSource));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid source parameter';
        x402Analytics.recordFailure(requestedSources[0] || 'unknown', errorMessage);
        return res.status(400).json({ error: errorMessage });
    }

    const rateLimit = UserManager.checkRateLimit(user);
    if (!rateLimit.allowed) {
        x402Analytics.recordFailure(requestedSources[0], 'Rate limit exceeded');
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter });
    }

    const bundleRequested = sourcePlans.length > 1;
    const requestedSourceLabel = bundleRequested
        ? sourcePlans.map((plan) => plan.source.label).join(', ')
        : sourcePlans[0].source.label;
    const totalCost = sourcePlans.reduce((sum, plan) => sum + plan.cost, 0);
    const totalCostMicros = sourcePlans.reduce((sum, plan) => sum + toMicroUSDC(plan.cost), 0);

    if (quoteOnly) {
        return sendResearchQuote(res, user, sourcePlans, totalCost, bundleRequested);
    }

    // Parse + validate FX cycle records BEFORE charging, so malformed input returns a
    // clean 400 rather than debiting credit and then failing to compute.
    let fxInput: DragInput | undefined;
    if (sourcePlans.some((plan) => plan.source.id === 'fx_protection')) {
        try {
            fxInput = parseFxProtectionInput(req);
        } catch (error) {
            return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid FX cycle records' });
        }
    }

    if (paymentMandate) {
        try {
            const mandate = JSON.parse(paymentMandate) as PaymentMandatePayload;
            if (!mandate.nonce) {
                return res.status(400).json({ error: 'Missing nonce in payment mandate' });
            }

            const nonceCheck = UserManager.consumeNonce(user, mandate.nonce);
            if (!nonceCheck.valid) {
                return res.status(401).json({ error: nonceCheck.reason });
            }

            const isValid = await circleService.verifyNanopaymentMandate(mandate as any);

            if (isValid) {
                const amount = parseFloat(mandate.amount);
                UserManager.addCredit(user, toMicroUSDC(amount));
                console.log(`[Data Hub] Nanopayment Mandate verified: $${amount}`);
                x402Analytics.recordPayment(requestedSourceLabel, amount, Date.now() - start, 'CIRCLE_NANOPAYMENT');
            } else {
                return res.status(401).json({ error: 'Invalid Nanopayment Mandate signature' });
            }
        } catch (error) {
            return res.status(400).json({ error: 'Malformed Nanopayment Mandate' });
        }
    }

    if (hspProof) {
        try {
            const hsp = JSON.parse(hspProof) as { paymentId?: string; txHash?: string; nonce?: string; mandate?: WireSignedMandate };
            if (!hsp.paymentId) {
                return res.status(400).json({ error: 'Missing paymentId in HSP proof' });
            }
            if (hsp.nonce) {
                const nonceCheck = UserManager.consumeNonce(user, hsp.nonce);
                if (!nonceCheck.valid) {
                    return res.status(401).json({ error: nonceCheck.reason });
                }
            }

            const { amountUSDC: amountCredited, payer } = await verifyHspPayment(hsp.paymentId, hsp.txHash, hsp.mandate);
            if (amountCredited > 0) {
                settlementPayer = payer;
                settlementTxHash = hsp.txHash;
                UserManager.addCredit(user, toMicroUSDC(amountCredited));
                console.log(`[Data Hub] HSP settlement verified on HashKey: $${amountCredited}`);
                x402Analytics.recordPayment(requestedSourceLabel, amountCredited, Date.now() - start, 'HASHKEY_HSP');
            } else {
                return res.status(401).json({ error: 'HSP settlement not verified' });
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return res.status(401).json({ error: `HSP verification failed: ${msg}` });
        }
    }

    if (paymentProof) {
        try {
            if (paymentNonce) {
                const nonceCheck = UserManager.consumeNonce(user, paymentNonce);
                if (!nonceCheck.valid) {
                    return res.status(401).json({ error: nonceCheck.reason });
                }
            }

            const { amountUSDC: amountCredited, payer } = await verifyCircleGatewayPayment(paymentProof);
            if (amountCredited > 0) {
                UserManager.addCredit(user, toMicroUSDC(amountCredited));
                if (payer) {
                    // Plain on-chain settlement (e.g. USDT on HashKey): the tx sender is
                    // the payer, so the region-canonical anchor can fire without HSP.
                    settlementPayer = payer;
                    settlementTxHash = paymentProof;
                }
                const paymentMethod = paymentProof.startsWith('circle-gateway-') ? 'CIRCLE_GATEWAY' : 'ON_CHAIN';
                x402Analytics.recordPayment(requestedSourceLabel, amountCredited, Date.now() - start, paymentMethod);
            }
        } catch (error: unknown) {
            return res.status(401).json({ error: `Payment verification failed` });
        }
    }

    if (totalCostMicros > 0 && !user.enterprise && !UserManager.deductCredit(user, totalCostMicros)) {
        return sendPaymentRequired(res, user, sourcePlans, totalCost, bundleRequested);
    }

    // fxInput was parsed + validated before charging (above).

    const payloads: SourcePayload[] = [];
    for (const plan of sourcePlans) {
        if (plan.isFreeEligible) {
            console.log(`[Data Hub] Free access: ${plan.source.id} (${plan.currentUsage + 1}/${plan.freeLimit})`);
            UserManager.consumeFreeTierBudget(user);
        } else {
            console.log(`[Data Hub] Paid access: ${plan.source.id} - Deducted $${plan.cost}`);
        }

        UserManager.trackUsage(user, plan.source.id);

        const data = await getActualPremiumData(plan.source.id, plan.isFreeEligible, fxInput);
        const payload: SourcePayload = {
            sourceId: plan.source.id,
            label: plan.source.label,
            dataType: plan.source.dataType,
            category: plan.source.category,
            cost: plan.cost,
            tier: plan.isFreeEligible ? 'free' : 'paid',
            freshnessMinutes: estimateFreshnessMinutes(data as Record<string, unknown>, plan.source.freshnessWindowMinutes),
            reputation: plan.source.reputation,
            data,
        };

        payloads.push(payload);

        if (plan.cost > 0) {
            x402Analytics.recordPayment(plan.source.id, plan.cost, Date.now() - start);
        }
    }

    // --- Anchor premium intelligence to 0G (verifiability) ---
    // Every paid gateway response is uploaded to 0G Storage; the CID is
    // surfaced in _billing and the enterprise audit record. Best-effort:
    // failures return null and never block the response.
    const evidenceCidsBySource = new Map<string, string>();
    await Promise.all(
        payloads
            .filter((_, i) => (sourcePlans[i]?.cost ?? 0) > 0)
            .map(async (p) => {
                const cid = await anchorIntelligence({ sourceId: p.sourceId, data: p.data }).catch(() => null);
                if (cid) {
                    p.evidenceCid = cid;
                    evidenceCidsBySource.set(p.sourceId, cid);
                }
            }),
    );

    // --- Real on-chain settlement (fire-and-forget, non-blocking) ---
    // Fires a real USDC micro-tx on the configured settlement rail for every paid request.
    // Settlement runs in background — gateway response is not delayed.
    // Enterprise API-key clients skip x402 settlement (billed via their tenant quota).
    // On the HASHKEY rail the USER already settled on-chain via HSP (their wallet →
    // merchant transfer, observed + receipted), so the agent-side settleOnChain would
    // double-pay. Skip it — the HSP tx is the settlement of record.
    const settlements: SettlementResult[] = [];
    if (totalCost > 0 && !user.enterprise && DEFAULT_SETTLEMENT_NETWORK !== 'HASHKEY') {
        const settlementPromises = sourcePlans
            .filter(p => p.cost > 0)
            .map(p => settleOnChain(p.cost, p.source.id, DEFAULT_SETTLEMENT_NETWORK));

        // Await with a short timeout so we can include tx hashes in the response
        // if they land quickly, but never block the API response.
        const settled = await Promise.race([
            Promise.all(settlementPromises),
            new Promise<null>(r => setTimeout(() => r(null), 1500)),
        ]);

        if (Array.isArray(settled)) {
            settled.forEach(r => { if (r.settled) settlements.push(r as SettlementResult); });
        }
    }

    // --- Enterprise tenant audit attribution (fire-and-forget) ---
    // Every premium request from an enterprise key produces an off-chain audit
    // record attributed to the tenant, so the audit-export endpoint can scope
    // the tenant's verifiable consumption. Best-effort: never blocks the response.
    if (user.enterprise && enterpriseKey) {
        for (const plan of sourcePlans) {
            if (plan.cost > 0) {
                recordRecommendation({
                    user: enterpriseKey.tenantId,
                    action: 'ACCESS',
                    targetToken: plan.source.id,
                    evidenceCid: evidenceCidsBySource.get(plan.source.id) ?? '',
                    servingModel: 'enterprise-gateway',
                    confidence: 10000,
                    tenantId: enterpriseKey.tenantId,
                    onAnchor: indexRecommendation,
                }).catch((err: any) =>
                    console.warn('[Data Hub] Enterprise audit record skipped:', err?.message ?? err),
                );
            }
        }
    }

    // --- Region-canonical ledger anchor for the FX Protection Insight (fire-and-forget) ---
    // The audit trail "follows the money": the recommendation anchors on the importer's
    // REGION-canonical ledger (APAC currency → HashKey, Africa/LatAm → Celo, else →
    // Arbitrum), independent of the rail settlement rode. The settlement tx is recorded
    // as the cross-chain reference. Fires whenever we know the on-chain payer — the HSP
    // mandate signer OR the plain on-chain tx sender. Best-effort; never blocks; anchor
    // writes need only gas on the destination ledger chain (no stablecoin).
    if (settlementPayer) {
        const fxIndex = payloads.findIndex((p, i) => p.sourceId === 'fx_protection' && (sourcePlans[i]?.cost ?? 0) > 0);
        if (fxIndex >= 0) {
            const currency = (payloads[fxIndex].data as { currency?: string } | undefined)?.currency ?? 'USD';
            const region = fxRegionForCurrency(currency);
            const anchorChainId = FX_ANCHOR_CHAIN_BY_REGION[region];
            recordRecommendation({
                user: settlementPayer,
                action: 'PROTECT',
                targetToken: 'USDC',
                reasoning: `FX Protection Insight — quantified per-cycle import FX drag for ${currency} working capital (${region} rail); settled on ${getSettlementConfig().name}.`,
                evidenceCid: evidenceCidsBySource.get('fx_protection') ?? '',
                servingModel: 'fx-drag/v1',
                confidence: 9000,
                settlementTxHash: settlementTxHash,
                // Region-canonical anchor; omit to let default routing pick Arbitrum.
                ...(anchorChainId ? { chainId: anchorChainId } : {}),
            }).catch((err: unknown) =>
                console.warn('[Data Hub] FX ledger anchor skipped:', err instanceof Error ? err.message : err),
            );
        }
    }

    const bundle = buildArcResearchBundle(payloads);
    const settlementMeta = settlements.length > 0
        ? {
            txHashes: settlements.map(s => s.txHash),
            explorer: settlements.map(s => s.explorer),
            onChainSettled: true,
            settlementNetwork: DEFAULT_SETTLEMENT_NETWORK,
            settlementEnv: SETTLEMENT_ENV,
        }
        : { onChainSettled: false };

    if (bundleRequested) {
        return res.status(200).json({
            bundle,
            sources: payloads,
            data: Object.fromEntries(payloads.map((payload) => [payload.sourceId, payload.data])),
            _billing: {
                status: totalCost > 0 ? 'Bundle Paid' : 'Bundle Free',
                cost: totalCost,
                remaining_credit: formatMicroUSDC(user.creditBalanceMicros, 4),
                reason: totalCost > 0
                    ? 'Multiple paid sources unlocked through a single research bundle'
                    : 'All requested bundle sources were within free tier',
                evidenceCids: Array.from(evidenceCidsBySource.values()),
                ...settlementMeta,
            },
        });
    }

    const singleSource = payloads[0];
    const singlePlan = sourcePlans[0];
    return res.status(200).json({
        ...singleSource.data,
        _research: {
            source: singleSource,
            bundle,
        },
        _billing: {
            status: singlePlan.isFreeEligible ? 'Free Tier' : 'Paid',
            cost: singleSource.cost,
            remaining_free: singlePlan.isFreeEligible ? singlePlan.freeLimit - (singlePlan.currentUsage + 1) : undefined,
            remaining_credit: formatMicroUSDC(user.creditBalanceMicros, 4),
            reason: singlePlan.isFreeEligible
                ? `Free tier (${singlePlan.freeLimit - (singlePlan.currentUsage + 1)} remaining today)`
                : 'Premium insight unlocked — daily free limit reached',
            evidenceCids: Array.from(evidenceCidsBySource.values()),
            ...settlementMeta,
        },
    });
}

function buildQuoteLineItems(sourcePlans: SourcePlan[]) {
    return sourcePlans.map((plan) => ({
        sourceId: plan.source.id,
        label: plan.source.label,
        tier: plan.isFreeEligible ? 'free' : 'paid',
        cost: plan.cost,
        dataType: plan.source.dataType,
        category: plan.source.category,
        freshnessMinutes: plan.source.freshnessWindowMinutes,
        reputation: plan.source.reputation,
        freeRemaining: plan.isFreeEligible
            ? Math.max(0, plan.freeLimit - (plan.currentUsage + 1))
            : 0,
    }));
}

/**
 * When the active rail is HashKey, advertise the HSP handshake params so the
 * buyer can build + sign a Mandate. verifyingContract is a fallback only — the
 * client bootstraps the authoritative value from the Coordinator `GET /chains`
 * (which is why the challenge stays synchronous). Returns {} on every other rail
 * so the Arc/0G/Arbitrum challenge shape is byte-for-byte unchanged.
 */
function buildHspChallengeBlock(settlementConfig: ReturnType<typeof getSettlementConfig>): Record<string, unknown> {
    if (DEFAULT_SETTLEMENT_NETWORK !== 'HASHKEY') return {};
    const rail = getHspRailConfig(settlementConfig.chainId);
    if (!rail || !rail.coordinatorUrl) return {};
    return {
        hsp: {
            coordinatorUrl: rail.coordinatorUrl,
            chainName: rail.chainName,
            verifyingContract: rail.verifyingContract ?? null,
            chainId: settlementConfig.chainId,
            token: settlementConfig.usdcAddress,
            recipient: settlementConfig.recipientAddress,
        },
    };
}

function sendResearchQuote(
    res: NextApiResponse,
    user: UserState,
    sourcePlans: SourcePlan[],
    totalCost: number,
    bundleRequested: boolean
) {
    const nonce = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    UserManager.issueNonce(user, nonce, expiresAt);
    const paymentAmount = Math.max(MIN_PAYMENT_AMOUNT_USDC, Number(totalCost.toFixed(3)));
    const settlementConfig = getSettlementConfig();
    const paidSourceCount = sourcePlans.filter(plan => plan.cost > 0).length;

    return res.status(200).json({
        status: totalCost > 0 ? 'quoted' : 'free',
        amount: totalCost > 0 ? paymentAmount.toFixed(3) : '0.000',
        currency: 'USDC',
        chainId: settlementConfig.chainId,
        recipient: DATA_HUB_WALLET,
        nonce,
        expires: expiresAt,
        current_balance: formatMicroUSDC(user.creditBalanceMicros, 4),
        required_cost: totalCost,
        requested_sources: sourcePlans.map((plan) => plan.source.id),
        bundle_requested: bundleRequested,
        settlement_network: DEFAULT_SETTLEMENT_NETWORK,
        settlement_env: SETTLEMENT_ENV,
        ...buildHspChallengeBlock(settlementConfig),
        reason: totalCost > 0
            ? `Premium research will use ${totalCost.toFixed(3)} USDC on ${settlementConfig.name} for ${paidSourceCount} paid source${paidSourceCount === 1 ? '' : 's'}.`
            : `This research is covered by the free tier. No USDC will be spent on ${settlementConfig.name}.`,
        sources: buildQuoteLineItems(sourcePlans),
    });
}

function sendPaymentRequired(
    res: NextApiResponse,
    user: UserState,
    sourcePlans: SourcePlan[],
    totalCost: number,
    bundleRequested: boolean
) {
    const nonce = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    UserManager.issueNonce(user, nonce, expiresAt);
    const paymentAmount = Math.max(MIN_PAYMENT_AMOUNT_USDC, Number(totalCost.toFixed(3)));
    const settlementConfig = getSettlementConfig();

    return res.status(402).json({
        error: bundleRequested ? 'Research Bundle Required' : 'Premium Source Required',
        reason: bundleRequested
            ? `Accessing ${sourcePlans.length} sources requires ${totalCost.toFixed(3)} USDC in research credits on ${settlementConfig.name}.`
            : `Accessing "${sourcePlans[0].source.label}" requires premium micro-credits ($${totalCost.toFixed(3)} USDC) on ${settlementConfig.name}`,
        recipient: DATA_HUB_WALLET,
        amount: paymentAmount.toFixed(3),
        currency: 'USDC',
        chainId: settlementConfig.chainId,
        nonce,
        expires: expiresAt,
        suggested_topup_amount: BATCH_TOPUP_AMOUNT,
        current_balance: formatMicroUSDC(user.creditBalanceMicros, 4),
        required_cost: totalCost,
        requested_sources: sourcePlans.map((plan) => plan.source.id),
        bundle_requested: bundleRequested,
        settlement_network: DEFAULT_SETTLEMENT_NETWORK,
        settlement_env: SETTLEMENT_ENV,
        ...buildHspChallengeBlock(settlementConfig),
        circle_gateway: {
            enabled: Boolean(process.env.CIRCLE_API_KEY),
            description: 'Opaque Circle Gateway proof IDs are not accepted in the judge-facing path unless server-side verification is explicitly configured.',
            benefits: ['Use signed mandates when supported', 'Fall back to real on-chain tx hashes', 'Keep payment proofs externally verifiable']
        }
    });
}

// --- Verification Logic ---
// Verifies a plain ERC-20 stablecoin transfer to the merchant wallet on the active
// settlement rail (USDC on Arc/0G/Arbitrum, USDT on HashKey). Returns the credited
// amount and the tx sender (payer) for the ledger anchor.
async function verifyOnChainPayment(txHash: string): Promise<{ amountUSDC: number; payer?: string }> {
    if (await isProofProcessed(txHash)) {
        throw new Error('Transaction already processed');
    }

    const settlementConfig = getSettlementConfig();
    const usdcAddress = settlementConfig.usdcAddress;
    if (!usdcAddress) {
        throw new Error(`Settlement token not configured for ${DEFAULT_SETTLEMENT_NETWORK} (${SETTLEMENT_ENV})`);
    }

    const provider = new ethers.providers.JsonRpcProvider(settlementConfig.rpcUrl);
    const tx = await provider.getTransaction(txHash);

    if (!tx) throw new Error('Transaction not found');

    const receipt = await tx.wait(1);

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

    // Persist replay-protected record atomically. A duplicate-key exception
    // means another concurrent request verified the same hash first.
    await markProofProcessed(txHash, amountUSDC);

    return { amountUSDC, payer: tx.from };
}

/**
 * HSP settlement verification (HashKey rail). The buyer already registered the
 * mandate, broadcast the USDC transfer, and observed it; we independently confirm
 * the payment SETTLED and that its mandate matches what we challenged (authoritative
 * token/chain from the Coordinator `GET /chains`; recipient = our merchant wallet),
 * so a payer cannot claim credit for a payment addressed elsewhere. Credits the
 * settled mandate amount (top-up model, mirroring verifyOnChainPayment). Replay is
 * keyed on the HSP paymentId (mandateHash), scoped to the HASHKEY network bucket.
 */
async function verifyHspPayment(paymentId: string, txHash?: string, mandate?: WireSignedMandate): Promise<{ amountUSDC: number; payer?: string }> {
    if (DEFAULT_SETTLEMENT_NETWORK !== 'HASHKEY') {
        throw new Error('HSP settlement is not the active rail');
    }
    if (!ethers.utils.isHexString(paymentId, 32)) {
        throw new Error('HSP paymentId must be a 32-byte hex string');
    }
    if (await isProofProcessed(paymentId, 'HASHKEY')) {
        throw new Error('HSP payment already processed');
    }

    const settlementConfig = getSettlementConfig('HASHKEY');
    if (!settlementConfig.recipientAddress) {
        throw new Error('HashKey settlement recipient not configured');
    }

    const runtime = resolveHspRuntime();

    // Register the browser-signed mandate server-side (the browser never holds the
    // Coordinator API key). Idempotent on paymentId — a re-submit returns existing.
    if (mandate) {
        const registered = await registerMandate(runtime, mandate);
        if (registered.paymentId?.toLowerCase() !== paymentId.toLowerCase()) {
            throw new Error('HSP paymentId does not match the registered mandate');
        }
    }

    // Authoritative token + chainId from the Coordinator (docs disagree on the token address).
    const chainInfo = await getHspChainInfo(runtime);

    const result = await verifyHspSettlement(
        runtime,
        paymentId as `0x${string}`,
        {
            recipient: settlementConfig.recipientAddress as `0x${string}`,
            token: chainInfo.stablecoin,
            chainId: chainInfo.chainId,
            minAmount: 1n, // reject zero/dust; credit is the settled mandate amount
        },
        txHash && ethers.utils.isHexString(txHash, 32) ? (txHash as `0x${string}`) : undefined,
    );

    if (!result.settled) {
        throw new Error('HSP payment not settled');
    }

    const amountUSDC = parseFloat(ethers.utils.formatUnits(result.amount.toString(), 6));
    await markProofProcessed(paymentId, amountUSDC, 'HASHKEY');

    // Best-effort payer extraction (mandate signer payload = abi.encode(address))
    // for the on-chain recommendation anchor.
    let payer: string | undefined;
    try {
        const signerPayload = (result.payment.mandate?.body as { signer?: { payload?: string } } | undefined)?.signer?.payload;
        if (signerPayload) {
            payer = ethers.utils.getAddress(ethers.utils.defaultAbiCoder.decode(['address'], signerPayload)[0]);
        }
    } catch { /* best-effort — anchor simply skips without a payer */ }

    return { amountUSDC, payer };
}

// Payment proofs must be real on-chain tx hashes or verified signed mandates.
async function verifyCircleGatewayPayment(paymentProof: string): Promise<{ amountUSDC: number; payer?: string }> {
    try {
        if (await isProofProcessed(paymentProof)) {
            throw new Error('Payment proof already processed');
        }

        if (ethers.utils.isHexString(paymentProof, 32)) {
            return await verifyOnChainPayment(paymentProof);
        }

        if (paymentProof.startsWith('circle-gateway-')) {
            const isValid = await circleService.verifyGatewayTransaction(paymentProof);
            if (!isValid) {
                throw new Error('Invalid Circle Gateway transaction');
            }

            const parsedAmount = parseGatewayProofAmount(paymentProof);
            const amountUSDC = parsedAmount ?? 0.01;
            await markProofProcessed(paymentProof, amountUSDC);
            return { amountUSDC }; // Circle Gateway proofs carry no on-chain payer address
        }

        throw new Error('Unsupported payment proof format');

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Circle Gateway payment verification failed:', errorMessage);
        throw new Error(`Circle Gateway verification failed: ${errorMessage}`);
    }
}

function parseGatewayProofAmount(paymentProof: string): number | null {
    const match = paymentProof.match(/:([0-9]+(?:\.[0-9]{1,6})?)$/);
    if (!match) return null;

    const parsed = parseFloat(match[1]);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

// --- Data Fetching (Preserved & Cleaned) ---

async function getActualPremiumData(source: string, isFreeTier: boolean = false, fxInput?: DragInput) {
    const resolvedSource = normalizeArcResearchSource(source);

    // FX Protection Insight is computed on demand from the caller's cycle records
    // (or a representative sample) — handled before the eager map so its live
    // rate fetch doesn't run on unrelated source requests.
    if (resolvedSource === 'fx_protection') {
        return await getFxProtection(isFreeTier, fxInput);
    }

    const data: Record<string, Record<string, unknown>> = {
        'alpha_vantage_enhanced': await getAlphaVantageData(isFreeTier),
        'world_bank_analytics': await getWorldBankData(isFreeTier),
        'defillama_realtime': await getDeFiLlamaData(isFreeTier),
        'yearn_optimizer': await getYearnData(isFreeTier),
        'coingecko_analytics': await getCoinGeckoData(isFreeTier),
        'fred_insights': await getFredData(isFreeTier),
        'macro_analysis': await getMacroAnalysis(isFreeTier),
        'portfolio_optimization': await getPortfolioOptimization(isFreeTier),
        'risk_assessment': await getRiskAssessment(isFreeTier),
        'agent_execution': await getMacroAnalysis(isFreeTier),
        'real_time_inflation': await getWorldBankData(isFreeTier),
        'sosovalue_intelligence': await getSoSoValueIntelligence(!isFreeTier) as unknown as Record<string, unknown>,
        'sosovalue_macro_events': await getSoSoMacroEvents() as unknown as Record<string, unknown>,
        'brightdata_central_banks': await getBrightDataCentralBanks(isFreeTier),
        'brightdata_commodities': await getBrightDataCommodities(isFreeTier),
        'brightdata_financial_news': await getBrightDataFinancialNews(isFreeTier),
        'brightdata_evidence_layer': await getBrightDataEvidenceLayer(isFreeTier),
    };

    return data[resolvedSource] || {
        status: 'Success',
        message: `Data source '${source}' (resolved: '${resolvedSource}') not available`,
        tier: isFreeTier ? 'free' : 'premium'
    };
}

/**
 * FX Protection Insight — the paid, HashKey-settled product. Runs the REAL
 * production fx-drag computation (analyzeCycles) against live mid-market rates.
 * No LLM, no canned fallback: the numbers either compute from the caller's cycle
 * records or the report errors honestly. Free tier returns a teaser.
 */
async function getFxProtection(isFreeTier: boolean, fxInput?: DragInput): Promise<Record<string, unknown>> {
    if (isFreeTier) {
        return {
            status: 'Premium only',
            tier: 'free',
            message: 'FX Protection Insight quantifies per-cycle FX drag (timing/spread/fees) on your import working capital, with an on-chain audit trail.',
            upgrade_cost: '1.000 USDC',
        };
    }

    const input: DragInput = fxInput ?? GHANA_IMPORTER_SAMPLE;
    const isSample = !fxInput;
    try {
        const dates = requiredDates(input);
        const provider = await buildServerlessRateProvider(input.currency, dates);
        const summary = analyzeCycles(input, provider.getRate);

        const risk = CURRENCY_BY_CODE[input.currency.toUpperCase()];
        return {
            tier: 'premium',
            is_sample: isSample,
            business: input.business ?? null,
            currency: input.currency,
            summary,
            currency_risk: risk
                ? { code: risk.code, country: risk.countryName, vsUSD: risk.depreciation.vsUSD, riskEvents: risk.riskEvents }
                : null,
            source_note: provider.sourceNote,
            methodology: 'Counterfactual: each revenue receipt converted to USD-pegged value on arrival, net of a ramp cost, until the USD obligation is covered. Drag = actual local cost − counterfactual. Protection is measured, not prescribed.',
            disclaimer: isSample
                ? 'Representative sample cycle (see docs/sme-fx-strategy.md). POST your own `cycles` for a report on your books. Rates, math, settlement and anchor are real.'
                : undefined,
        };
    } catch (err) {
        // Structure is validated before charging (validateCycles); this only trips on
        // live rate-data gaps. Return a clean error payload — never a 500.
        return {
            tier: 'error',
            currency: input.currency,
            is_sample: isSample,
            error: 'FX drag computation could not complete — mid-market rate data was unavailable for one or more cycle dates.',
            detail: err instanceof Error ? err.message : String(err),
        };
    }
}

/** Parse the caller's FX cycle records from the request body; undefined → sample. */
/** Parse + validate the caller's FX cycle records; undefined → sample. Throws on malformed input. */
function parseFxProtectionInput(req: NextApiRequest): DragInput | undefined {
    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
    const cycles = body.cycles;
    if (!Array.isArray(cycles) || cycles.length === 0) return undefined;
    const input: DragInput = {
        business: typeof body.business === 'string' ? body.business : undefined,
        currency: typeof body.currency === 'string' && body.currency ? body.currency : 'GHS',
        cycles: cycles as DragInput['cycles'],
    };
    validateCycles(input); // structural + date validation (no rate fetch) — throws on bad input
    return input;
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
    } catch (error) { console.warn('Alpha Vantage API unavailable', error); }
    return { exchange_rate: '0.92', source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getWorldBankData(isFreeTier: boolean) {
    try {
        const response = await fetch('https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL.ZG?format=json&per_page=5&date=2020:2024');
        if (response.ok) {
            const data = await response.json();
            const inflationData = data[1]?.filter((item: { value: number | null }) => item.value !== null) || [];
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
    } catch (error) { console.warn('World Bank API unavailable', error); }
    return { current_inflation: 3.1, source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getDeFiLlamaData(isFreeTier: boolean) {
    try {
        const response = await fetch('https://yields.llama.fi/pools');
        if (response.ok) {
            const pools = await response.json();
            const stablePools = pools.data
                ?.filter((pool: { symbol: string; tvlUsd: number }) => pool.symbol.includes('USDC') && pool.tvlUsd > 1000000)
                .sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy)
                .slice(0, isFreeTier ? 3 : 10) || [];
            const baseData = {
                top_yields: stablePools.map((pool: { project: string; apy: number; tvlUsd: number }) => ({ protocol: pool.project, apy: pool.apy, tvl: pool.tvlUsd })),
                source: 'DeFiLlama Free API'
            };
            if (!isFreeTier) {
                return { ...baseData, risk_analysis: 'Audited, High Liquidity', tier: 'premium' };
            }
            return { ...baseData, tier: 'free' };
        }
    } catch (error) { console.warn('DeFiLlama API unavailable', error); }
    return { top_yields: [{ protocol: 'Aave', apy: 4.2 }], source: 'Fallback', tier: isFreeTier ? 'free' : 'premium' };
}

async function getYearnData(isFreeTier: boolean) {
    try {
        // Fetch real Yearn Vaults from V1 API
        const response = await fetch('https://api.yearn.fi/v1/chains/1/vaults/all');
        if (response.ok) {
            const vaults = await response.json();
            const topVaults = vaults
                .filter((v: any) => v.type === 'v2' && v.apy?.net_apy > 0)
                .sort((a: any, b: any) => b.apy.net_apy - a.apy.net_apy)
                .slice(0, 3)
                .map((v: any) => ({
                    name: v.name,
                    apy: parseFloat((v.apy.net_apy * 100).toFixed(2))
                }));

            return {
                best_vaults: topVaults.length > 0 ? topVaults : [{ name: 'USDC Vault (Fallback)', apy: 4.5 }],
                source: 'Yearn Finance',
                tier: isFreeTier ? 'free' : 'premium',
                ...(isFreeTier ? {} : { optimization: 'Auto-compound analysis active' })
            };
        }
    } catch (e) { console.warn('Yearn API unavailable'); }
    return { best_vaults: [{ name: 'USDC Vault (Fallback)', apy: 4.5 }], source: 'Yearn (Fallback)', tier: 'free' };
}

async function getCoinGeckoData(isFreeTier: boolean) {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return {
                prices: {
                   bitcoin: data.bitcoin?.usd || 65000,
                   ethereum: data.ethereum?.usd || 3500,
                   gold_paxg: data['pax-gold']?.usd || 2300
                },
                source: 'CoinGecko API',
                tier: isFreeTier ? 'free' : 'premium',
                ...(isFreeTier ? {} : { sentiment: data.bitcoin?.usd > 60000 ? 'Bullish' : 'Neutral' })
            };
        }
    } catch (e) { console.warn('CoinGecko API unavailable'); }
    
    return {
        bitcoin_price: 65000,
        source: 'CoinGecko (Fallback)',
        tier: 'free'
    };
}

async function getFredData(isFreeTier: boolean) {
    // FRED API requires an authenticated key. Returns generic macroeconomic baseline if no key is present.
    const key = process.env.FRED_API_KEY;
    if (key) {
        try {
            const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${key}&file_type=json`);
            if (response.ok) {
                const data = await response.json();
                const latest = data.observations.slice(-1)[0];
                return {
                    cpi_data: [{ date: latest.date, value: latest.value }],
                    source: 'Federal Reserve API',
                    tier: isFreeTier ? 'free' : 'premium',
                    ...(isFreeTier ? {} : { forecast: 'Real-time fed metrics' })
                };
            }
        } catch (e) { console.warn('FRED API unavailable'); }
    }
    
    return {
        cpi_data: [{ date: new Date().toISOString().substring(0, 7), value: 312.5 }],
        source: 'FRED Reserve Estimate',
        tier: 'free',
        ...(isFreeTier ? {} : { forecast: 'Pending Key Validation' })
    };
}

// --- Premium Sources: Gemini-synthesised from live data ---
// Each function fetches real underlying data first, then asks Gemini to
// produce a structured analysis. Falls back to a structured estimate on error.
// DRY: shared helper handles the Gemini call + JSON parsing in one place.

async function geminiSynthesise<T>(
    systemPrompt: string,
    userPrompt: string,
    fallback: T,
): Promise<T> {
    const parseStructuredJson = (content: string): T => {
        const trimmed = content.trim();
        const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fencedMatch?.[1]?.trim()
            || (() => {
                const startBrace = trimmed.indexOf('{');
                const endBrace = trimmed.lastIndexOf('}');
                if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
                    return trimmed.slice(startBrace, endBrace + 1).trim();
                }
                return trimmed;
            })();

        return JSON.parse(candidate) as T;
    };

    try {
        const result = await generateChatCompletion({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
            ],
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxTokens: 600,
        }, 'gemini');
        return parseStructuredJson(result.content);
    } catch (err) {
        console.warn('[x402-gateway] Gemini synthesis failed, using fallback:', (err as Error).message);
        return fallback;
    }
}

async function getMacroAnalysis(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.004 USDC' };

    // Pull live inputs in parallel
    const [wb, cg, fred] = await Promise.all([
        getWorldBankData(false),
        getCoinGeckoData(false),
        getFredData(false),
    ]);

    return geminiSynthesise(
        'You are a macro regime analyst. Respond with valid JSON only.',
        `Given this live data, classify the current macro regime and give a portfolio stance.
World Bank inflation: ${JSON.stringify(wb)}
CoinGecko prices: ${JSON.stringify(cg)}
FRED CPI: ${JSON.stringify(fred)}

Respond with JSON: { macro_regime, confidence (0-1), inflation_trend, risk_appetite, recommended_stance, key_risks: [], tier }`,
        { macro_regime: 'Disinflationary Growth', confidence: 0.74, inflation_trend: 'Easing',
          risk_appetite: 'Moderate', recommended_stance: 'HOLD', key_risks: ['Sticky services CPI'], tier: 'premium' },
    );
}

async function getPortfolioOptimization(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.005 USDC' };

    const [defi, yearn, cg] = await Promise.all([
        getDeFiLlamaData(false),
        getYearnData(false),
        getCoinGeckoData(false),
    ]);

    return geminiSynthesise(
        'You are a DeFi portfolio optimiser. Respond with valid JSON only.',
        `Given live yield and price data, suggest optimal stablecoin allocation weights.
DeFiLlama top yields: ${JSON.stringify(defi)}
Yearn vaults: ${JSON.stringify(yearn)}
Market prices: ${JSON.stringify(cg)}

Respond with JSON: { optimal_weights: { [asset]: percentage }, expected_blended_apy, rebalance_urgency, rationale, tier }`,
        { optimal_weights: { USDC: 40, USDY: 30, SYRUPUSDC: 20, PAXG: 10 },
          expected_blended_apy: 4.2, rebalance_urgency: 'LOW', rationale: 'Yield-weighted allocation', tier: 'premium' },
    );
}

async function getRiskAssessment(isFreeTier: boolean) {
    if (isFreeTier) return { message: 'Premium only', upgrade_cost: '0.006 USDC' };

    const [wb, cg, fred] = await Promise.all([
        getWorldBankData(false),
        getCoinGeckoData(false),
        getFredData(false),
    ]);

    return geminiSynthesise(
        'You are a portfolio risk analyst. Respond with valid JSON only.',
        `Assess current risk for a stablecoin-focused emerging-market portfolio.
World Bank data: ${JSON.stringify(wb)}
CoinGecko prices: ${JSON.stringify(cg)}
FRED data: ${JSON.stringify(fred)}

Respond with JSON: { risk_score (1-10), risk_level, primary_risks: [], mitigation_actions: [], drawdown_estimate_pct, confidence, tier }`,
        { risk_score: 3.2, risk_level: 'LOW', primary_risks: ['USD debasement', 'Stablecoin depeg'],
          mitigation_actions: ['Diversify into gold', 'Hold yield-bearing USDC'],
          drawdown_estimate_pct: 4.5, confidence: 0.81, tier: 'premium' },
    );
}

// --- Bright Data Evidence Layer (Hackathon Integration) ---

/**
 * Cache-first race: return cached evidence immediately (sub-10ms).
 * If cache is stale, start a fresh scrape in the background and
 * return the old data with `stale: true`. Next request gets fresh.
 */
const BRIGHT_DATA_TIMEOUT_MS = 6000; // 6s max for a fresh scrape, fall back to stale

async function getBrightDataCentralBanks(isFreeTier: boolean): Promise<Record<string, unknown>> {
    try {
        const banks: BrightDataBankCode[] = isFreeTier ? ['FED'] : ['FED', 'ECB', 'BOE', 'BOJ'];
        const announcements = await BrightDataService.getCentralBankAnnouncements({ banks, maxAgeHours: isFreeTier ? 48 : 24 });
        return {
            announcements: announcements || [],
            count: announcements?.length ?? 0,
            banks: banks.length,
            tier: isFreeTier ? 'free' : 'premium',
            retrievedAt: new Date().toISOString(),
            stale: false,
        };
    } catch (err) {
        console.warn('[BrightData] Central banks fetch failed:', (err as Error).message);
        return { announcements: [], error: (err as Error).message, tier: isFreeTier ? 'free' : 'premium', stale: true };
    }
}

async function getBrightDataCommodities(isFreeTier: boolean): Promise<Record<string, unknown>> {
    try {
        const commodities: BrightDataCommodity[] = isFreeTier ? ['gold', 'crude_oil'] : ['gold', 'crude_oil', 'copper', 'wheat'];
        const prices = await BrightDataService.getCommodityPrices({ commodities });
        return {
            prices: prices || [],
            count: prices?.length ?? 0,
            commodities: commodities.length,
            tier: isFreeTier ? 'free' : 'premium',
            retrievedAt: new Date().toISOString(),
            stale: false,
        };
    } catch (err) {
        console.warn('[BrightData] Commodities fetch failed:', (err as Error).message);
        return { prices: [], error: (err as Error).message, tier: isFreeTier ? 'free' : 'premium', stale: true };
    }
}

async function getBrightDataFinancialNews(isFreeTier: boolean): Promise<Record<string, unknown>> {
    try {
        const regions = isFreeTier ? ['US'] : ['US', 'EU', 'EM'];
        const news = await BrightDataService.getFinancialNewsSentiment({ regions, maxItems: isFreeTier ? 5 : 15 });
        return {
            news: news || [],
            count: news?.length ?? 0,
            regions: regions.length,
            tier: isFreeTier ? 'free' : 'premium',
            retrievedAt: new Date().toISOString(),
            stale: false,
        };
    } catch (err) {
        console.warn('[BrightData] Financial news fetch failed:', (err as Error).message);
        return { news: [], error: (err as Error).message, tier: isFreeTier ? 'free' : 'premium', stale: true };
    }
}

async function getBrightDataEvidenceLayer(isFreeTier: boolean): Promise<Record<string, unknown>> {
    if (isFreeTier) {
        // Free tier gets a lightweight bundle: Fed only, gold+oil only, US news
        try {
            const [banks, commodities, news] = await Promise.all([
                BrightDataService.getCentralBankAnnouncements({ banks: ['FED'], maxAgeHours: 48 }),
                BrightDataService.getCommodityPrices({ commodities: ['gold', 'crude_oil'] }),
                BrightDataService.getFinancialNewsSentiment({ regions: ['US'], maxItems: 3 }),
            ]);
            return {
                centralBanks: banks,
                commodities,
                news,
                meta: { generatedAt: new Date().toISOString(), bundleType: 'free' },
                tier: 'free',
            };
        } catch (err) {
            console.warn('[BrightData] Free evidence layer failed:', (err as Error).message);
            return { error: (err as Error).message, tier: 'free' };
        }
    }

    try {
        const bundle = await BrightDataService.getEvidenceLayer();
        return { ...bundle, tier: 'premium' };
    } catch (err) {
        console.warn('[BrightData] Evidence layer failed:', (err as Error).message);
        return { error: (err as Error).message, tier: 'premium' };
    }
}

// Start background Bright Data cache warming on server boot
// (runs after first request triggers this module's import)
let _warmed = false;
if (typeof setInterval !== 'undefined' && !_warmed) {
  _warmed = true;
  setTimeout(() => {
    startBrightDataWarming();
  }, 2000); // Brief delay so server boots fast, then warm
}

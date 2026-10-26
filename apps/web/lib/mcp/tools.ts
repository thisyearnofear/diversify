/**
 * MCP tool definitions — each wraps an existing function. Read-only by
 * default; owner-only tools verify a wallet signature and propose_move
 * files a proposal, never executes.
 */
import { getCurrencyRisk, CURRENCY_RISK_DATA_AS_OF } from '@/constants/currency-risk';
import { buildCurrencyMoment } from '@/lib/narrative/currency-moment';
import { corridorFor, corridorSignalsFor, currencyRiskAsOfLabel } from '@/lib/corridor-context';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';
import { buildFxCycleReport } from '@/lib/server/fx-cycle-report';
import {
  verifyLedgerTx,
  buildLedgerExplorerUrl,
  getDefaultLedgerChainId,
} from '@diversifi/shared/src/services/recommendation-ledger.service';
import { fetchMultiChainProofFeed } from '@/pages/api/agent/zero-g-ledger';
import { attachLedgerReasoning } from '@/lib/ledger-reasoning-store';
import { fetchRwaMarket } from '@diversifi/shared/src/services/rwa-market-service';
import { verifyWalletAuth } from '@/lib/require-wallet-auth';
import { enqueueRecommendation, getGuardianState } from '@/lib/vault/guardian-state';
import { NETWORK_TOKENS, NETWORKS } from '@/config';
import type { McpTool } from './server';

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'fx_risk_moment',
    description: 'Read-only: the curated currency-risk moment for a country (depreciation vs a benchmark over a horizon).',
    inputSchema: {
      type: 'object',
      required: ['country'],
      properties: {
        country: { type: 'string', description: 'ISO-3166-1 alpha-2' },
        benchmark: { type: 'string', enum: ['USD', 'EUR', 'XAU'] },
        horizon: { type: 'string', enum: ['1Y', '3Y', '5Y'] },
        savingsAmount: { type: 'number' },
      },
    },
  },
  {
    name: 'corridor_signals',
    description: 'Read-only: dated, cited macro beats for a token corridor. Empty when none exist.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to'],
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
  },
  {
    name: 'token_provenance',
    description: 'Read-only: curated issuer/reserve/freeze claims for a token, each with an asOf date.',
    inputSchema: {
      type: 'object',
      required: ['symbol'],
      properties: { symbol: { type: 'string' } },
    },
  },
  {
    name: 'fx_cycle_report',
    description: 'Read-only: payment-readiness scenario — modeled currency drag vs estimated protection costs. Illustrative, not a quote.',
    inputSchema: {
      type: 'object',
      required: ['localCurrency', 'targetAmount', 'paymentDate'],
      properties: {
        localCurrency: { type: 'string' },
        targetAmount: { type: 'number' },
        paymentDate: { type: 'string' },
        targetCurrency: { type: 'string', enum: ['USD'] },
      },
    },
  },
  {
    name: 'ledger_verify',
    description: 'Read-only: verifies a tx hash against the on-chain RecommendationLedger.',
    inputSchema: {
      type: 'object',
      required: ['txHash'],
      properties: { txHash: { type: 'string' }, chainId: { type: 'number' } },
    },
  },
  {
    name: 'ledger_recent',
    description: 'Read-only: recent on-chain recommendation records across the proof-feed chains, with reasoning echoes when anchored.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' }, chainId: { type: 'number' } },
    },
  },
  {
    name: 'rwa_market',
    description: 'Read-only: live tokenized-asset market figures (yields, prices). Reports unavailability rather than stale numbers.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'plan_alignment',
    description: 'Owner-only (requires walletAuth signature): the plan/targets the server-side Guardian state holds, plus the decision log. The device-local protection profile is not visible to the server.',
    inputSchema: {
      type: 'object',
      required: ['walletAuth'],
      properties: {
        walletAuth: {
          type: 'object',
          required: ['message', 'signature'],
          properties: { message: { type: 'string' }, signature: { type: 'string' } },
        },
      },
    },
  },
  {
    name: 'guardian_journal',
    description: 'Owner-only (requires walletAuth signature): the Guardian queue, decision log, anchor history and activity stats as stored server-side.',
    inputSchema: {
      type: 'object',
      required: ['walletAuth'],
      properties: {
        walletAuth: {
          type: 'object',
          required: ['message', 'signature'],
          properties: { message: { type: 'string' }, signature: { type: 'string' } },
        },
      },
    },
  },
  {
    name: 'propose_move',
    description: 'Owner-only (requires walletAuth signature): files a proposal into the Guardian queue; never executes — the owner reviews and signs in Exchange.',
    inputSchema: {
      type: 'object',
      required: ['walletAuth', 'fromToken', 'toToken', 'amountUsd', 'reason'],
      properties: {
        walletAuth: {
          type: 'object',
          required: ['message', 'signature'],
          properties: { message: { type: 'string' }, signature: { type: 'string' } },
        },
        fromToken: { type: 'string' },
        toToken: { type: 'string' },
        amountUsd: { type: 'number' },
        reason: { type: 'string' },
      },
    },
  },
];

const asOf = () => new Date().toISOString();

function requireAuth(args: Record<string, unknown>): string {
  const auth = args.walletAuth as { message?: string; signature?: string } | undefined;
  if (typeof auth?.message !== 'string' || typeof auth.signature !== 'string') {
    throw new Error('walletAuth { message, signature } is required');
  }
  const address = verifyWalletAuth(auth.message, auth.signature);
  if (!address) throw new Error('walletAuth signature invalid or expired');
  return address;
}

const HORIZON_MAP: Record<string, '1yr' | '3yr' | '5yr'> = { '1Y': '1yr', '3Y': '3yr', '5Y': '5yr' };

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'fx_risk_moment': {
      const entry = typeof args.country === 'string' ? getCurrencyRisk(args.country) : null;
      if (!entry) throw new Error('Unknown or unsupported country');
      const benchmark = (args.benchmark as 'USD' | 'EUR' | 'XAU') ?? 'USD';
      const horizon = HORIZON_MAP[String(args.horizon ?? '1Y').toUpperCase()] ?? '1yr';
      const moment = buildCurrencyMoment({
        entry,
        benchmark,
        horizon,
        savingsAmount: typeof args.savingsAmount === 'number' ? args.savingsAmount : 1000,
        dataAsOf: CURRENCY_RISK_DATA_AS_OF,
      });
      return { moment, asOf: currencyRiskAsOfLabel(), source: 'curated dataset' };
    }

    case 'corridor_signals': {
      if (typeof args.from !== 'string' || typeof args.to !== 'string') {
        throw new Error('from and to are required');
      }
      const feed = await fetchMultiChainProofFeed(25);
      const recent = await attachLedgerReasoning(feed.recent);
      const signals = corridorSignalsFor(recent, args.from, args.to);
      return { corridor: corridorFor(args.from, args.to) ?? null, signals, asOf: asOf(), source: 'on-chain ledger feed' };
    }

    case 'token_provenance': {
      if (typeof args.symbol !== 'string') throw new Error('symbol is required');
      const provenance = provenanceFor(args.symbol);
      return provenance
        ? { symbol: args.symbol, provenance, asOf: asOf(), source: 'curated dataset' }
        : { symbol: args.symbol, provenance: null, note: 'No curated provenance entry', asOf: asOf() };
    }

    case 'fx_cycle_report': {
      const report = await buildFxCycleReport(args as never);
      return { ...report, asOf: asOf() };
    }

    case 'ledger_verify': {
      if (typeof args.txHash !== 'string') throw new Error('txHash is required');
      const chainId = typeof args.chainId === 'number' ? args.chainId : undefined;
      const v = await verifyLedgerTx(args.txHash, chainId);
      const resolvedChain = chainId ?? getDefaultLedgerChainId();
      return {
        verified: v.found && v.status === 1 && v.isLedgerContract === true,
        found: v.found,
        status: v.status,
        isLedgerContract: v.isLedgerContract ?? null,
        chainId: resolvedChain,
        explorerUrl: v.explorerUrl ?? buildLedgerExplorerUrl(args.txHash, resolvedChain),
        asOf: asOf(),
      };
    }

    case 'ledger_recent': {
      const limit = Math.min(25, Math.max(1, Number(args.limit) || 10));
      const feed = await fetchMultiChainProofFeed(limit);
      feed.recent = await attachLedgerReasoning(feed.recent);
      return { recent: feed.recent, stats: feed.stats, asOf: asOf(), source: 'on-chain ledger feed' };
    }

    case 'rwa_market': {
      try {
        const market = await fetchRwaMarket();
        return { market, available: true, asOf: asOf() };
      } catch {
        return { available: false, asOf: asOf() };
      }
    }

    case 'plan_alignment': {
      const address = requireAuth(args);
      const state = await getGuardianState(address);
      return {
        address,
        scope: 'server-side GuardianState only — the device-local protection profile is not visible to the server',
        latestRecommendation: state?.latestRecommendation ?? null,
        recommendationQueue: state?.recommendationQueue ?? [],
        decisionLog: (state?.decisionLog ?? []).slice(0, 8),
        asOf: asOf(),
      };
    }

    case 'guardian_journal': {
      const address = requireAuth(args);
      const state = await getGuardianState(address);
      return {
        address,
        recommendationQueue: state?.recommendationQueue ?? [],
        decisionLog: state?.decisionLog ?? [],
        anchorHistory: state?.latestAnchors ?? [],
        activityStats: state?.activityStats ?? null,
        asOf: asOf(),
      };
    }

    case 'propose_move': {
      const address = requireAuth(args);
      const from = String(args.fromToken ?? '').trim();
      const to = String(args.toToken ?? '').trim();
      const amount = Number(args.amountUsd);
      const reason = String(args.reason ?? '').slice(0, 280);
      const tradable = new Set([
        ...(NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId] ?? []),
        ...(NETWORK_TOKENS[NETWORKS.ARBITRUM_ONE.chainId] ?? []),
      ].map((s) => s.toUpperCase()));
      if (!tradable.has(from.toUpperCase()) || !tradable.has(to.toUpperCase())) {
        throw new Error('fromToken and toToken must be tradable on Celo or Arbitrum');
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
        throw new Error('amountUsd must be > 0 and ≤ 10000');
      }
      if (!reason) throw new Error('reason is required');
      const doc = await enqueueRecommendation(address, {
        capturedAt: asOf(),
        source: 'mcp',
        action: 'proposal',
        targetToken: to,
        oneLiner: `External agent proposal: swap ${amount} USD of ${from} into ${to}`,
        reasoning: reason,
        tradeAmountUSD: amount,
        confidence: 0,
        executionEligibility: 'manual_review',
        origin: 'mcp',
      });
      const queued = doc.recommendationQueue?.[0];
      return {
        queued: true,
        id: queued?.identityKey ?? null,
        note: 'Proposal only — filed by an external agent. The owner reviews and signs it in Exchange; nothing has moved.',
        asOf: asOf(),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

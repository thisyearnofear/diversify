/**
 * RWA vault allocation brain — SERV Hackathon Edition 01 (RWA Vaults / IXS).
 *
 * Two provenance-honest paths:
 *
 *   - FREE (default, no keys): `computeHeuristicAllocation` — a deterministic
 *     scorer over the static IXS catalog given the user's protection profile.
 *     Works with $0, no SERV key, offline-safe.
 *
 *   - SERV-ENHANCED (opt-in): `getRwaAllocation` with `servRequested: true`
 *     asks SERV Reasoning to re-weight the same catalog and explain the
 *     allocation, then validates the model's JSON strictly (known vault ids,
 *     normalized weights) and attaches a provenance receipt. ANY failure —
 *     missing key, timeout, 401/429 (expired credits), malformed JSON —
 *     falls back to the heuristic with `degradedReason` set. The free path
 *     can never regress because the SERV path wraps it.
 */

import { IXS_VAULTS, IXS_VAULT_BY_ID, isIxsVaultId, type IxsVault } from './ixs-vault-catalog';
import { callServReasoning, isServConfigured, type ServUsage } from './serv-reasoning-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllocationProfile {
  /** FinancialStrategy id, e.g. 'islamic' | 'confucian' | 'africapitalism' | 'inflation_protection'. */
  philosophy?: string | null;
  /** 'Conservative' | 'Balanced' | 'Aggressive' — anything else maps to Balanced. */
  riskTolerance?: string | null;
  region?: string | null;
  amountUsd?: number | null;
}

export interface VaultAllocation {
  vaultId: string;
  /** 0–100; the set always sums to 100. */
  weightPct: number;
  why: string;
}

export interface ServReceipt {
  provider: 'serv';
  model: string;
  effort: string;
  latencyMs: number;
  at: string;
  usage?: ServUsage;
}

export interface RwaAllocationResult {
  source: 'heuristic' | 'serv';
  allocations: VaultAllocation[];
  summary: string;
  receipt?: ServReceipt;
  /** Set when SERV was requested but could not enhance — allocation is the heuristic. */
  degradedReason?: string;
  servRequested: boolean;
  servAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Free path — deterministic heuristic scorer
// ---------------------------------------------------------------------------

const RISK_SCORE: Record<string, Record<'low' | 'medium' | 'elevated', number>> = {
  Conservative: { low: 10, medium: 3, elevated: 0.5 },
  Balanced: { low: 5, medium: 5, elevated: 1.5 },
  Aggressive: { low: 2, medium: 5, elevated: 4 },
};

const CONSERVATIVE_PHILOSOPHIES = new Set(['confucian', 'gotong_royong']);
const COMMUNITY_CREDIT_PHILOSOPHIES = new Set(['africapitalism', 'pan_caribbean', 'buen_vivir']);

function baseWhy(vault: IxsVault): string {
  return vault.blurb;
}

/**
 * Score every vault against the profile and normalize to a 100% allocation.
 * Pure + deterministic: same profile in → same allocation out. Vaults under
 * 2% after scoring are folded into the top allocation so the result stays
 * readable (never more than ~4 rows).
 */
export function computeHeuristicAllocation(profile: AllocationProfile): VaultAllocation[] {
  const risk = profile.riskTolerance === 'Conservative' || profile.riskTolerance === 'Aggressive'
    ? profile.riskTolerance
    : 'Balanced';
  const philosophy = (profile.philosophy ?? '').trim().toLowerCase();

  const scored: { vault: IxsVault; score: number; why: string }[] = IXS_VAULTS.map((vault) => {
    let score = RISK_SCORE[risk][vault.riskTier];
    const whyNotes: string[] = [baseWhy(vault)];

    if (philosophy === 'islamic') {
      if (vault.conventionalYield) {
        score *= 0.15;
        whyNotes.push('Conventional interest-bearing instrument — flagged under the Islamic Finance lens (no vault in this catalog is Sharia-certified).');
      }
    } else if (CONSERVATIVE_PHILOSOPHIES.has(philosophy)) {
      if (vault.riskTier === 'low') score *= 1.5;
      if (vault.riskTier === 'elevated') score *= 0.5;
    } else if (COMMUNITY_CREDIT_PHILOSOPHIES.has(philosophy)) {
      if (vault.assetClass === 'money_market') score *= 1.2;
      if (vault.assetClass === 'private_credit') {
        score *= 1.3;
        whyNotes.push('Private-credit tilt — the community-lending lens maps naturally to productive credit.');
      }
    } else if (philosophy === 'rwa_access') {
      score *= 1.1;
      if (vault.assetClass === 'private_credit') score *= 1.3;
    } else if (philosophy === 'inflation_protection') {
      if (vault.assetClass === 'corporate_bond' || vault.assetClass === 'btc_fixed_income') {
        score *= 1.3;
        whyNotes.push('Yield-bearing real asset — the inflation hedge leg.');
      }
    }

    if (profile.amountUsd != null && profile.amountUsd > 0 && profile.amountUsd < 500 && vault.assetClass === 'private_credit') {
      score *= 0.4;
      whyNotes.push('Term-bound liquidity is a poor fit for small working balances.');
    }

    return { vault, score, why: whyNotes.join(' ') };
  });

  const total = scored.reduce((s, r) => s + r.score, 0) || 1;
  const normalized = scored
    .map((r) => ({ vaultId: r.vault.id, raw: (r.score / total) * 100, why: r.why }))
    .sort((a, b) => b.raw - a.raw);

  // Fold anything under 2% into the top row so small slices don't litter the UI.
  const kept = normalized.filter((r) => r.raw >= 2);
  const dropped = normalized.filter((r) => r.raw < 2);
  if (dropped.length && kept.length) {
    kept[0].raw += dropped.reduce((s, r) => s + r.raw, 0);
  }

  // Round to whole percents while preserving the 100 total.
  const out = (kept.length ? kept : normalized.slice(0, 1)).map((r) => ({
    vaultId: r.vaultId,
    weightPct: Math.max(1, Math.round(r.raw)),
    why: r.why,
  }));
  const drift = 100 - out.reduce((s, r) => s + r.weightPct, 0);
  out[0].weightPct += drift;
  return out;
}

// ---------------------------------------------------------------------------
// SERV-enhanced path — re-weight + explain via SERV Reasoning
// ---------------------------------------------------------------------------

export const SERV_ALLOCATION_SYSTEM_PROMPT = `You are the DiversiFi Guardian allocating stablecoin capital across licensed IXS Finance RWA vaults (ERC-4626, Bahamas DARE Act, KYC at deposit). Respond with ONLY a JSON object — no prose, no markdown:

{"weights": {"<vaultId>": <number 0-100>, ...}, "rationale": {"<vaultId>": "<one sentence>"}, "summary": "<one sentence>"}

Rules: only use vault ids provided; weights must sum to 100; respect the user's values lens (e.g. islamic profiles minimize conventional interest-bearing vaults); respect the stated risk tolerance; indicative APY bands are not guarantees.`;

function buildServPrompt(profile: AllocationProfile, heuristic: VaultAllocation[]): string {
  const catalog = IXS_VAULTS.map((v) => ({
    id: v.id,
    name: v.name,
    assetClass: v.assetClass,
    riskTier: v.riskTier,
    indicativeApy: `${v.indicativeApyLow}–${v.indicativeApyHigh}%`,
    conventionalYield: v.conventionalYield,
    liquidity: v.liquidity,
  }));
  return [
    `User profile: ${JSON.stringify({
      philosophy: profile.philosophy ?? 'global',
      riskTolerance: profile.riskTolerance ?? 'Balanced',
      region: profile.region ?? null,
      amountUsd: profile.amountUsd ?? null,
    })}`,
    `Vault catalog: ${JSON.stringify(catalog)}`,
    `Heuristic baseline (improve or explain deviations): ${JSON.stringify(
      Object.fromEntries(heuristic.map((a) => [a.vaultId, a.weightPct])),
    )}`,
  ].join('\n');
}

interface ServAllocationJson {
  weights?: Record<string, unknown>;
  rationale?: Record<string, unknown>;
  summary?: unknown;
}

/** Strictly validate + normalize SERV's JSON. Throws on unusable output. */
function parseServAllocation(text: string): {
  weights: VaultAllocation[];
  rationale: Record<string, string>;
  summary: string;
} {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed: ServAllocationJson;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('serv returned non-JSON');
  }
  const weightsIn = parsed.weights;
  if (!weightsIn || typeof weightsIn !== 'object') throw new Error('serv response missing weights');

  const entries: { vaultId: string; raw: number }[] = [];
  for (const [id, w] of Object.entries(weightsIn)) {
    if (!isIxsVaultId(id)) continue; // ignore hallucinated vaults
    const n = typeof w === 'number' ? w : NaN;
    if (Number.isFinite(n) && n > 0) entries.push({ vaultId: id, raw: n });
  }
  if (!entries.length) throw new Error('serv returned no usable vault weights');

  const total = entries.reduce((s, e) => s + e.raw, 0);
  const weights = entries.map((e) => ({
    vaultId: e.vaultId,
    weightPct: Math.max(1, Math.round((e.raw / total) * 100)),
    why: '',
  }));
  const drift = 100 - weights.reduce((s, w) => s + w.weightPct, 0);
  weights[0].weightPct += drift;

  const rationale: Record<string, string> = {};
  if (parsed.rationale && typeof parsed.rationale === 'object') {
    for (const [id, r] of Object.entries(parsed.rationale)) {
      if (isIxsVaultId(id) && typeof r === 'string' && r.trim()) rationale[id] = r.trim();
    }
  }
  const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : 'SERV Reasoning weighted this allocation across the IXS licensed RWA catalog.';

  return { weights, rationale, summary };
}

/**
 * Allocate across IXS vaults. `servRequested` opts into the SERV Reasoning
 * enhancement; it only engages when `SERV_API_KEY` is configured server-side,
 * and every failure path returns the deterministic heuristic instead.
 */
export async function getRwaAllocation(
  profile: AllocationProfile,
  opts: { servRequested?: boolean } = {},
): Promise<RwaAllocationResult> {
  const servRequested = opts.servRequested === true;
  const servAvailable = isServConfigured();
  const heuristic = computeHeuristicAllocation(profile);
  const heuristicSummary =
    'Heuristic allocation across the IXS licensed RWA catalog — deterministic, no external call.';

  if (!servRequested) {
    return {
      source: 'heuristic',
      allocations: heuristic,
      summary: heuristicSummary,
      servRequested: false,
      servAvailable,
    };
  }
  if (!servAvailable) {
    return {
      source: 'heuristic',
      allocations: heuristic,
      summary: heuristicSummary,
      degradedReason: 'serv_not_configured',
      servRequested: true,
      servAvailable: false,
    };
  }

  try {
    const res = await callServReasoning({
      system: SERV_ALLOCATION_SYSTEM_PROMPT,
      user: buildServPrompt(profile, heuristic),
    });
    if (!res.ok) {
      return {
        source: 'heuristic',
        allocations: heuristic,
        summary: heuristicSummary,
        degradedReason: res.reason,
        servRequested: true,
        servAvailable: true,
      };
    }
    const parsed = parseServAllocation(res.text);
    const allocations = parsed.weights.map((w) => ({
      ...w,
      why: parsed.rationale[w.vaultId] ?? IXS_VAULT_BY_ID[w.vaultId].blurb,
    }));
    return {
      source: 'serv',
      allocations,
      summary: parsed.summary,
      receipt: {
        provider: 'serv',
        model: res.model,
        effort: res.effort,
        latencyMs: res.latencyMs,
        at: new Date().toISOString(),
        usage: res.usage,
      },
      servRequested: true,
      servAvailable: true,
    };
  } catch (err) {
    return {
      source: 'heuristic',
      allocations: heuristic,
      summary: heuristicSummary,
      degradedReason: err instanceof Error ? err.message : 'serv_parse_failed',
      servRequested: true,
      servAvailable: true,
    };
  }
}

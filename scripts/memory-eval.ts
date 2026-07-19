/**
 * Memory Evaluation Harness
 *
 * Measures whether agent memory actually improves advisor responses — the
 * "increasingly accurate decisions across multi-turn, cross-session
 * interactions" evidence for the Qwen Cloud MemoryAgent track.
 *
 * Approach: run a fixed set of user queries through the advisor pipeline
 * twice — once with memory disabled (cold), once with memory enabled (warm,
 * after seeding the user's memory graph with prior interactions). Score
 * each response against a rubric (personalization, recall accuracy,
 * contradiction avoidance, actionability). Output a JSON report showing
 * the before/after difference.
 *
 * Provider-agnostic: the advisor calls use whatever AIService providers are
 * configured (the default fallback chain). The `--provider` flag controls
 * only the LLM-as-judge scoring step — set it to `dashscope` to use Qwen
 * Cloud as the judge when DashScope is available. The memory consolidation
 * pass (run after seeding) independently prefers DashScope/Qwen long-context
 * when available, falling back to the normal chain otherwise.
 *
 * Usage:
 *   npx tsx scripts/memory-eval.ts [--provider dashscope] [--out eval.json]
 *   npx tsx scripts/memory-eval.ts --seed   # just seed memory, skip eval
 *
 * Requires: COGNEE_API_KEY set, at least one AI provider key set.
 */

import * as fs from 'fs';
import { cogneeMemoryService, memoryConsolidationService } from '@diversifi/shared';

// ---------------------------------------------------------------------------
// Eval scenario set
// ---------------------------------------------------------------------------
// Each scenario simulates a returning user whose prior interactions are
// seeded into Cognee. The "warm" run should produce a response that
// references the seeded memory; the "cold" run should not. The rubric
// scores both and the delta is the memory-improvement signal.
//
// Scenarios are deliberately values-aligned (DiversiFi's thesis): currency
// depreciation, philosophy-driven holdings, risk tolerance, autonomous
// execution preferences. This is what the demo video will show.

interface EvalScenario {
  id: string;
  description: string;
  userId: string;
  // Prior interactions to seed into the user's memory graph before the
  // warm run. These simulate cross-session history.
  seedInteractions: Array<{ query: string; response: string; action?: string }>;
  // The query we're evaluating — asked in both cold and warm runs.
  testQuery: string;
  // Rubric criteria, each scored 0-3 by an LLM judge.
  rubric: string[];
}

const SCENARIOS: EvalScenario[] = [
  {
    id: 'kes-depreciation-recall',
    description: 'Returning KES-focused user asks about protection; memory should recall their currency concern',
    userId: '0xEVAL_USER_1',
    seedInteractions: [
      {
        query: 'My savings are in KES and I keep losing purchasing power. What can I do?',
        response: 'KES has depreciated ~12% vs USD over the past year. Stablecoin holdings (cUSD, USDC) on Celo can preserve purchasing power while earning yield. DiversiFi routes based on your philosophy — for Africapitalism, we prioritize African-issued stablecoins like cUSD.',
        action: 'recommend_stablecoin',
      },
      {
        query: 'I want something Sharia-compliant. Is USDC okay?',
        response: 'USDC is widely considered Sharia-compliant as it is backed by USD reserves. For your KES context, cUSD on Celo is also acceptable. Avoid interest-bearing yield vaults that lend to non-compliant protocols.',
        action: 'sharia_filter',
      },
    ],
    testQuery: 'Given what I told you before, what should I hold to protect my savings?',
    rubric: [
      'References the user\'s KES currency concern (0=no mention, 1=generic, 2=specific to KES, 3=quantifies the depreciation)',
      'Honors the Sharia-compliant constraint from prior session (0=ignores, 1=mentions Sharia, 2=only suggests compliant assets, 3=explains why each suggestion is compliant)',
      'Personalization: response is tailored to this user, not generic advice (0=generic, 1=somewhat, 2=clearly personalized, 3=references specific prior statements)',
    ],
  },
  {
    id: 'philosophy-recall',
    description: 'Returning Africapitalism-aligned user; memory should recall their philosophy',
    userId: '0xEVAL_USER_2',
    seedInteractions: [
      {
        query: 'I believe in Africapitalism — building African wealth in Africa. What does that mean for my portfolio?',
        response: 'Africapitalism prioritizes African-issued assets and regional stablecoins. DiversiFi would route your holdings toward cUSD (Celo, African mobile-money native), Mento regional stablecoins (KESm, COPm), and yield on Celo/Arbitrum that doesn\'t extract from African markets.',
        action: 'philosophy_set',
      },
      {
        query: 'Show me a plan.',
        response: 'Plan: 60% cUSD on Celo (regional anchor + yield), 25% Mento KESm (your regional hedge), 15% GM pool on Arbitrum (BTC/ETH blue-chip yield). All within Africapitalism values.',
        action: 'plan_preview',
      },
    ],
    testQuery: 'What\'s my current plan and why did we pick those assets?',
    rubric: [
      'References Africapitalism as the user\'s stated philosophy (0=no, 1=mentions philosophy generically, 2=names Africapitalism, 3=connects asset choices to Africapitalism principles)',
      'Recalls specific asset allocations from the prior plan (0=none, 1=vague, 2=most assets, 3=all assets with percentages)',
      'Explains the "why" behind choices, not just the "what" (0=just lists assets, 1=brief rationale, 2=per-asset rationale, 3=connects each to user\'s values)',
    ],
  },
  {
    id: 'autonomy-preference-recall',
    description: 'Returning user who asked for autonomous execution; memory should recall their preference',
    userId: '0xEVAL_USER_3',
    seedInteractions: [
      {
        query: 'Can you just rebalance for me when things drift? I don\'t want to approve every trade.',
        response: 'Yes — DiversiFi\'s Guardian can auto-execute within bounds you set (max trade size, allowed tokens, confidence threshold). You\'d grant an ERC-7715-style permission and the Guardian loop rebalances within those limits.',
        action: 'guardian_enable',
      },
      {
        query: 'Set the max trade to $500 and only cUSD/cEUR.',
        response: 'Guardian permission configured: max $500/trade, tokens limited to cUSD and cEUR, confidence threshold 0.6. The loop runs every 5 minutes and auto-executes within these bounds.',
        action: 'guardian_configure',
      },
    ],
    testQuery: 'Can you rebalance my portfolio now based on what we set up?',
    rubric: [
      'References the user\'s prior preference for autonomous execution (0=no, 1=mentions autonomy, 2=references Guardian, 3=references the specific permission bounds set)',
      'Honors the $500 max trade size from prior session (0=ignores, 1=mentions a limit, 2=mentions $500, 3=explains how it applies to this rebalance)',
      'Honors the cUSD/cEUR token restriction (0=ignores, 1=mentions tokens, 2=mentions cUSD/cEUR, 3=confirms only those tokens will be used)',
    ],
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedScenarioMemory(scenario: EvalScenario): Promise<void> {
  if (!cogneeMemoryService.isAvailable()) {
    console.warn(`[memory-eval] Cognee unavailable — skipping seed for ${scenario.id}`);
    return;
  }
  // Clear any prior memory for this eval user (deterministic re-runs).
  await cogneeMemoryService.forget(scenario.userId).catch(() => {});
  for (const interaction of scenario.seedInteractions) {
    await cogneeMemoryService.persistInteraction(
      scenario.userId,
      interaction.query,
      interaction.response,
      { action: interaction.action }
    );
  }
}

// ---------------------------------------------------------------------------
// Advisor call (cold vs warm)
// ---------------------------------------------------------------------------

async function runAdvisor(
  scenario: EvalScenario,
  query: string,
  useMemory: boolean
): Promise<string> {
  // We import the advisor core lazily so the script doesn't pull the whole
  // shared barrel at module load (the bundle-size guard applies to _app; this
  // is a script, but the lazy import keeps the pattern consistent).
  const { runAdvisorConversation } = await import('../pages/api/agent/_advisor-core');
  // The advisor core reads memory via cogneeMemoryService.getAdvisorContext
  // when an address is supplied. To force a "cold" run, we pass a synthetic
  // address that has no seeded memory; for a "warm" run we pass the
  // scenario's userId which we just seeded.
  const address = useMemory ? scenario.userId : `0xCOLD_${scenario.id}`;
  try {
    const result = await runAdvisorConversation({
      message: query,
      address,
      history: [],
      chainId: 42161, // Arbitrum
    });
    return typeof result === 'string' ? result : (result as any).response ?? JSON.stringify(result);
  } catch (err: any) {
    return `[ADVISOR_ERROR] ${err?.message ?? String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// LLM-as-judge scoring
// ---------------------------------------------------------------------------

async function scoreResponse(
  scenario: EvalScenario,
  response: string,
  preferredProvider?: 'dashscope' | 'auto'
): Promise<number[]> {
  const { generateChatCompletion } = await import('@diversifi/shared');
  const rubricBlock = scenario.rubric.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
  const prompt = `You are an impartial judge scoring an AI advisor's response.

User query: ${scenario.testQuery}

Advisor response:
"""
${response}
"""

Score each criterion 0-3:
${rubricBlock}

Respond as a JSON array of ${scenario.rubric.length} integers, in criterion order. No prose.`;

  try {
    const result = await generateChatCompletion(
      {
        messages: [
          { role: 'system', content: 'You are a strict but fair rubric grader. Output only a JSON array of integers.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.0,
        maxTokens: 200,
        responseFormat: { type: 'json_object' },
      },
      preferredProvider
    );
    const parsed = JSON.parse(result.data);
    const arr = Array.isArray(parsed) ? parsed : (parsed.scores ?? parsed.result ?? []);
    return arr.map((n: any) => Math.max(0, Math.min(3, Number(n) || 0)));
  } catch {
    // If the judge fails, return zeros — the eval still runs, just unscored.
    return scenario.rubric.map(() => 0);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface EvalReport {
  timestamp: string;
  provider: string;
  scenarios: Array<{
    id: string;
    description: string;
    cold: { response: string; scores: number[]; total: number };
    warm: { response: string; scores: number[]; total: number };
    delta: number;
    rubric: string[];
  }>;
  summary: {
    coldTotal: number;
    warmTotal: number;
    deltaTotal: number;
    improvementPct: number;
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const seedOnly = argv.includes('--seed');
  const providerFlag = argv.includes('--provider dashscope') ? 'dashscope' : 'auto';
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 && argv[outIdx + 1] ? argv[outIdx + 1] : 'memory-eval-report.json';

  if (!cogneeMemoryService.isAvailable()) {
    console.error('[memory-eval] COGNEE_API_KEY not set — cannot run eval.');
    process.exit(1);
  }

  console.log(`[memory-eval] Provider: ${providerFlag}`);
  console.log(`[memory-eval] Scenarios: ${SCENARIOS.length}`);
  console.log(`[memory-eval] Mode: ${seedOnly ? 'seed-only' : 'full eval'}`);

  // 1. Seed memory for all scenarios.
  for (const scenario of SCENARIOS) {
    console.log(`[memory-eval] Seeding ${scenario.id}...`);
    await seedScenarioMemory(scenario);
  }

  // Optionally trigger consolidation after seeding, so the warm run can
  // benefit from a distilled profile (showcases the consolidation service).
  if (!seedOnly) {
    console.log('[memory-eval] Running consolidation pass on seeded memory...');
    for (const scenario of SCENARIOS) {
      const c = await memoryConsolidationService.consolidate(scenario.userId);
      if (c.consolidated) {
        console.log(`[memory-eval]   ${scenario.id}: consolidated ${c.profileStatements.length} statements via ${c.provider}/${c.model}`);
      } else {
        console.log(`[memory-eval]   ${scenario.id}: no consolidation (${c.reason})`);
      }
    }
  }

  if (seedOnly) {
    console.log('[memory-eval] Seed-only mode complete.');
    return;
  }

  // 2. Run cold + warm for each scenario.
  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    provider: providerFlag,
    scenarios: [],
    summary: { coldTotal: 0, warmTotal: 0, deltaTotal: 0, improvementPct: 0 },
  };

  for (const scenario of SCENARIOS) {
    console.log(`\n[memory-eval] Evaluating ${scenario.id}...`);

    console.log('  [cold] running advisor without memory...');
    const coldResponse = await runAdvisor(scenario, scenario.testQuery, false);
    const coldScores = await scoreResponse(scenario, coldResponse, providerFlag);
    const coldTotal = coldScores.reduce((a, b) => a + b, 0);

    console.log('  [warm] running advisor with memory...');
    const warmResponse = await runAdvisor(scenario, scenario.testQuery, true);
    const warmScores = await scoreResponse(scenario, warmResponse, providerFlag);
    const warmTotal = warmScores.reduce((a, b) => a + b, 0);

    const delta = warmTotal - coldTotal;
    console.log(`  [result] cold=${coldTotal} warm=${warmTotal} delta=${delta >= 0 ? '+' : ''}${delta}`);

    report.scenarios.push({
      id: scenario.id,
      description: scenario.description,
      cold: { response: coldResponse, scores: coldScores, total: coldTotal },
      warm: { response: warmResponse, scores: warmScores, total: warmTotal },
      delta,
      rubric: scenario.rubric,
    });
    report.summary.coldTotal += coldTotal;
    report.summary.warmTotal += warmTotal;
  }

  report.summary.deltaTotal = report.summary.warmTotal - report.summary.coldTotal;
  report.summary.improvementPct = report.summary.coldTotal > 0
    ? Math.round((report.summary.deltaTotal / report.summary.coldTotal) * 1000) / 10
    : 0;

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n[memory-eval] Report written to ${outPath}`);
  console.log(`[memory-eval] Summary: cold=${report.summary.coldTotal} warm=${report.summary.warmTotal} delta=${report.summary.deltaTotal >= 0 ? '+' : ''}${report.summary.deltaTotal} (${report.summary.improvementPct}% improvement)`);

  // Clean up seeded memory so eval users don't pollute the real Cognee tenant.
  console.log('[memory-eval] Cleaning up seeded memory...');
  for (const scenario of SCENARIOS) {
    await cogneeMemoryService.forget(scenario.userId).catch(() => {});
  }
}

main().catch((err) => {
  console.error('[memory-eval] Fatal:', err);
  process.exit(1);
});

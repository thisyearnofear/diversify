/**
 * Fixed Guardian scenarios (portfolio + market signals + philosophy) — the
 * evaluation set from docs/exposure-plans.md. Each carries a canned model
 * reply so the server gate is pinned offline; `evaluateScenario` is the same
 * scorer a live-model run uses.
 *
 * Draft — needs lead review (scenario mix and guided expectations).
 */
import { resolvePlan, type RiskTolerance } from "@/components/protection-cards/plan-preview";
import { instrumentOn, type Exposure } from "@diversifi/shared/src/config/exposures";
import {
  buildPlanContext,
  validateGuardianPlan,
  type Holding,
  type MarketSnapshot,
  type ValidatedGuardianPlan,
} from "@/lib/guardian-tilts";

export interface GuardianScenario {
  name: string;
  strategy: string;
  risk: RiskTolerance;
  anchor?: Exposure;
  holdings: Holding[];
  snapshot: MarketSnapshot;
  /** Guided: gold should be tilted up (shock) / must not be (calm). */
  expectGold?: "up" | "not_up";
  model: unknown;
}

const CELO = 42220;
const ARB = 42161;

const SHOCK: MarketSnapshot = { inflation: 9.8, realYield: -3.4, goldChange24h: 3.2, homeInflation: 14.1 };
const CALM: MarketSnapshot = { inflation: 2.1, realYield: 2.2, goldChange24h: 0.1, treasuryYield: 4.3 };
const DEVALUATION: MarketSnapshot = { inflation: 7.5, homeInflation: 22.4, goldChange24h: 1.4 };

const celoOnly: Holding[] = [
  { symbol: "USDm", chainId: CELO, value: 400 },
  { symbol: "KESm", chainId: CELO, value: 600 },
];
const usdcOnly: Holding[] = [{ symbol: "USDC", chainId: ARB, value: 1000 }];
const mixed: Holding[] = [
  { symbol: "USDC", chainId: ARB, value: 500 },
  { symbol: "EURm", chainId: CELO, value: 200 },
  { symbol: "PAXG", chainId: ARB, value: 300 },
];

const tilt = (exposure: string, delta: number, signal: string, value: number) => ({
  exposure,
  delta,
  reason: `${exposure} ${delta > 0 ? "up" : "down"} on ${signal}`,
  evidence: [{ signal, value }],
});

export const GUARDIAN_SCENARIOS: GuardianScenario[] = [
  { name: "inflation shock · Pan-Caribbean · USDC-only", strategy: "pan_caribbean", risk: "Balanced", holdings: usdcOnly, snapshot: SHOCK, expectGold: "up",
    model: { tilts: [tilt("XAU", 5, "goldChange24h", 3.2), tilt("USD", -5, "realYield", -3.4)], nextMove: { exposure: "XAU", amountAnchor: 50 } } },
  { name: "inflation shock · Islamic · mixed", strategy: "islamic", risk: "Balanced", holdings: mixed, snapshot: SHOCK, expectGold: "up",
    model: { tilts: [tilt("XAU", 5, "inflation", 9.8)], nextMove: { exposure: "XAU", amountAnchor: 40 } } },
  { name: "inflation shock · Pan-Caribbean · Conservative", strategy: "pan_caribbean", risk: "Conservative", holdings: mixed, snapshot: SHOCK, expectGold: "up",
    model: { tilts: [tilt("XAU", 5, "goldChange24h", 3.2)] } },
  { name: "inflation shock · Islamic · Aggressive", strategy: "islamic", risk: "Aggressive", holdings: usdcOnly, snapshot: SHOCK, expectGold: "up",
    model: { tilts: [tilt("XAU", 5, "realYield", -3.4)], nextMove: { exposure: "XAU", amountAnchor: 100 } } },
  { name: "shock · model oversizes gold (+10)", strategy: "pan_caribbean", risk: "Aggressive", holdings: usdcOnly, snapshot: SHOCK,
    model: { tilts: [tilt("XAU", 10, "goldChange24h", 3.2)] } },
  { name: "shock · model invents the gold move", strategy: "pan_caribbean", risk: "Balanced", holdings: usdcOnly, snapshot: SHOCK,
    model: { tilts: [tilt("XAU", 5, "goldChange24h", 7.5)] } },
  { name: "calm market · Pan-Caribbean", strategy: "pan_caribbean", risk: "Balanced", holdings: mixed, snapshot: CALM, expectGold: "not_up",
    model: { tilts: [] } },
  { name: "calm market · Islamic", strategy: "islamic", risk: "Balanced", holdings: mixed, snapshot: CALM, expectGold: "not_up",
    model: { tilts: [] } },
  { name: "calm market · Global", strategy: "global", risk: "Balanced", holdings: celoOnly, snapshot: CALM,
    model: { tilts: [tilt("USD", 3, "treasuryYield", 4.3)], nextMove: { exposure: "USD", amountAnchor: 30 } } },
  { name: "devaluation · Africapitalism · Celo-only", strategy: "africapitalism", risk: "Balanced", anchor: "KES", holdings: celoOnly, snapshot: DEVALUATION,
    model: { tilts: [tilt("KES", -5, "homeInflation", 22.4), tilt("USD", 5, "homeInflation", 22.4)], nextMove: { exposure: "USD", amountAnchor: 5000 } } },
  { name: "devaluation · Buen Vivir · USDC-only", strategy: "buen_vivir", risk: "Balanced", holdings: usdcOnly, snapshot: DEVALUATION,
    model: { tilts: [tilt("USD", 5, "homeInflation", 22.4)] } },
  { name: "devaluation · Gotong Royong", strategy: "gotong_royong", risk: "Conservative", holdings: usdcOnly, snapshot: DEVALUATION,
    model: { tilts: [tilt("PHP", -5, "homeInflation", 22.4)] } },
  { name: "Islamic with yield signals present", strategy: "islamic", risk: "Balanced",
    holdings: [...usdcOnly, { symbol: "USDY", chainId: ARB, value: 500 }], snapshot: CALM,
    model: { tilts: [tilt("USD", 5, "treasuryYield", 4.3)], nextMove: { exposure: "USD", amountAnchor: 20 } } },
  { name: "Confucian with yield signals present", strategy: "confucian", risk: "Balanced", holdings: usdcOnly, snapshot: CALM,
    model: { tilts: [tilt("USD", 5, "treasuryYield", 4.3)] } },
  { name: "Celo-only wallet · Pan-Caribbean gold", strategy: "pan_caribbean", risk: "Balanced", holdings: celoOnly, snapshot: SHOCK, expectGold: "up",
    model: { tilts: [tilt("XAU", 5, "goldChange24h", 3.2)], nextMove: { exposure: "XAU", amountAnchor: 25 } } },
  { name: "Celo-only wallet · Africapitalism euro", strategy: "africapitalism", risk: "Balanced", holdings: celoOnly, snapshot: DEVALUATION,
    model: { tilts: [tilt("EUR", 5, "inflation", 7.5)] } },
  { name: "USDC-only holder · Global", strategy: "global", risk: "Aggressive", holdings: usdcOnly, snapshot: DEVALUATION,
    model: { tilts: [tilt("BRL", -5, "inflation", 7.5), tilt("EUR", 5, "inflation", 7.5)] } },
  { name: "model tilts off-plan (JPY)", strategy: "global", risk: "Balanced", holdings: usdcOnly, snapshot: CALM,
    model: { tilts: [tilt("JPY", 5, "inflation", 2.1)], offPlan: { reason: "Yen carry unwind" } } },
  { name: "model names a ticker instead of an exposure", strategy: "pan_caribbean", risk: "Balanced", holdings: usdcOnly, snapshot: SHOCK,
    model: { tilts: [tilt("PAXG", 5, "goldChange24h", 3.2)] } },
  { name: "model returns nothing (failure)", strategy: "pan_caribbean", risk: "Balanced", holdings: usdcOnly, snapshot: SHOCK,
    model: undefined },
];

export interface ScenarioResult {
  name: string;
  plan: ValidatedGuardianPlan;
  /** Hard failures: tilt out of band, rule broken, unexecutable pick. */
  hardFailures: string[];
  /** Guided expectation met (null when the scenario has none). */
  guidedPass: boolean | null;
}

export function evaluateScenario(s: GuardianScenario, model: unknown = s.model): ScenarioResult {
  const { legs, rules } = resolvePlan({ strategy: s.strategy, riskTolerance: s.risk, anchorCurrency: s.anchor });
  const ctx = buildPlanContext({ strategy: s.strategy, legs, rules, risk: s.risk, anchor: s.anchor ?? "USD", holdings: s.holdings });
  const plan = validateGuardianPlan(model, ctx, s.snapshot);
  const hardFailures: string[] = [];
  const net = new Map<string, number>();
  for (const t of plan.tilts) {
    net.set(t.exposure, (net.get(t.exposure) ?? 0) + t.delta);
    if (Math.abs(t.delta) > 5) hardFailures.push(`${t.exposure} tilt ${t.delta} over ±5`);
    if (t.delta > 0) {
      const inst = t.instrument && instrumentOn(t.instrument.symbol, t.instrument.chainId);
      if (!inst?.executable || inst.trackedOnly) hardFailures.push(`${t.exposure} resolves to nothing executable`);
      else if (rules.excludeYield && inst.yieldBearing) hardFailures.push(`${t.exposure} breaks no-yield rule`);
    }
  }
  for (const [exposure, n] of net) if (Math.abs(n) > ctx.band) hardFailures.push(`${exposure} net ${n} outside ±${ctx.band}`);
  const move = plan.nextMove && instrumentOn(plan.nextMove.instrument.symbol, plan.nextMove.instrument.chainId);
  if (plan.nextMove && (!move?.executable || (rules.excludeYield && move.yieldBearing))) hardFailures.push("next move not executable under rules");
  const goldUp = plan.tilts.some((t) => t.exposure === "XAU" && t.delta > 0);
  const guidedPass = s.expectGold === "up" ? goldUp : s.expectGold === "not_up" ? !goldUp : null;
  return { name: s.name, plan, hardFailures, guidedPass };
}

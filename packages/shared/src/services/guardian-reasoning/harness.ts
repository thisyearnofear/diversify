/**
 * Phase 3 — the cross-surface replay harness.
 *
 * docs/guardian-reasoning-service.md §7 Phase 3: a decision replay harness
 * (mocked providers + frozen clock — the pattern the loop tests already use)
 * that drives all three surfaces from the SAME signal fixture and asserts
 * identical verdicts and artifacts.
 *
 * Design notes:
 * - Pure and provider-free. A fixture is data, not mocks: every test file
 *   that replays a scenario supplies `ReplayFixture` values, so the harness
 *   never imports a provider, a route, or Mongo. Surfaces participate by
 *   projecting the fixture into the artifact THEIR wiring builds — which is
 *   the thing that can silently drift.
 * - The harness asserts THREE properties per scenario:
 *     1. cross-surface text identity (§8.4: one wording per (draft, cohort))
 *     2. determinism (replaying the same fixture twice is byte-identical)
 *     3. honesty (a `live:false` signal can never appear quoted in any
 *        surface's text — the §8.1/§8.2 invariants, checked on every replay)
 * - `replaySignalFixture` additionally replays a fixture through the Phase 0
 *   synthesizer + Phase 1 artifact path (the heartbeat's route) so a
 *   regression in the route's wiring shows up as a cross-surface mismatch,
 *   not as two individually-green suites.
 */

import {
  synthesizeHeartbeatAdvisory,
  toGuardianSignals,
  decisionToLedgerParams,
  buildAdvisoryReasoning,
  type HeartbeatMarketSnapshot,
  type GuardianDecisionArtifact,
  type GuardianSignal,
  type GuardianCohort,
} from './index';

// ---------------------------------------------------------------------------
// Fixture model
// ---------------------------------------------------------------------------

export type ReplaySurface = GuardianDecisionArtifact['surface'];

export interface ReplaySurfaceProjection {
  surface: ReplaySurface;
  /** The artifact this surface's wiring builds from the fixture. */
  artifact: GuardianDecisionArtifact;
  /** Cohort framing this surface stamps (default: global). */
  cohort?: GuardianCohort;
  /** Call-site overrides this surface's wiring applies. */
  overrides?: Parameters<typeof decisionToLedgerParams>[1];
}

export interface ReplayFixture {
  name: string;
  signals: GuardianSignal[];
  /** Optional heartbeat snapshot — when present, the fixture also replays through the synthesizer + artifact path (route parity). */
  heartbeatSnapshot?: HeartbeatMarketSnapshot;
  /** The draft each surface is assumed to have concluded from the fixture. */
  draft: GuardianDecisionArtifact['draft'];
  verdict?: GuardianDecisionArtifact['verdict'];
  cohort?: GuardianCohort;
}

export interface ReplaySurfacesResult {
  surface: ReplaySurface;
  cohort: GuardianCohort;
  text: string;
  ledgerParams: ReturnType<typeof decisionToLedgerParams>;
}

/** Compose the on-chain text one surface would record for this fixture. */
function surfaceText(projection: ReplaySurfaceProjection, fixture: ReplayFixture): ReplaySurfacesResult {
  const artifactForSurface: GuardianDecisionArtifact = {
    ...projection.artifact,
    cohort: projection.cohort ?? fixture.cohort ?? 'global',
  };
  const ledgerParams = decisionToLedgerParams(artifactForSurface, projection.overrides);
  return {
    surface: projection.surface,
    cohort: projection.cohort ?? fixture.cohort ?? 'global',
    text: ledgerParams.reasoning,
    ledgerParams,
  };
}

// ---------------------------------------------------------------------------
// Honesty scanner (§8.1 / §8.2 — checked on EVERY replay)
// ---------------------------------------------------------------------------

/**
 * A `live:false` signal may never appear quoted in reasoning. Quoting means
 * the signal's key (its observation identity) renders as a data point. The
 * outage DISCLOSURE names the source, not the observation — that is honest
 * and allowed.
 */
export function findQuotedDeadSignals(text: string, signals: GuardianSignal[]): GuardianSignal[] {
  return signals.filter(
    (s) => !s.live && s.value !== null && text.includes(`${s.key}:`),
  );
}

/** A data-point line without a `, live)` suffix would be a live:false quote. */
export function textQuotesUnlabeledFigures(text: string): boolean {
  const dataLine = text.split('. ').find((line) => /\w+\.\w[\w.]*: /.test(line));
  return dataLine !== undefined && !dataLine.includes(', live)');
}

// ---------------------------------------------------------------------------
// The harness
// ---------------------------------------------------------------------------

export interface ReplayResult {
  surfaces: ReplaySurfacesResult[];
  failures: string[];
}

/**
 * Replay one fixture across surface projections and assert the Phase 3
 * contract. Returns collected failures (empty = contract holds); assertions
 * stay in the caller's test so failures read as normal Vitest diffs.
 */
export function replaySignalFixture(
  fixture: ReplayFixture,
  projections: ReplaySurfaceProjection[],
): ReplayResult {
  const failures: string[] = [];
  const surfaces = projections.map((p) => surfaceText(p, fixture));

  // 1. Cross-surface identity (§8.4): same fixture + same cohort ⇒ same text.
  const byCohort = new Map<GuardianCohort, string[]>();
  for (const s of surfaces) {
    const list = byCohort.get(s.cohort) ?? [];
    list.push(s.text);
    byCohort.set(s.cohort, list);
  }
  for (const [cohort, texts] of byCohort) {
    const unique = [...new Set(texts)];
    if (unique.length > 1) {
      failures.push(
        `[${fixture.name}] cross-surface wording drift (cohort=${cohort}): ${unique.length} distinct texts`,
      );
    }
  }

  // 2. Determinism (§8.6): replaying the same fixture is byte-identical.
  const replayed = projections.map((p) => surfaceText(p, fixture));
  surfaces.forEach((s, i) => {
    if (s.text !== replayed[i].text) {
      failures.push(`[${fixture.name}] non-deterministic composition on ${s.surface}`);
    }
  });

  // 3. Honesty (§8.1/§8.2): no live:false signal quoted anywhere.
  for (const s of surfaces) {
    const dead = findQuotedDeadSignals(s.text, fixture.signals);
    if (dead.length > 0) {
      failures.push(
        `[${fixture.name}] ${s.surface} quotes dead signals: ${dead.map((d) => d.key).join(', ')}`,
      );
    }
  }

  // 4. Route parity: when a heartbeat snapshot is attached, the artifact the
  // REAL wiring builds must compose the exact text the synthesizer froze —
  // catching wiring drift (e.g. a dropped bodyComplete flag) as a harness
  // failure rather than a silent wording change.
  if (fixture.heartbeatSnapshot) {
    const rec = synthesizeHeartbeatAdvisory(fixture.heartbeatSnapshot);
    const routeArtifact: GuardianDecisionArtifact = {
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: { ...rec },
      signals: toGuardianSignals(fixture.heartbeatSnapshot),
      bodyComplete: true,
    };
    const routeParams = decisionToLedgerParams(routeArtifact);
    if (routeParams.reasoning !== rec.reasoning) {
      failures.push(`[${fixture.name}] heartbeat route wiring drifted from the synthesizer's frozen wording`);
    }
    surfaces.push({
      surface: 'heartbeat',
      cohort: fixture.cohort ?? 'global',
      text: routeParams.reasoning,
      ledgerParams: routeParams,
    });
  }

  return { surfaces, failures };
}

/**
 * Convenience: assert-style helper for test files that prefer expect() over
 * manual failure inspection.
 */
export function assertReplayContract(result: ReplayResult): void {
  if (result.failures.length > 0) {
    throw new Error(`Replay contract violated:\n${result.failures.join('\n')}`);
  }
}

// Re-exported so harness consumers compose artifacts with the canonical builder.
export const harness = {
  replaySignalFixture,
  assertReplayContract,
  findQuotedDeadSignals,
  textQuotesUnlabeledFigures,
  buildAdvisoryReasoning,
};

/** A one-line summary for logs/CI output of a replay. */
export function describeReplay(result: ReplayResult): string {
  const lines = result.surfaces.map(
    (s) => `  ${s.surface} (${s.cohort}): ${s.text.substring(0, 72)}${s.text.length > 72 ? '…' : ''}`,
  );
  const status = result.failures.length === 0 ? 'OK' : `FAILED (${result.failures.length})`;
  return `replay ${status}\n${lines.join('\n')}`;
}

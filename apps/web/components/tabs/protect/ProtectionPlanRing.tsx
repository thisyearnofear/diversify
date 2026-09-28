/**
 * ProtectionPlanRing — the Shield tab's Tier-1 marquee.
 *
 * The tab's one expressive object: the user's plan as an interactive ring.
 * Idle hole is alignment; selected hole is the gap vs target. An empty
 * wallet still shows the plan as the object, with "Add funds" in the hole.
 * The tab inspector owns the CTA.
 *
 * Design language: the ring is the one object that gets color; everything
 * around it is quiet. Motion reveals the reallocation, never loops.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { useCountUp } from '@/hooks/use-count-up';
import { usePointerTilt } from '@/hooks/use-pointer-tilt';
import { haptics } from '@/lib/haptics';
import { springPop, STAGGER_STEP_S } from '@/lib/motion-tokens';
import { ARCHETYPES, strategyToArchetype } from '@/components/protection-cards/tokens';
import { floorPercent, reserveLabel, resolvePlan, type Exposure, type PlanLeg } from '@/components/protection-cards/plan-preview';
import { displayToken } from '@/lib/plan-legs';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';
import { buildWalletPortfolioView, heldAsLine, heldAsSymbol } from '@/lib/wallet-portfolio-view';
import { QUIET_GRAY, TOKEN_COLORS } from '@/components/shared/palette';
import RiveProtectionSeal from '@/components/shared/RiveProtectionSeal';
import { rwaLegFor } from './rwa-assets';

/** Selection id the parent uses for the tokenized-asset (RWA) lens. */
export const SLEEVE_ID = 'sleeve';
/** Selection prefix for an IXS vault row focused in the sleeve inspector. */
export const VAULT_SLICE_PREFIX = 'vault:';
/** Preview wedge weight when the ring holds no tokenized asset. */
const SLEEVE_PREVIEW_PCT = 15;

export function isSleeveSelection(id: string | null | undefined): boolean {
  return id === SLEEVE_ID || Boolean(id?.startsWith(VAULT_SLICE_PREFIX));
}

interface Props {
  /** Effective strategy key (selected strategy overrides onboarding philosophy). */
  strategyKey: string | null;
  portfolio: MultichainPortfolio;
  /** Controlled selection — the tab's focus state lives in ProtectionTab. */
  selectedToken: string | null;
  onSelectToken: (token: string | null) => void;
  /** Plan alignment 0–100, or null when there's nothing to score. Idle hole. */
  alignmentScore?: number | null;
  /** Empty-wallet morph — hole says Add funds; slices are the plan. */
  empty?: boolean;
  /**
   * Walletless ghost ring — the hole states the plan's own fact (dollar
   * reserve %) instead of repeating the connect CTA that sits below it.
   */
  walletless?: boolean;
  /** Makes the hole tappable while idle/empty — Shield uses it for compare mode. */
  onHoleTap?: () => void;
  /** Replaces the idle hint text (compare mode: "under this plan"). */
  holeHintOverride?: string;
  /** Plan legs override — callers pass risk-adjusted legs so the ring, score, and mix agree. */
  legs?: PlanLeg[];
  /** Compare morph — draw `legs` (the previewed plan) even when the wallet
   *  has holdings; without this a funded wallet's holdings shadow the
   *  preview and compare never re-slices. */
  forcePlanLegs?: boolean;
  /** Compact morph (compare/picker): smaller ring, hole kept, header,
   *  legend rows and controls hidden. */
  compact?: boolean;
  /** Faint concentric outer track of the current plan's legs — the
   *  contrast baseline while a different plan previews in compare. */
  ghostLegs?: PlanLeg[];
  /** Hole copy override — compare/picker carries the focused plan name +
   *  compact delta instead of the computed alignment content. */
  holeOverride?: { label: React.ReactNode; hint?: string };
  /** Accessible label for the hole tap (compare: "Exit compare"). */
  holeActionLabel?: string;
  /**
   * Tokenized-asset lens is open (selection is 'sleeve' or 'vault:<id>').
   * The hatched RWA wedges keep their color and everything else goes
   * quiet; a ring with no tokenized asset gets one labelled preview wedge.
   */
  sleeveOpen?: boolean;
  balancePreview?: boolean;
  savedLegs?: PlanLeg[];
  /** Quiet memory — alignment change since the last visit; idle hole only. */
  sinceHint?: string;
  controls?: React.ReactNode;
  /** Reserve exposure the hole names (the anchor when the plan holds it). */
  floor?: Exposure;
}

export function ProtectionPlanRing({
  strategyKey,
  portfolio,
  selectedToken,
  onSelectToken,
  alignmentScore = null,
  empty = false,
  walletless = false,
  onHoleTap,
  holeHintOverride,
  legs,
  forcePlanLegs = false,
  compact = false,
  ghostLegs,
  holeOverride,
  holeActionLabel,
  sleeveOpen = false,
  balancePreview = false,
  savedLegs = [],
  sinceHint,
  controls,
  floor = 'USD',
}: Props) {
  const archetypeId = strategyToArchetype(strategyKey);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const allocations = useMemo(
    () => legs ?? resolvePlan({ strategy: archetypeId }).legs,
    [legs, archetypeId],
  );
  const planRules = resolvePlan({ strategy: archetypeId }).rules;

  const walletView = useMemo(
    () => buildWalletPortfolioView(portfolio, allocations, planRules),
    [portfolio, allocations, planRules],
  );
  const holdingByToken = useMemo(
    () => new Map(walletView.holdings.map((holding) => [holding.symbol, holding])),
    [walletView.holdings],
  );
  const totalValue = walletView.totalUsd;
  // Memoized: it is a dependency of the enriched/primary memos below.
  const heldPctByToken = useMemo(
    () => new Map(walletView.holdings.map((holding) => [holding.symbol, holding.percent])),
    [walletView.holdings],
  );

  // Funded: ring is live holdings — unless the caller forces the plan
  // legs (compare mode previews a different philosophy's slices). Empty:
  // ring is the plan waiting for funds.
  const slices: RingSlice[] = useMemo(() => {
    if (!archetype) return [];
    if (!forcePlanLegs && !balancePreview && walletView.holdings.length > 0) {
      return walletView.holdings.map((holding, i) => ({
        id: holding.symbol,
        label: `${displayToken(holding.symbol)} — wallet holding`,
        percent: holding.percent,
        color:
          TOKEN_COLORS[holding.symbol] ??
          (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : QUIET_GRAY),
        hatch: Boolean(rwaLegFor(holding.symbol)),
      }));
    }
    return allocations.map((a, i) => ({
      id: a.token,
      label: `${a.label ?? displayToken(a.token)} — ${balancePreview ? 'preview target' : 'plan'}`,
      percent: a.percent,
        color:
          TOKEN_COLORS[a.token] ??
          (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : QUIET_GRAY),
        hatch: Boolean(rwaLegFor(a.token)),
    }));
  }, [archetype, walletView.holdings, allocations, balancePreview, forcePlanLegs]);

  // Selection derivations feed the count-up hook below — and every hook
  // must run before the early return (rules of hooks): the ring simply
  // renders null when there is no plan to draw.
  const selected = allocations.find((a) => a.token === selectedToken) ?? null;
  const selectedHeld = selectedToken ? heldPctByToken.get(selectedToken) ?? 0 : 0;
  const gapPts = selected ? selected.percent - selectedHeld : 0;

  const reducedMotion = useReducedMotion();
  const tilt = usePointerTilt(!reducedMotion);
  const alignmentFormatted = useCountUp(alignmentScore ?? 0, {
    format: (n) => `${Math.round(n)}%`,
  });
  const gapFormatted = useCountUp(Math.abs(gapPts), {
    format: (n) => `${Math.round(n)}`,
  });

  // Progressive disclosure: dust into Other. Keeps the object scannable
  // when a wallet holds 10+ tokens — the ring and legend never exceed
  // 5 primary rows + one Other rewrites-artefact row (taps expand in place).
  const [showDust, setShowDust] = useState(false);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const stressTestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (stressTestTimer.current) clearTimeout(stressTestTimer.current);
  }, []);
  const handleStressTest = () => {
    if (isStressTesting) return;
    setIsStressTesting(true);
    haptics.confirm();
    stressTestTimer.current = setTimeout(() => {
      stressTestTimer.current = null;
      setIsStressTesting(false);
    }, 2800);
  };
  const PRIMARY_ROWS = 5;
  const DUST_THRESHOLD_PCT = 2;

  // Enrich slices with plan/held meta once, then partition.
  const enriched = useMemo(() => {
    return slices.map((s) => {
      const a: Pick<PlanLeg, 'token' | 'region' | 'percent' | 'label'> =
        allocations.find((alloc) => alloc.token === s.id) ?? { token: s.id, region: 'Wallet holding', percent: 0 };
      const held = heldPctByToken.get(a.token) ?? 0;
      // Sort key: largest of plan target or actual holding — gap matters too
      const rank = balancePreview ? a.percent : Math.max(a.percent, held);
      return { slice: s, alloc: a, held, rank };
    }).sort((x, y) => y.rank - x.rank);
  }, [slices, allocations, heldPctByToken, balancePreview]);

  const needsDisclosure = enriched.length > PRIMARY_ROWS + 1;
  const primary = useMemo(() => {
    if (!needsDisclosure || showDust) return enriched;
    // Keep large positions + any selected token (so selection never hides)
    const significant = enriched.filter((e) => e.rank >= DUST_THRESHOLD_PCT || e.slice.id === selectedToken);
    if (significant.length >= PRIMARY_ROWS) return significant.slice(0, PRIMARY_ROWS);
    // Not enough significant — fill to PRIMARY_ROWS from sorted order
    const pool = enriched.filter((e) => !significant.some((s) => s.slice.id === e.slice.id));
    return [...significant, ...pool.slice(0, PRIMARY_ROWS - significant.length)].sort((a, b) => b.rank - a.rank);
  }, [enriched, needsDisclosure, showDust, selectedToken]);

  const dust = useMemo(() => {
    if (!needsDisclosure || showDust) return [];
    const primaryIds = new Set(primary.map((p) => p.slice.id));
    return enriched.filter((e) => !primaryIds.has(e.slice.id));
  }, [enriched, primary, needsDisclosure, showDust]);

  const dustTotalHeld = useMemo(() => dust.reduce((sum, d) => sum + d.held, 0), [dust]);
  const dustTotalPlan = useMemo(() => dust.reduce((sum, d) => sum + d.alloc.percent, 0), [dust]);

  // Ring slices shown: collapsed → primary + aggregated Other; expanded → all individually
  const ringSlicesForDisplay: RingSlice[] = useMemo(() => {
    if (!needsDisclosure || showDust) return slices;
    if (dust.length === 0) return slices;
    const primaryIds = new Set(primary.map((p) => p.slice.id));
    const base = slices.filter((s) => primaryIds.has(s.id));
    if (dustTotalHeld <= 0 && dustTotalPlan <= 0) return base;
    return [
      ...base,
      {
        id: "__other__",
        label: `Other — ${dust.length} small positions`,
        percent: balancePreview ? dustTotalPlan : Math.max(dustTotalHeld, dustTotalPlan, 0.5),
        color: QUIET_GRAY,
      },
    ];
  }, [slices, primary, dust, dustTotalHeld, dustTotalPlan, needsDisclosure, showDust, balancePreview]);

  // Tokenized-asset lens — selection rewrites the artefact: the hatched
  // RWA wedges keep their color, every other wedge goes quiet. A ring with
  // no tokenized asset gets one labelled preview wedge, never a fake share.
  const rwaSlices = useMemo(
    () => ringSlicesForDisplay.filter((s) => s.hatch),
    [ringSlicesForDisplay],
  );
  const rwaPct = Math.round(rwaSlices.reduce((sum, s) => sum + s.percent, 0));
  const displaySlices = useMemo(() => {
    if (!sleeveOpen) return ringSlicesForDisplay;
    const quiet = ringSlicesForDisplay.map((s) => (s.hatch ? s : { ...s, color: QUIET_GRAY }));
    if (rwaSlices.length > 0) return quiet;
    return [
      ...quiet,
      {
        id: SLEEVE_ID,
        label: 'Tokenized assets — preview, not in your plan',
        percent: SLEEVE_PREVIEW_PCT,
        color: archetype?.accent ?? QUIET_GRAY,
        hatch: true,
      },
    ];
  }, [sleeveOpen, ringSlicesForDisplay, rwaSlices.length, archetype]);

  if (!archetype) return null;
  // A compact ring with a holeOverride still draws — the empty track +
  // "Choose a philosophy" hole IS the picker's object.
  const emptyTrack = allocations.length === 0 || slices.length === 0;
  if (emptyTrack && !holeOverride) return null;

  const ringSize = compact ? 130 : 200;
  const ringThickness = compact ? 16 : 24;
  const ghostSlices: RingSlice[] = (ghostLegs ?? []).map((a, i) => ({
    id: a.token,
    label: `${a.label ?? displayToken(a.token)} — current plan`,
    percent: a.percent,
    color: TOKEN_COLORS[a.token] ?? (i === 0 ? archetype?.accent : i === 1 ? archetype?.accentSoft : undefined) ?? QUIET_GRAY,
  }));

  const selectedLive = slices.find((slice) => slice.id === selectedToken) ?? null;
  const selectedSymbol = selectedLive?.id ?? selected?.token ?? null;
  const onTarget = Boolean(selected) && Math.abs(gapPts) <= 2;

  const projections = portfolio?.projections;
  const purchasingPowerLost = projections?.currentPath?.purchasingPowerLost ?? 0;
  const purchasingPowerPreserved =
    projections?.optimizedPath?.purchasingPowerPreserved ?? 0;
  const showProjections =
    !balancePreview && totalValue > 0 && (purchasingPowerLost > 0 || purchasingPowerPreserved > 0);

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const hole = (() => {
    if (holeOverride) {
      return {
        number: null as React.ReactNode,
        label: holeOverride.label,
        hint: holeOverride.hint ?? '',
      };
    }
    if (isStressTesting) {
      return {
        number: (
          <motion.span
            key="stress-score"
            initial={reducedMotion ? false : { scale: 0.8 }}
            animate={reducedMotion ? {} : { scale: [0.8, 1.15, 1] }}
            transition={{ duration: 0.4 }}
            className="text-emerald-600 dark:text-emerald-400 font-black"
          >
            Reserve ready
          </motion.span>
        ),
        label: "Illustrative 30% shock",
        hint: `${floorPercent(allocations, floor)}% ${reserveLabel(floor).toLowerCase()} reserve remains available`,
      };
    }
    if (balancePreview) {
      return selected
        ? { number: `${selected.percent}%` as React.ReactNode, label: selected.label ?? displayToken(selected.token), hint: `${savedLegs.find((leg) => leg.token === selected.token)?.percent ?? 0}% in saved plan` }
        : { number: `${floorPercent(allocations, floor)}%` as React.ReactNode, label: `${reserveLabel(floor)} reserve`, hint: 'Preview · not saved' };
    }
    // Tokenized-asset lens — checked before the empty/walletless branches so
    // the deep-linked lens reads the same with or without a wallet.
    if (sleeveOpen) {
      const funded = !empty && totalValue > 0;
      return rwaSlices.length > 0
        ? {
            number: `${rwaPct}%` as React.ReactNode,
            label: 'tokenized assets',
            hint: `${rwaSlices.map((s) => displayToken(s.id)).join(' · ')} · ${funded ? 'of your wallet' : 'of this plan'}`,
          }
        : {
            number: null as React.ReactNode,
            label: 'Tokenized assets',
            hint: 'none in this plan yet',
          };
    }
    if (empty && selected) {
      return { number: `${selected.percent}%` as React.ReactNode, label: selected.label ?? displayToken(selected.token), hint: 'Target only · not funded' };
    }
    // The plan name lives in the badge above — the hole never repeats it.
    if (empty && walletless) {
      return {
        number: `${floorPercent(allocations, floor)}%` as React.ReactNode,
        label: `${reserveLabel(floor).toLowerCase()} reserve`,
        hint: 'plan target',
      };
    }
    if (empty) {
      return {
        number: null as React.ReactNode,
        label: 'Add funds',
        hint: 'to start this plan',
      };
    }
    if (selected || selectedLive) {
      // Money beside the percentage — "8 pts light" lands as meaning when
      // it's also "≈ $2,000". Only when a real wallet value exists.
      const moneyHint = (pct: number) =>
        totalValue > 0 ? ` · ≈ ${fmt(Math.abs(pct) / 100 * totalValue)}` : "";
      if (!selected) {
        return {
          number: `${Math.round(selectedHeld)}%`,
          label: selectedSymbol ? displayToken(selectedSymbol) : selectedSymbol,
          hint: `outside plan${moneyHint(selectedHeld)}`,
        };
      }
      if (onTarget) {
        return {
          number: null as React.ReactNode,
          label: "On target",
          hint: `${selectedSymbol ? displayToken(selectedSymbol) : ''}${moneyHint(selectedHeld)}`,
        };
      }
      return {
        number: (
          <motion.span>{gapFormatted}</motion.span>
        ),
        label: gapPts > 0 ? "pts light" : "pts over",
        hint: `${selectedSymbol ? displayToken(selectedSymbol) : ''}${moneyHint(gapPts)}`,
      };
    }
    if (alignmentScore === null) {
      return {
        number: '—' as React.ReactNode,
        label: archetype.name,
        hint: holeHintOverride ?? 'no holdings yet',
      };
    }
    return {
      number: <motion.span>{alignmentFormatted}</motion.span>,
      label: archetype.name,
      hint: holeHintOverride ?? 'of your money follows the plan',
    };
  })();

  return (
    <div className="w-full">
      {compact ? null : (
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Your shield plan
        </h3>
        {/* Armed-state seal — stamps once per mount (keyed to the plan),
            then holds. The §5 confirm artefact for committing a plan. */}
        <div className="flex items-center gap-2">
          {!balancePreview && !empty && (
            <>
              <button
                type="button"
                data-testid="stress-test-btn"
                aria-label="Preview illustrative 30 percent currency shock"
                aria-describedby="stress-test-description"
                onClick={handleStressTest}
                disabled={isStressTesting}
                className={`text-3xs font-bold px-2.5 py-1 rounded-full transition-all flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                  isStressTesting
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 ring-2 ring-emerald-500/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                title="Preview an illustrative 30% macro currency shock"
              >
                <span aria-hidden="true">{isStressTesting ? "🛡️" : "⚡"}</span>
                <span>{isStressTesting ? "Previewing" : "Test defense"}</span>
              </button>
              <span id="stress-test-description" className="sr-only">
                This is an illustrative resilience preview, not a forecast or settlement quote.
              </span>
            </>
          )}
          {!balancePreview && (
            <RiveProtectionSeal key={`seal-${archetype.id}`} size={34} color={archetype.accent} armed />
          )}
        {onHoleTap ? (
          <motion.button
            key={archetype.id}
            type="button"
            data-testid="plan-badge"
            aria-label={
              holeHintOverride ? "Exit compare" : "Compare philosophies"
            }
            onClick={onHoleTap}
            className="text-3xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full inline-block min-h-[32px] min-w-tap hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            style={{ background: `${archetype.accent}18`, color: archetype.accent }}
            initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springPop}
          >
            {archetype.name}
            {!holeHintOverride && " ▾"}
          </motion.button>
        ) : (
          <motion.span
            key={archetype.id}
            className="text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block"
            style={{ background: `${archetype.accent}18`, color: archetype.accent }}
            initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springPop}
          >
            {archetype.name}
          </motion.span>
        )}
        </div>
      </div>
      )}

      <div className="flex justify-center">
        <motion.div
          layout={reducedMotion ? undefined : true}
          className="relative"
          animate={
            isStressTesting && !reducedMotion
              ? {
                  scale: [1, 1.04, 0.97, 1.01, 1],
                  rotate: [0, -1, 1, -0.5, 0],
                }
              : {}
          }
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ ...tilt.style, transformPerspective: 900 }}
          {...tilt.props}
        >
          {/* The current plan's outline — a thin concentric track in its
              own colours at ~35% opacity just outside the ring edge,
              fading in/out with compare. */}
          <AnimatePresence>
            {ghostSlices.length > 0 && (
              <motion.div
                key="ghost-plan-outline"
                data-testid="ghost-plan-outline"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.25 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <AllocationRing
                  slices={ghostSlices}
                  size={ringSize + 8}
                  thickness={4}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <AllocationRing
            slices={displaySlices}
            selectedId={isSleeveSelection(selectedToken) ? null : selectedToken}
            onSelect={(id) => {
              if (id === "__other__") {
                setShowDust(true);
                return;
              }
              onSelectToken(selectedToken === id ? null : id);
            }}
            ghost={
              !balancePreview && selected && !empty && !onTarget && Math.abs(gapPts) > 2
                ? { id: selected.token, extraPercent: gapPts }
                : null
            }
            size={ringSize}
            thickness={ringThickness}
          >
            {(() => {
              const holeContent = (
                <>
                  {hole.number != null && (
                    <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                      {hole.number}
                    </span>
                  )}
                  <span className={`font-bold text-gray-900 dark:text-white max-w-[130px] text-center leading-tight ${hole.number == null ? "text-base" : "text-sm"}`}>
                    {hole.label}
                  </span>
                  <span
                    className="text-2xs text-gray-500 dark:text-gray-400"
                    aria-live={isStressTesting ? "polite" : undefined}
                  >
                    {hole.hint}
                  </span>
                  {sinceHint &&
                    !selectedToken &&
                    !empty &&
                    !balancePreview &&
                    !sleeveOpen &&
                    holeHintOverride === undefined && (
                      <span
                        data-testid="shield-since-last-visit"
                        className="text-3xs text-gray-400 dark:text-gray-500"
                      >
                        {sinceHint}
                      </span>
                    )}
                  {onHoleTap && !holeHintOverride && !holeOverride && (
                    <span className="text-3xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Compare plans ▾
                    </span>
                  )}
                </>
              );
              const holeBody =
                onHoleTap && !selectedToken ? (
                  <button
                    type="button"
                    data-testid="ring-hole"
                    aria-label={holeActionLabel ?? "Compare philosophies"}
                    onClick={onHoleTap}
                    className="flex flex-col items-center min-h-tap min-w-tap p-2 pointer-events-auto"
                  >
                    {holeContent}
                  </button>
                ) : (
                  <div className="flex flex-col items-center">{holeContent}</div>
                );
              return (
                <motion.div
                  key={selectedToken ?? `idle-${strategyKey ?? "none"}-${alignmentScore ?? "na"}`}
                  initial={reducedMotion ? false : { opacity: 0, filter: "blur(6px)", y: 4 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col items-center"
                >
                  {holeBody}
                </motion.div>
              );
            })()}
          </AllocationRing>
        </motion.div>
      </div>

      {!compact && controls}

      {!compact && (
      <div className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.05]">
        {(showDust ? enriched : primary).map(({ slice, alloc: a, held }, idx) => {
          const isSelected = selectedToken === a.token;
          return (
            <motion.button
              key={a.token}
              type="button"
              onClick={() => onSelectToken(selectedToken === a.token ? null : a.token)}
              aria-pressed={isSelected}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * STAGGER_STEP_S, ease: "easeOut" }}
              className={`w-full min-h-tap lg:min-h-[38px] flex items-center gap-3 py-2.5 lg:py-1.5 text-left rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <TokenIcon symbol={heldAsSymbol(holdingByToken.get(a.token)) ?? displayToken(a.token)} size={22} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                  {a.label ?? displayToken(a.token)}
                </span>
                <span className="block text-2xs text-gray-500 dark:text-gray-400 truncate">
                  {(!balancePreview && heldAsLine(holdingByToken.get(a.token), totalValue)) || a.region}
                </span>
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                {a.percent > 0 ? `${a.percent}% ${balancePreview ? 'preview' : 'plan'}` : 'not in plan'}
              </span>
              <span
                className={`text-2xs font-bold tabular-nums w-20 text-right ${
                  !balancePreview && held >= a.percent - 2
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {balancePreview
                  ? `${savedLegs.find((leg) => leg.token === a.token)?.percent ?? 0}% saved`
                  : totalValue > 0
                    ? `${held.toFixed(0)}% held`
                    : null}
              </span>
            </motion.button>
          );
        })}
        {dust.length > 0 && (
          <motion.button
            key="__other__"
            type="button"
            onClick={() => { haptics.tap(); setShowDust(true); }}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: primary.length * STAGGER_STEP_S }}
            data-testid="shield-other"
            className="w-full min-h-tap flex items-center gap-3 py-2.5 text-left rounded-lg bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <span className="w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-3xs font-black text-gray-600 dark:text-gray-300 shrink-0">+{dust.length}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-gray-900 dark:text-white">Other</span>
              <span className="block text-2xs text-gray-500 dark:text-gray-400 truncate">{dust.length} small positions · {dust.length > 1 ? `${dustTotalPlan.toFixed(0)}% plan` : dust[0]?.alloc.region ?? ""}</span>
            </span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">{balancePreview ? `${dustTotalPlan.toFixed(0)}% preview` : `${fmt(dustTotalHeld)} held`}</span>
          </motion.button>
        )}
        <AnimatePresence initial={false}>
          {showDust && dust.length === 0 && needsDisclosure && (
            <motion.div
              key="collapse"
              initial={reducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <button
                type="button"
                onClick={() => { haptics.tap(); setShowDust(false); }}
                className="w-full min-h-tap py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Show less
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}
      {!compact && showProjections && (
        <p className="text-2xs text-gray-500 dark:text-gray-400 mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-2">
          3-year path, projected: inflation takes{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerLost)}
          </strong>{' '}
          from the current mix; following the plan keeps{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerPreserved)}
          </strong>{' '}
          of it.
        </p>
      )}
    </div>  );
}

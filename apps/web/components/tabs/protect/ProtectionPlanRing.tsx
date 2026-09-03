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
import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { useCountUp } from '@/hooks/use-count-up';
import { usePointerTilt } from '@/hooks/use-pointer-tilt';
import { haptics } from '@/lib/haptics';
import { springPop, STAGGER_STEP_S } from '@/lib/motion-tokens';
import { ARCHETYPES, strategyToArchetype } from '@/components/protection-cards/tokens';
import { getArchetypeAllocations } from '@/components/protection-cards/plan-preview';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';
import { buildWalletPortfolioView } from '@/lib/wallet-portfolio-view';
import { QUIET_GRAY, TOKEN_COLORS } from '@/components/shared/palette';
import { rwaLegFor } from './RwaAssetCards';

interface Props {
  /** Effective strategy key (selected strategy overrides onboarding philosophy). */
  strategyKey: string | null;
  portfolio: MultichainPortfolio;
  /** Controlled selection — the tab's focus state lives in ProtectionTab. */
  selectedToken: string | null;
  onSelectToken: (token: string | null) => void;
  /** Plan alignment 0–100. Idle hole. */
  alignmentScore?: number;
  /** Empty-wallet morph — hole says Add funds; slices are the plan. */
  empty?: boolean;
}

export function ProtectionPlanRing({
  strategyKey,
  portfolio,
  selectedToken,
  onSelectToken,
  alignmentScore = 0,
  empty = false,
}: Props) {
  const archetypeId = strategyToArchetype(strategyKey);
  const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
  const allocations = useMemo(
    () => (archetypeId ? getArchetypeAllocations(archetypeId) : []),
    [archetypeId],
  );

  const walletView = useMemo(
    () => buildWalletPortfolioView(portfolio, allocations),
    [portfolio, allocations],
  );
  const totalValue = walletView.totalUsd;
  const heldPctByToken = new Map(
    walletView.holdings.map((holding) => [holding.symbol, holding.percent]),
  );

  // Funded: ring is live holdings. Empty: ring is the plan waiting for funds.
  const slices: RingSlice[] = useMemo(() => {
    if (!archetype) return [];
    if (walletView.holdings.length > 0) {
      return walletView.holdings.map((holding, i) => ({
        id: holding.symbol,
        label: `${holding.symbol} — wallet holding`,
        percent: holding.percent,
        color:
          TOKEN_COLORS[holding.symbol] ??
          (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : QUIET_GRAY),
        hatch: Boolean(rwaLegFor(holding.symbol)),
      }));
    }
    return allocations.map((a, i) => ({
      id: a.token,
      label: `${a.token} — plan`,
      percent: a.percent,
        color:
          TOKEN_COLORS[a.token] ??
          (i === 0 ? archetype.accent : i === 1 ? archetype.accentSoft : QUIET_GRAY),
        hatch: Boolean(rwaLegFor(a.token)),
    }));
  }, [archetype, walletView.holdings, allocations]);

  if (!archetype || allocations.length === 0 || slices.length === 0) return null;

  const selected = allocations.find((a) => a.token === selectedToken) ?? null;
  const selectedLive = slices.find((slice) => slice.id === selectedToken) ?? null;
  const selectedSymbol = selectedLive?.id ?? selected?.token ?? null;
  const selectedHeld = selectedToken ? heldPctByToken.get(selectedToken) ?? 0 : 0;
  const gapPts = selected ? selected.percent - selectedHeld : 0;
  const onTarget = Boolean(selected) && Math.abs(gapPts) <= 2;

  const reducedMotion = useReducedMotion();
  const tilt = usePointerTilt(!reducedMotion);
  const alignmentFormatted = useCountUp(alignmentScore, {
    format: (n) => `${Math.round(n)}%`,
  });
  const gapFormatted = useCountUp(Math.abs(gapPts), {
    format: (n) => `${Math.round(n)}`,
  });

  // Progressive disclosure: dust into Other. Keeps the object scannable
  // when a wallet holds 10+ tokens — the ring and legend never exceed
  // 5 primary rows + one Other rewrites-artefact row (taps expand in place).
  const [showDust, setShowDust] = useState(false);
  const PRIMARY_ROWS = 5;
  const DUST_THRESHOLD_PCT = 2;

  // Enrich slices with plan/held meta once, then partition.
  const enriched = useMemo(() => {
    return slices.map((s) => {
      const a = allocations.find((alloc) => alloc.token === s.id) ?? { token: s.id, region: 'Wallet holding', percent: 0 };
      const held = heldPctByToken.get(a.token) ?? s.percent;
      // Sort key: largest of plan target or actual holding — gap matters too
      const rank = Math.max(a.percent, held);
      return { slice: s, alloc: a, held, rank };
    }).sort((x, y) => y.rank - x.rank);
  }, [slices, allocations, heldPctByToken]);

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
        percent: Math.max(dustTotalHeld, dustTotalPlan, 0.5),
        color: QUIET_GRAY,
      },
    ];
  }, [slices, primary, dust, dustTotalHeld, dustTotalPlan, needsDisclosure, showDust]);

  const projections = portfolio?.projections;
  const purchasingPowerLost = projections?.currentPath?.purchasingPowerLost ?? 0;
  const purchasingPowerPreserved =
    projections?.optimizedPath?.purchasingPowerPreserved ?? 0;
  const showProjections =
    totalValue > 0 && (purchasingPowerLost > 0 || purchasingPowerPreserved > 0);

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const hole = (() => {
    if (empty) {
      return {
        number: null as React.ReactNode,
        label: "Add funds",
        hint: archetype.name,
      };
    }
    if (selected || selectedLive) {
      if (!selected) {
        return {
          number: `${Math.round(selectedHeld)}%`,
          label: selectedSymbol,
          hint: "outside plan",
        };
      }
      if (onTarget) {
        return {
          number: null as React.ReactNode,
          label: "On target",
          hint: selectedSymbol,
        };
      }
      return {
        number: (
          <motion.span>{gapFormatted}</motion.span>
        ),
        label: gapPts > 0 ? "pts light" : "pts over",
        hint: selectedSymbol,
      };
    }
    return {
      number: <motion.span>{alignmentFormatted}</motion.span>,
      label: archetype.name,
      hint: "aligned · tap a slice",
    };
  })();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Your shield plan
        </h3>
        <motion.span
          key={archetype.id}
          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full inline-block"
          style={{ background: `${archetype.accent}18`, color: archetype.accent }}
          initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={springPop}
        >
          {archetype.name}
        </motion.span>
      </div>

      <div className="flex justify-center">
        <motion.div style={{ ...tilt.style, transformPerspective: 900 }} {...tilt.props}>
          <AllocationRing
            slices={ringSlicesForDisplay}
            selectedId={selectedToken}
            onSelect={(id) => {
              if (id === "__other__") {
                setShowDust(true);
                return;
              }
              onSelectToken(selectedToken === id ? null : id);
            }}
            ghost={
              selected && !empty && !onTarget && Math.abs(gapPts) > 2
                ? { id: selected.token, extraPercent: gapPts }
                : null
            }
            size={200}
            thickness={24}
          >
            <motion.div
              key={selectedToken ?? `idle-${alignmentScore}`}
              initial={reducedMotion ? false : { opacity: 0, filter: "blur(6px)", y: 4 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              {hole.number != null && (
                <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                  {typeof hole.number === "string" ? hole.number : hole.number}
                </span>
              )}
              <span className={`font-bold text-gray-900 dark:text-white max-w-[120px] truncate ${hole.number == null ? "text-lg" : "text-sm"}`}>
                {hole.label}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {hole.hint}
              </span>
            </motion.div>
          </AllocationRing>
        </motion.div>
      </div>

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
              className={`w-full min-h-[44px] flex items-center gap-3 py-2.5 text-left rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <TokenIcon symbol={a.token} size={22} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">
                  {a.token}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {a.region}
                </span>
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                {a.percent > 0 ? `${a.percent}% plan` : 'not in plan'}
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums w-20 text-right ${
                  held >= a.percent - 2
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {held.toFixed(0)}% held
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
            className="w-full min-h-[44px] flex items-center gap-3 py-2.5 text-left rounded-lg bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            <span className="w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-black text-gray-600 dark:text-gray-300 shrink-0">+{dust.length}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-gray-900 dark:text-white">Other</span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{dust.length} small positions · {dust.length > 1 ? `${dustTotalPlan.toFixed(0)}% plan` : dust[0]?.alloc.region ?? ""}</span>
            </span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">{fmt(dustTotalHeld)} held</span>
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
                className="w-full min-h-[44px] py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Show less
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {showDust && dust.length === 0 && needsDisclosure && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">Expanded — all positions visible. Dust no longer aggregated in the ring.</p>
      )}

      {showProjections && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-2">
          3-year path: inflation takes{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerLost)}
          </strong>{' '}
          on the current mix; the optimized plan preserves{' '}
          <strong className="text-gray-900 dark:text-white tabular-nums">
            {fmt(purchasingPowerPreserved)}
          </strong>
          .
        </p>
      )}
    </div>  );
}

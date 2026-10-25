/**
 * PhilosophyPhase — onboarding phase 3: values-lens + philosophy selection.
 *
 * JSX extracted verbatim from WelcomeScreen; state stays with the
 * orchestrator and arrives as props.
 *
 * Scroll rule: this phase renders inside the dialog's single scroll
 * container — never add overflow-y-auto or justify-center here.
 */

import { motion, AnimatePresence, type TargetAndTransition, type Transition } from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  ARCHETYPE_ORDER,
  type ArchetypeId,
} from '../../../protection-cards/tokens';
import { LensCoinSelector } from '../../LensCoinSelector';
import { PlanPreviewCard } from '../../../protection-cards/PlanPreviewCard';
import type { PlanPreview } from '../../../protection-cards/plan-preview';
import { ArchetypeStrip } from './ArchetypeStrip';
import { VALUES_LENSES, staggerChild, phaseVariants, type ValuesLens } from './phase-config';
import { springPress, controlMotion } from "@/lib/motion-tokens";

export interface PanelEntrance {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
}

interface PhilosophyPhaseProps {
  selectedArchetype: ArchetypeId | null;
  handleArchetypeSelect: (id: ArchetypeId) => void;
  selectedLens: ValuesLens | null;
  handleLensSelect: (id: ValuesLens) => void;
  handleBackToCoins: () => void;
  lensVariant: number;
  emergeKey: number;
  activeLens: (typeof VALUES_LENSES)[number] | null;
  bloomOrigin: number | string;
  panelDelay: number;
  panelEntrance: PanelEntrance;
  panelChildMotion: (i: number) => {
    initial: TargetAndTransition | false;
    animate: TargetAndTransition;
    transition: Transition;
  };
  reduceMotion: boolean;
  showAllApproaches: boolean;
  setShowAllApproaches: (v: boolean) => void;
  planPreview: PlanPreview | null;
  localPrefix: string;
  handleUsePlan: () => void;
  handleExploreDemo: () => void;
  riskData: { flag: string } | null;
  /** Phase travel direction (+1 forward, −1 back) — drives the phaseVariants
   *  custom transition. */
  direction?: number;
  onBackToRisk: () => void;
  /** Fires once when the phase mounts — WelcomeScreen moves focus to the
   *  phase heading and resets the screen's scroll. */
  onEntered?: () => void;
}

export function PhilosophyPhase({
  selectedArchetype,
  handleArchetypeSelect,
  selectedLens,
  handleLensSelect,
  handleBackToCoins,
  lensVariant,
  emergeKey,
  activeLens,
  bloomOrigin,
  panelDelay,
  panelEntrance,
  panelChildMotion,
  reduceMotion,
  showAllApproaches,
  setShowAllApproaches,
  planPreview,
  localPrefix,
  handleUsePlan,
  handleExploreDemo,
  riskData,
  direction = 1,
  onBackToRisk,
  onEntered,
}: PhilosophyPhaseProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { onEntered?.(); }, [onEntered]);
  useEffect(() => {
    if (activeLens) panelRef.current?.focus();
  }, [activeLens]);
  return (
    <motion.div
      key="phase-philosophy"
      custom={direction}
      variants={reduceMotion ? undefined : phaseVariants}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      exit="exit"
      className="journey-phase"
    >
      <motion.h2
        variants={staggerChild}
        data-phase-heading="philosophy"
        tabIndex={-1}
        className="journey-title text-white mb-5 focus:outline-none"
      >
        Make this plan{' '}
        <span className="text-amber-300">
          yours.
        </span>
      </motion.h2>

      {/* Stage — a fixed-height canvas holding BOTH the coin
          row and the lens detail as overlapping layers. Tap a
          coin: the others combine into it, then the detail
          blooms out of the chosen coin's exact slot. Fixed
          height + overlapping layers — nothing below the
          stage ever moves. */}
      {/* Height: fixed while the coins browse; grows with the lens panel so
          the archetypes + plan preview never spill over the heading or the
          money-purpose control (they used to overlap both at 390px). */}
      <motion.div variants={staggerChild} className={`relative mb-4 ${activeLens ? 'min-h-[300px]' : 'h-[300px]'}`}>
        {/* Coin row — the combine choreography lives inside. */}
        <LensCoinSelector
          presentation="stage"
          lenses={VALUES_LENSES}
          selected={selectedLens}
          onSelect={(id) => handleLensSelect(id as ValuesLens)}
          combineVariant={lensVariant}
          emergeKey={emergeKey}
        />

        {/* Flash ring — a radial burst of the pick's accent at
            the convergence point, fired just as the panel
            takes over. Bloom + burst variants only. */}
        <AnimatePresence>
          {activeLens && !reduceMotion && lensVariant !== 1 && (
            <motion.span
              key={`flash-${activeLens.id}-${lensVariant}`}
              aria-hidden="true"
              className="pointer-events-none absolute w-14 h-14 rounded-full z-20"
              style={{
                left: bloomOrigin,
                top: '50%',
                x: '-50%',
                y: '-50%',
                border: `2px solid ${activeLens.accent}`,
              }}
              initial={{ scale: 0.25, opacity: 0.9 }}
              animate={{ scale: 3.4, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: Math.max(0, panelDelay - 0.1) }}
            />
          )}
        </AnimatePresence>

        {/* Lens detail — sprouts out of the chosen coin. Full
            width: no pinned mini-row, no dead corner. */}
        <AnimatePresence>
          {activeLens && (
            <motion.div
              key="lens-panel"
              initial={panelEntrance.initial}
              animate={panelEntrance.animate}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={panelEntrance.transition}
              ref={panelRef}
              tabIndex={-1}
              className="relative flex flex-col justify-center px-2 z-10 min-h-[300px] focus:outline-none"
            >
              {/* Lens detail sits on a SOLID panel — the coin row
                  stays mounted behind it for the bloom
                  choreography, but nothing shows through
                  (solid-ground rule: glass loses to the backdrop). */}
              <div className="rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-xl p-3">
              {/* Lens header — stacked: label on its own line,
                  description under it (both were truncate-clipped
                  when sharing one row). Escape hatches stay right. */}
              <motion.div {...panelChildMotion(0)} className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 text-left">
                  <p className="text-sm font-black text-white">
                    {showAllApproaches ? 'All approaches' : activeLens.label}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {showAllApproaches
                      ? 'Every approach in one list.'
                      : activeLens.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {!showAllApproaches && (
                    <motion.button
                      type="button"
                      onClick={() => setShowAllApproaches(true)}
                      {...controlMotion(Boolean(reduceMotion))}
                      className="min-h-tap px-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded"
                    >
                      All plans →
                    </motion.button>
                  )}
                  <motion.button
                    type="button"
                    onClick={handleBackToCoins}
                    {...controlMotion(Boolean(reduceMotion))}
                    className="min-h-tap px-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                  >
                    ← Values
                  </motion.button>
                </div>
              </motion.div>

              {/* Archetype strip — the user's actual choice. */}
              <motion.div {...panelChildMotion(1)}>
                <ArchetypeStrip
                  ids={showAllApproaches ? ARCHETYPE_ORDER : activeLens.archetypes}
                  activeId={selectedArchetype}
                  onSelect={handleArchetypeSelect}
                />
              </motion.div>

              {/* Plan preview — the numeric payoff, or a quiet prompt. */}
              <motion.div {...panelChildMotion(2)} className="mt-2.5">
                <AnimatePresence mode="wait" initial={false}>
                  {planPreview ? (
                    <motion.div
                      key={`preview-${selectedArchetype}`}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <PlanPreviewCard preview={planPreview} currencyPrefix={localPrefix} />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="px-2 text-xs text-slate-300 text-center"
                    >
                      Choose an approach to see its allocation.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Preview never saves or opens a wallet. The explicit action commits. */}
      <motion.div variants={staggerChild} className="space-y-2">
        {selectedArchetype && planPreview && (
          <motion.button
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={handleUsePlan}
            className="journey-action w-full px-6 bg-blue-600 hover:bg-blue-700 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            {...controlMotion(Boolean(reduceMotion))}
          >
            Use this plan
            <span className="journey-action-arrow" aria-hidden="true">→</span>
          </motion.button>
        )}
        <button
          onClick={handleExploreDemo}
          className="w-full px-6 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
        >
          Explore a sample →
        </button>
        {riskData && (
          <motion.button
            type="button"
            onClick={onBackToRisk}
            {...controlMotion(Boolean(reduceMotion))}
            className="w-full min-h-tap py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
          >
            ← Back to risk data
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

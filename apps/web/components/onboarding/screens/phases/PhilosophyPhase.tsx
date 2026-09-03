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
import { ShimmerText } from '../../../shared/ShimmerText';
import {
  ARCHETYPES,
  ARCHETYPE_ORDER,
  type ArchetypeId,
} from '../../../protection-cards/tokens';
import { LensCoinSelector } from '../../LensCoinSelector';
import { PlanPreviewCard } from '../../../protection-cards/PlanPreviewCard';
import type { PlanPreview } from '../../../protection-cards/plan-preview';
import { MONEY_PURPOSES, type MoneyPurpose } from '../../../../constants/money-purpose';
import { ArchetypeStrip } from './ArchetypeStrip';
import { PHILOSOPHY_CTA, VALUES_LENSES, staggerChild, phaseVariants, type ValuesLens } from './phase-config';

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
  moneyPurpose: MoneyPurpose | null;
  setMoneyPurpose: (v: MoneyPurpose) => void;
  isWalletConnected: boolean;
  onConnectWallet?: () => Promise<void> | void;
  handleFinish: () => void;
  enableDemoMode: () => void;
  riskData: { flag: string } | null;
  onBackToRisk: () => void;
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
  moneyPurpose,
  setMoneyPurpose,
  isWalletConnected,
  onConnectWallet,
  handleFinish,
  enableDemoMode,
  riskData,
  onBackToRisk,
}: PhilosophyPhaseProps) {
  return (
    <motion.div
      key="phase-philosophy"
      variants={phaseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full max-w-md"
    >
      <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
        How will you protect your{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300">
          savings?
        </span>
      </motion.h2>
      <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-4">
        Tap a coin to see what it means — tap again to make it yours. Flick left or right to browse.
      </motion.p>

      {/* Stage — a fixed-height canvas holding BOTH the coin
          row and the lens detail as overlapping layers. Tap a
          coin: the others combine into it (the choreography
          cycles through three variations), then the detail
          blooms out of the chosen coin's exact slot. Fixed
          height + overlapping layers — nothing below the
          stage ever moves. */}
      <motion.div variants={staggerChild} className="relative h-[300px] mb-4">
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
              className="absolute inset-0 flex flex-col justify-center px-2 z-10"
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
                  <p className="text-sm font-black text-white truncate">
                    {showAllApproaches ? 'All approaches' : activeLens.label}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {showAllApproaches
                      ? 'Every approach in one list.'
                      : activeLens.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {!showAllApproaches && (
                    <button
                      type="button"
                      onClick={() => setShowAllApproaches(true)}
                      className="min-h-[44px] px-1 text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded"
                    >
                      All 8 →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBackToCoins}
                    className="min-h-[44px] px-2 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                  >
                    ← Coins
                  </button>
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
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <PlanPreviewCard preview={planPreview} currencyPrefix={localPrefix} />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="prompt"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="px-2 text-[11px] text-slate-400 text-center"
                    >
                      Tap an approach to preview its plan.
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Caption — names the next action, not a philosophy
            lecture. Hidden when the lens detail is showing. */}
        <AnimatePresence>
          {!activeLens && (
            <motion.p
              key="coin-caption"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="absolute bottom-2 left-0 right-0 text-center text-[11px] leading-snug text-slate-400 px-2"
            >
              Tap a coin to see the plan, or ← Back to risk data.
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Money purpose — compact single-line segmented control.
          Icon + label per chip; the heading + description caption
          are gone (chip labels already say it). */}
      <motion.div variants={staggerChild} className="mb-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800/70 p-1" role="radiogroup" aria-label="When you will need this money">
          {MONEY_PURPOSES.map((purpose) => (
            <button
              key={purpose.value}
              type="button"
              role="radio"
              aria-checked={moneyPurpose === purpose.value}
              onClick={() => setMoneyPurpose(purpose.value)}
              aria-label={purpose.label}
              className={`min-h-[44px] rounded-lg px-1 py-2 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                moneyPurpose === purpose.value
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <span aria-hidden="true">{purpose.icon}</span>{' '}
              {purpose.value === 'everyday_buffer'
                ? 'Soon'
                : purpose.value === 'long_term_savings'
                ? 'Years'
                : 'By date'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Actions — archetype-aware when a philosophy is selected */}
      <motion.div variants={staggerChild} className="space-y-2">
        {selectedArchetype ? (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={async () => {
              if (onConnectWallet && !isWalletConnected) {
                try { await onConnectWallet(); } catch { /* fall through */ }
              }
              handleFinish();
            }}
            className="w-full px-6 py-4 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2"
            style={{
              background: `linear-gradient(135deg, ${ARCHETYPES[selectedArchetype].accent}, ${ARCHETYPES[selectedArchetype].accentSoft})`,
              boxShadow: `0 12px 32px -12px ${ARCHETYPES[selectedArchetype].accent}80`,
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <ShimmerText>{PHILOSOPHY_CTA[selectedArchetype]} →</ShimmerText>
          </motion.button>
        ) : (
          <>
            {onConnectWallet && !isWalletConnected && (
              <motion.button
                onClick={async () => {
                  try { await onConnectWallet(); } catch { /* fall through */ }
                  handleFinish();
                }}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Connect Wallet to Get Started
              </motion.button>
            )}
          </>
        )}
        <button
          onClick={() => {
            // Actually enable demo mode so the user gets the
            // mock wallet + demo data, not just a route to
            // Protect with an unconnected wallet.
            enableDemoMode();
            handleFinish();
          }}
          className="w-full px-6 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
        >
          Explore demo first
        </button>
        {riskData && (
          <button
            onClick={onBackToRisk}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
          >
            ← Back to risk data
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

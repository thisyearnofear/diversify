/**
 * ArchetypeStrip — compact flickable cards for the phase-3 stage.
 *
 * One row, horizontal scroll: 2 archetypes or all 8 fit the same fixed
 * stage without growing it. The active card's coin flips (minting motif);
 * the accent border alone says "selected" — no badge.
 */

import { motion } from 'framer-motion';
import { Coin } from '../../../shared/FloatingCoins';
import { ARCHETYPES, type ArchetypeId } from '../../../protection-cards/tokens';

export function ArchetypeStrip({
  ids,
  activeId,
  onSelect,
}: {
  ids: ArchetypeId[];
  activeId: ArchetypeId | null;
  onSelect: (id: ArchetypeId) => void;
}) {
  // Short lists (a lens shows 1-3 archetypes) centre instead of hugging the
  // left edge — scrolling is only needed for the "All 8" view.
  const centerWhenShort = ids.length <= 2 ? 'justify-center' : '';
  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 ${centerWhenShort}`}
      role="radiogroup"
      aria-label="Approaches"
    >
      {ids.map((id) => {
        const a = ARCHETYPES[id];
        const isActive = activeId === id;
        const isDimmed = activeId !== null && !isActive;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(id)}
            className={`w-[190px] flex-shrink-0 min-h-[44px] p-3 rounded-2xl border-2 text-left flex items-start gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              isActive
                ? 'bg-white dark:bg-gray-800'
                : isDimmed
                ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-40'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-600'
            }`}
            style={isActive ? { borderColor: a.accent, boxShadow: `0 8px 24px -12px ${a.accent}60` } : undefined}
          >
            {/* Archetype coin — flips like a freshly minted coin when selected */}
            <motion.span
              className="w-8 h-8 flex-shrink-0"
              animate={isActive ? { rotateY: 360, scale: 1.1 } : { rotateY: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              style={{ transformPerspective: 400 }}
            >
              <Coin size={32} symbol={a.name[0]} color={a.accent} variant="selection" />
            </motion.span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-black text-gray-900 dark:text-white truncate">{a.name}</span>
              <span className="block mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">{a.philosophy}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

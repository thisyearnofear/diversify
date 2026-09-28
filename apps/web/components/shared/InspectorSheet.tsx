/**
 * InspectorSheet — selection-bound detail. Empty selection = closed.
 *
 * Origami fold from the top of the sheet (design-language §5). The sheet
 * follows the finger when dragged by its handle and dismisses on distance
 * OR a downward flick; a short, slow drag springs back. Escape and the
 * browser back gesture close it too (useDismissibleLayer).
 * Reduced-motion skips the fold; content is identical.
 */

import React from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { spring } from "@/lib/motion-tokens";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";

interface InspectorSheetProps {
  /** Selection key. Null/undefined closes the sheet. */
  selectedId: string | null | undefined;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const FOLD = {
  initial: { rotateX: -88, opacity: 0, height: 0 },
  animate: { rotateX: 0, opacity: 1, height: "auto" },
  exit: { rotateX: -88, opacity: 0, height: 0 },
};

const INSTANT = {
  initial: { opacity: 1, height: "auto" },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
};

/** Dismiss when dragged this far down… */
export const DISMISS_OFFSET_PX = 80;
/** …or flicked down at least this fast (px/s), however short the drag. */
export const DISMISS_VELOCITY_PX_S = 500;

export function shouldDismissDrag(info: Pick<PanInfo, "offset" | "velocity">): boolean {
  return (
    info.offset.y > DISMISS_OFFSET_PX ||
    (info.offset.y > 0 && info.velocity.y > DISMISS_VELOCITY_PX_S)
  );
}

export function InspectorSheet({
  selectedId,
  onClose,
  title,
  children,
  className = "",
}: InspectorSheetProps) {
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const open = Boolean(selectedId);
  const variants = reducedMotion ? INSTANT : FOLD;

  useDismissibleLayer(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key={selectedId}
          role="region"
          aria-label={title}
          data-testid="inspector-sheet"
          data-selected-id={selectedId}
          className={`mt-3 overflow-hidden rounded-2xl bg-surface border border-gray-200/70 dark:border-white/[0.06] origin-top ${className}`.trim()}
          style={{ perspective: 800 }}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={reducedMotion ? { duration: 0 } : spring}
          // Drag starts only from the handle (dragListener off) so content
          // stays scrollable/selectable. Down tracks the finger ~1:1, up
          // barely moves; release springs back unless it's a dismiss.
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.9 }}
          onDragEnd={(_e, info) => {
            if (shouldDismissDrag(info)) onClose();
          }}
        >
          <div
            className="w-full flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            data-testid="inspector-sheet-handle"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span
              aria-hidden="true"
              className="block w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"
            />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pt-1 pb-1">
            <h3 className="text-sm font-semibold text-ink">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="min-h-tap min-w-tap -mr-2 text-ink-subtle hover:text-gray-700 dark:hover:text-gray-200 text-lg font-bold transition-colors"
              aria-label="Close inspector"
            >
              ×
            </button>
          </div>
          <div className="px-4 pb-4">{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export default InspectorSheet;

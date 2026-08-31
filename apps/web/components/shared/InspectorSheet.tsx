/**
 * InspectorSheet — selection-bound detail. Empty selection = closed.
 *
 * Origami fold from the top of the sheet (design-language §5). Drag the
 * handle down to dismiss (same pointer-capture pattern as the chat drawer).
 * Reduced-motion skips the fold; content is identical.
 */

import React, { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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

export function InspectorSheet({
  selectedId,
  onClose,
  title,
  children,
  className = "",
}: InspectorSheetProps) {
  const reducedMotion = useReducedMotion();
  const dragStartYRef = useRef<number | null>(null);
  const open = Boolean(selectedId);
  const variants = reducedMotion ? INSTANT : FOLD;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key={selectedId}
          role="region"
          aria-label={title}
          data-testid="inspector-sheet"
          data-selected-id={selectedId}
          className={`mt-3 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-white/[0.06] origin-top ${className}`.trim()}
          style={{ perspective: 800 }}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 280, damping: 28 }
          }
        >
          <div
            className="w-full flex justify-center pt-2 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStartYRef.current = e.clientY;
            }}
            onPointerMove={(e) => {
              if (dragStartYRef.current === null) return;
              if (e.pointerType === "mouse" && e.buttons === 0) {
                dragStartYRef.current = null;
                return;
              }
              const deltaY = e.clientY - dragStartYRef.current;
              if (deltaY > 80) {
                dragStartYRef.current = null;
                onClose();
              }
            }}
            onPointerUp={() => {
              dragStartYRef.current = null;
            }}
          >
            <span
              aria-hidden="true"
              className="block w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"
            />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] -mr-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg font-bold transition-colors"
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

/**
 * PickerSheetShell — the shared chrome for searchable bottom-sheet pickers.
 *
 * Portal + scrim + dialog + drag handle + title + close + search + scrollable
 * list slot. Extracted from TokenPickerSheet so every picker in the app opens
 * the same modal instead of some tabs getting a sheet and others a native
 * `<select>` (whose OS-rendered dialog matches nothing in the product).
 *
 * The shell owns chrome-only concerns: Escape/back dismissal
 * (useDismissibleLayer, topmost only), body scroll lock, search autofocus on
 * open, and the drag-to-dismiss handle. Query state stays controlled by the
 * consumer (`query`/`onQueryChange`) so filtering, sorting, and disclosure
 * (show-all, flips) live with the rows they describe — hooks stay in the
 * consumer's body, never in a render prop.
 *
 * Bottom sheet on small screens, centered dialog on larger ones — same as
 * the picker it was extracted from, so Exchange renders pixel-identical.
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls, useReducedMotion } from "framer-motion";
import Scrim from "./Scrim";
import { spring } from "@/lib/motion-tokens";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";
import { shouldDismissDrag, useDismissDetent } from "./InspectorSheet";

interface PickerSheetShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Controlled search — owned by the consumer alongside its filtering. */
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  closeButtonAriaLabel: string;
  children: React.ReactNode;
}

export function PickerSheetShell({
  isOpen,
  onClose,
  title,
  query,
  onQueryChange,
  searchPlaceholder,
  searchAriaLabel,
  closeButtonAriaLabel,
  children,
}: PickerSheetShellProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const detent = useDismissDetent();

  // Escape + back gesture close the picker (topmost layer only).
  useDismissibleLayer(isOpen, onClose);

  // Focus search shortly after open — the sheet is a picking task, and the
  // keyboard is the fastest path through a long list.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {/* Scrim is a sibling, not a child: nested, its fixed z-[49]
          would paint above the panel (z-auto) and swallow its clicks. */}
      {isOpen && <Scrim intensity="light" onClick={onClose} />}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={onClose}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }}
            transition={spring}
            className="relative w-full sm:max-w-md max-h-[80dvh] bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            // Bottom sheet tracks the finger from its header; a long drag
            // or a downward flick dismisses, anything else springs back.
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragStart={detent.onDragStart}
            onDrag={detent.onDrag}
            onDragEnd={(_e, info) => {
              if (shouldDismissDrag(info)) onClose();
            }}
          >
            {/* Header — the drag handle. Controls inside it opt out. */}
            <div
              className="px-4 pt-2 pb-3 border-b border-gray-100 dark:border-gray-800"
              style={{ touchAction: "none" }}
              data-testid="picker-sheet-handle"
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("input, button")) return;
                dragControls.start(e);
              }}
            >
              <div className="flex justify-center pb-2 sm:hidden" aria-hidden="true">
                <span className="block w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-tight text-ink">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeButtonAriaLabel}
                  className="group size-tap -my-1.5 -mr-1.5 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {/* 32px visual disc inside a 44px hit area. */}
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              </div>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchAriaLabel}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                />
              </div>
            </div>

            {/* List slot — rows, empty state, and disclosure live here. */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 custom-scrollbar">
              {children}
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

export default PickerSheetShell;

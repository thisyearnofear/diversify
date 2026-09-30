/**
 * InspectorSheet — selection-bound detail. Empty selection = closed.
 *
 * Origami fold from the top of the sheet (design-language §5). The sheet
 * follows the finger when dragged by its handle and dismisses on distance
 * OR a downward flick; a short, slow drag springs back. Escape and the
 * browser back gesture close it too (useDismissibleLayer).
 * Reduced-motion skips the fold; content is identical.
 */

import React, { useEffect, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useIsPresent,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { press, spring, springPress, springSoft } from "@/lib/motion-tokens";
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer";
import { useInstrumentInspectorPlacement } from "./InstrumentShell";
import { haptics } from "@/lib/haptics";

interface InspectorSheetProps {
  /** Selection key. Null/undefined closes the sheet. */
  selectedId: string | null | undefined;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  presentation?: "sheet" | "stage";
}

const FOLD = {
  initial: { x: 0, rotateX: -88, opacity: 0, height: 0 },
  animate: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  exit: { x: 0, rotateX: -88, opacity: 0, height: 0 },
};

const SIDE = {
  initial: { x: 12, rotateX: 0, opacity: 0, height: "auto" },
  animate: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  exit: { x: 12, rotateX: 0, opacity: 0, height: "auto" },
};

const INSTANT = {
  initial: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  animate: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  exit: { x: 0, rotateX: 0, opacity: 0, height: 0 },
};

const SIDE_INSTANT = {
  initial: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  animate: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  exit: { x: 0, rotateX: 0, opacity: 0, height: "auto" },
};

const STAGE = {
  initial: { x: 0, rotateX: 0, opacity: 0, height: "auto" },
  animate: { x: 0, rotateX: 0, opacity: 1, height: "auto" },
  exit: { x: 0, rotateX: 0, opacity: 0, height: "auto" },
};

type InspectorSectionProps = React.ComponentProps<typeof motion.section> & {
  stage?: boolean;
};

const InspectorSection = React.forwardRef<HTMLElement, InspectorSectionProps>(
  function InspectorSection({ stage = false, style, ...rest }, ref) {
    const present = useIsPresent();
    return (
      <motion.section
        ref={ref}
        inert={present ? undefined : true}
        aria-hidden={present ? undefined : true}
        style={{
          ...style,
          ...(stage && !present
            ? { position: "absolute", insetInline: 0, top: 0 }
            : null),
          ...(present ? null : { pointerEvents: "none" }),
        }}
        {...rest}
      />
    );
  },
);

function isRestorable(el: HTMLElement | null): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if ("disabled" in el && el.disabled === true) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.inert || node.hidden) return false;
    if (node.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

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

/**
 * The detent: one light tick the moment a drag crosses the dismiss line,
 * so you feel "let go now closes it" before you let go. Dragging back
 * above the line re-arms it; it never repeats while you hover past it.
 */
export function useDismissDetent() {
  const pastRef = useRef(false);
  return {
    onDragStart: () => {
      pastRef.current = false;
    },
    onDrag: (_e: unknown, info: Pick<PanInfo, "offset">) => {
      const past = info.offset.y > DISMISS_OFFSET_PX;
      if (past && !pastRef.current) haptics.tap();
      pastRef.current = past;
    },
  };
}

export function InspectorSheet({
  selectedId,
  onClose,
  title,
  children,
  className = "",
  presentation = "sheet",
}: InspectorSheetProps) {
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const placement = useInstrumentInspectorPlacement();
  const open = Boolean(selectedId);
  const stage = presentation === "stage";
  const variants = stage
    ? STAGE
    : reducedMotion
      ? placement === "side"
        ? SIDE_INSTANT
        : INSTANT
      : placement === "side"
        ? SIDE
        : FOLD;
  const detent = useDismissDetent();

  const triggerRef = useRef<HTMLElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const pendingRestoreRef = useRef<HTMLElement | null>(null);
  const sheetElRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const selectedIdRef = useRef<string | null | undefined>(selectedId);

  useEffect(() => {
    if (open || typeof document === "undefined") return;
    const seed = document.activeElement;
    lastFocusedRef.current =
      seed instanceof HTMLElement && seed !== document.body ? seed : null;
    const onFocusIn = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && t !== document.body) {
        lastFocusedRef.current = t;
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  useEffect(() => {
    const prev = selectedIdRef.current;
    selectedIdRef.current = selectedId;
    if (open && prev == null) {
      const el = document.activeElement;
      triggerRef.current =
        el instanceof HTMLElement && el !== document.body
          ? el
          : lastFocusedRef.current;
      pendingRestoreRef.current = null;
    } else if (!open && prev != null) {
      const active = document.activeElement;
      const trigger = triggerRef.current;
      const insideSheet = sheetElRef.current?.contains(active) ?? false;
      if (
        active === document.body ||
        insideSheet ||
        (trigger != null && active === trigger)
      ) {
        pendingRestoreRef.current = trigger;
      }
    }
  }, [open, selectedId]);

  useDismissibleLayer(open, onClose);

  return (
    <AnimatePresence
      onExitComplete={() => {
        const target = pendingRestoreRef.current;
        pendingRestoreRef.current = null;
        const active = document.activeElement;
        if (
          target &&
          !openRef.current &&
          (active === document.body ||
            active === target ||
            !(active instanceof HTMLElement) ||
            !active.isConnected ||
            (sheetElRef.current?.contains(active) ?? false)) &&
          isRestorable(target)
        ) {
          target.focus({ preventScroll: true });
        }
      }}
    >
      {open && (
        <InspectorSection
          key={selectedId}
          stage={stage}
          ref={sheetElRef}
          role="region"
          aria-label={title}
          data-testid="inspector-sheet"
          data-selected-id={selectedId}
          className={
            stage
              ? `mt-3 ${className}`.trim()
              : `mt-3 overflow-hidden rounded-2xl bg-surface border border-gray-200/70 dark:border-white/[0.06] origin-top ${className}`.trim()
          }
          style={stage ? undefined : { perspective: 800 }}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={
            reducedMotion
              ? { duration: 0 }
              : stage || placement === "side"
                ? springSoft
                : spring
          }
          // Drag starts only from the handle (dragListener off) so content
          // stays scrollable/selectable. Down tracks the finger ~1:1, up
          // barely moves; release springs back unless it's a dismiss.
          drag={stage ? false : "y"}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={stage ? undefined : { top: 0, bottom: 0 }}
          dragElastic={stage ? undefined : { top: 0.05, bottom: 0.9 }}
          onDragStart={stage ? undefined : detent.onDragStart}
          onDrag={stage ? undefined : detent.onDrag}
          onDragEnd={
            stage
              ? undefined
              : (_e, info) => {
                  if (shouldDismissDrag(info)) onClose();
                }
          }
        >
          {!stage && (
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
          )}
          {stage ? (
            <div className="flex items-start justify-between gap-3">
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={reducedMotion ? undefined : press}
                transition={springPress}
                className="min-h-tap text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                aria-label="Close inspector"
              >
                ← Back
              </motion.button>
              <h3 className="sr-only">{title}</h3>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3 px-4 pt-1 pb-1">
              <h3 className="text-sm font-semibold text-ink">
                {title}
              </h3>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={reducedMotion ? undefined : press}
                transition={springPress}
                className="min-h-tap min-w-tap -mr-2 text-ink-subtle hover:text-gray-700 dark:hover:text-gray-200 text-lg font-bold transition-colors"
                aria-label="Close inspector"
              >
                ×
              </motion.button>
            </div>
          )}
          <div className={stage ? "" : "px-4 pb-4"}>{children}</div>
        </InspectorSection>
      )}
    </AnimatePresence>
  );
}

export default InspectorSheet;

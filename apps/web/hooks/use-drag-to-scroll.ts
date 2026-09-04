import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useDragToScroll — pointer drag + flick momentum for horizontal scroll rows.
 *
 * The §5 flick grammar from LensCoinSelector (flick = offset ≥ 50px or
 * velocity ≥ 350px/s) applied to a native overflow-x container. Pointer
 * events only, so touch keeps the platform's native momentum scroll and
 * mouse users finally get a working drag (the input that was missing).
 *
 * Click suppression: after a real drag or flick, the imminent click on the
 * card under the cursor is swallowed once (capture-phase, then removed) so
 * releasing a drag doesn't select whatever ended up under the pointer.
 *
 * Reduced motion: drag still works (it is user-initiated input, not
 * decoration — §5 permits motion that the user causes), but no inertial
 * glide after release.
 */
export function useDragToScroll(options?: { reducedMotion?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = options?.reducedMotion ?? false;

  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastT: 0,
    velocityX: 0,
    dragging: false,
    moved: false,
  });
  const swallowRef = useRef<((ev: MouseEvent) => void) | null>(null);
  // Latched for one gesture: cards read this in onClick as a second guard
  // against drag-release being interpreted as a selection.
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Touch uses native scrolling; only mouse/pen need the drag affordance.
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    // A new interaction begins: any click-suppression trap left over from a
    // previous drag is dead — the next genuine press+click must survive.
    if (swallowRef.current) {
      el.removeEventListener("click", swallowRef.current, true);
      swallowRef.current = null;
    }
    const s = dragState.current;
    s.pointerId = e.pointerId;
    s.startX = e.clientX;
    s.startScrollLeft = el.scrollLeft;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.velocityX = 0;
    s.dragging = true;
    s.moved = false;
    didDragRef.current = false;
    setIsDragging(false);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s.dragging || e.pointerId !== s.pointerId) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - s.startX;
      if (!s.moved && Math.abs(dx) < 4) return; // dead zone — let clicks be clicks
      s.moved = true;
      didDragRef.current = true;
      if (el.setPointerCapture && s.pointerId >= 0) {
        try {
          el.setPointerCapture(s.pointerId);
        } catch {
          /* pointer may already be gone */
        }
      }
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT);
      s.velocityX = ((e.clientX - s.lastX) / dt) * 1000; // px/s
      s.lastX = e.clientX;
      s.lastT = now;
      el.scrollLeft = s.startScrollLeft - dx;
      if (!s.dragging || !isDragging) setIsDragging(true);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s.dragging || e.pointerId !== s.pointerId) return;
      s.dragging = false;
      s.pointerId = -1;
      setIsDragging(false);
      const el = containerRef.current;
      if (!el) return;

      const flicked = Math.abs(s.velocityX) >= 350;
      if (s.moved) {
        swallowRef.current = suppressNextClick(el);
        if (flicked && !reducedMotion && typeof el.scrollBy === "function") {
          // Momentum glide: same distance a native touch flick would carry.
          const glide = (s.velocityX / 1000) * 160;
          el.scrollBy({ left: -glide, behavior: "smooth" });
        }
      }
      s.moved = false;
      s.velocityX = 0;
    },
    [reducedMotion],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (e.pointerId !== s.pointerId) return;
    s.dragging = false;
    s.pointerId = -1;
    s.moved = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.touchAction = "pan-x"; // horizontal pan stays native
  }, []);

  return {
    containerRef,
    isDragging,
    didDragRef,
    containerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      className: isDragging ? "cursor-grabbing select-none" : "",
    } as const,
  };
}

/**
 * Swallow exactly one click on `el`'s subtree (capture phase). Returns the
 * trap so onPointerDown can revoke it early — a later press+click must
 * never be eaten (keyboard activation too, which fires no pointer events;
 * the timeout belt-and-braces covers that case).
 */
function suppressNextClick(el: HTMLElement) {
  const swallow = (ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    el.removeEventListener("click", swallow, true);
  };
  el.addEventListener("click", swallow, { capture: true, once: true });
  // If no click follows (release happened outside any card), drop the
  // trap so it can never eat a later, genuine click. The click event for
  // this gesture fires synchronously after pointerup — before this timer.
  setTimeout(() => el.removeEventListener("click", swallow, true), 0);
  return swallow;
}

/**
 * FlickScrollRow — the §5 flick-scroll-row primitive.
 *
 * Horizontal chip/card rows scroll by native touch, pointer drag with
 * momentum on mouse/pen (useDragToScroll — the LensCoinSelector flick
 * grammar), and chevron buttons. `snap-proximity`, never
 * `snap-mandatory`. Edge fades make overflow discoverable; chevrons make
 * it reachable by any input. This is the ONLY sanctioned horizontal
 * scroll row — new rows compose it instead of re-rolling overflow-x-auto.
 *
 * Interactive children must ignore clicks that end a drag:
 * `const didDragRef = useDidDrag();` then `onClick={() => didDragRef.current ? null : select()}`.
 * The context defaults to a never-dragged ref, so children stay usable
 * outside a row.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";

const FlickScrollRowContext = createContext<{
  didDragRef: React.MutableRefObject<boolean>;
}>({
  didDragRef: { current: false },
});

/** Drag guard for interactive children of a FlickScrollRow (see above). */
export function useDidDrag() {
  return useContext(FlickScrollRowContext).didDragRef;
}

/** Fade color must be a static Tailwind class — map allowed variants here. */
const FADE_CLASS: Record<"dark" | "slate", { left: string; right: string }> = {
  dark: {
    left: "bg-gradient-to-r from-gray-900/90 to-transparent",
    right: "bg-gradient-to-l from-gray-900/90 to-transparent",
  },
  slate: {
    left: "bg-gradient-to-r from-slate-900/90 to-transparent",
    right: "bg-gradient-to-l from-slate-900/90 to-transparent",
  },
};

export interface FlickScrollRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Track classes: gap, padding, centering. (overflow/snap/scrollbar are owned here.) */
  className?: string;
  /** Fade color matched to the surface behind the row. Default "dark". */
  fade?: "dark" | "slate";
  /** Edge fade width in px. Default 24 — or the chevron gutter when
   *  chevrons are on, since a fade narrower than the button that covers it
   *  leaves content hard-sliced under an opaque circle. */
  edgeSize?: number;
  /** Chevron page buttons (hidden at the edges). Default true. */
  chevrons?: boolean;
}

/** Chevron hit area (size-11) + the breathing room it needs. */
const CHEVRON_GUTTER = 56;

export function FlickScrollRow({
  children,
  className = "",
  fade = "dark",
  edgeSize = 24,
  chevrons = true,
  ...rest
}: FlickScrollRowProps) {
  const { containerRef, containerProps, didDragRef } = useDragToScroll();
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const updateEdges = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, [containerRef]);

  useEffect(() => {
    updateEdges();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateEdges)
        : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro?.disconnect();
    };
  }, [containerRef, updateEdges]);

  const CARD_STEP = 276; // one card + gap — comfortable chevron page
  const page = (dir: 1 | -1) => {
    const el = containerRef.current;
    if (el && typeof el.scrollBy === "function") {
      el.scrollBy({ left: dir * CARD_STEP, behavior: "smooth" });
    }
  };

  const fades = FADE_CLASS[fade];
  const { className: dragClassName, ...dragHandlers } = containerProps;

  /* The chevrons are `absolute` overlays on the track, so a fade narrower
     than the button leaves content hard-sliced under an opaque circle — on
     Shield's philosophy rail the seventh coin's two-line label ran under the
     chevron. Two fixes, both safe for rows that DON'T overflow:

       1. the fade is at least as wide as the chevron that covers it, so
          content dissolves under the button instead of being sliced;
       2. the chevron is translucent glass, so a coin passing beneath it
          during a scroll still reads as being behind it.

     An earlier attempt also added `padding-right: CHEVRON_GUTTER` to reserve
     trailing space. That was wrong: it inflated `scrollWidth` past
     `clientWidth` on rows that already fit, so `atEnd` never became true and
     the forward chevron appeared advertising a scroll that did not exist. The
     row's own `overflow` is what clips a coin at capacity — padding cannot
     fix that, and adding it only broke the edge detection. */
  const fadeWidth = chevrons ? Math.max(edgeSize, CHEVRON_GUTTER) : edgeSize;
  const chevronSurface =
    "bg-white/80 backdrop-blur-sm shadow-md border border-gray-200";

  return (
    <div className="relative" data-testid="flick-row">
      <div
        aria-hidden="true"
        data-testid="flick-row-fade-left"
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 transition-opacity duration-200 ${fades.left} ${atStart ? "opacity-0" : "opacity-100"}`}
        style={{ width: fadeWidth }}
      />
      <div
        aria-hidden="true"
        data-testid="flick-row-fade-right"
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 transition-opacity duration-200 ${fades.right} ${atEnd ? "opacity-0" : "opacity-100"}`}
        style={{ width: fadeWidth }}
      />

      {chevrons && !atStart && (
        <button
          type="button"
          data-testid="flick-row-prev"
          aria-label="Scroll back"
          onClick={() => page(-1)}
          className={`absolute left-1 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full ${chevronSurface} text-gray-800 hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400`}
        >
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      {chevrons && !atEnd && (
        <button
          type="button"
          data-testid="flick-row-next"
          aria-label="Scroll forward"
          onClick={() => page(1)}
          className={`absolute right-1 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full ${chevronSurface} text-gray-800 hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400`}
        >
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      <div
        ref={containerRef}
        {...dragHandlers}
        {...rest}
        data-testid="flick-row-track"
        className={`flex overflow-x-auto snap-x snap-proximity scrollbar-hide ${dragClassName ?? ""} ${className}`}
      >
        {/* Children read didDragRef via useDidDrag() — the provider was
            missing, so drag-release clicks used to select. */}
        <FlickScrollRowContext.Provider value={{ didDragRef }}>
          {children}
        </FlickScrollRowContext.Provider>
      </div>
    </div>
  );
}

export default FlickScrollRow;

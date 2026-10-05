/**
 * ProtagonistFlight — the user's currency coin travels between instruments.
 *
 * One object, four scenes (docs/archive/storytelling-brief-2026-10.md §1): the
 * currency coin on Home is the same coin absorbed into Shield's ring, the
 * "from" coin on Exchange's beam, and the Guardian's belly coin. Each tab
 * marks where the coin lives with `protagonistAnchor(...)`; on a tab change
 * this overlay flies a `Coin` from the outgoing anchor to the incoming one,
 * hides the landing anchor for the flight, then hands the scene back.
 *
 * Contract: one-shot (~0.5s), only on a real tab change, never on first
 * mount, never a loop. Reduced motion or a missing anchor → no flight; the
 * content is identical either way.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coin } from "@/components/shared/FloatingCoins";
import {
  ANCHOR_ATTR,
  COLOR_ATTR,
  HOLDS_ATTR,
  LANDING_ATTR,
  MODE_ATTR,
  SYMBOL_ATTR,
  holdsCurrency,
} from "@/components/shared/protagonist-anchor";

const FLIGHT_S = 0.52;
/** The coin's size inside an absorbing anchor (the ring hole). */
const HOLE_RATIO = 0.32;
/** The incoming pane slides in over 0.18s; measure after it settles. */
const SETTLE_MS = 200;
const FIND_TIMEOUT_MS = 1500;

interface Box {
  x: number;
  y: number;
  size: number;
}

interface Flight {
  id: number;
  from: Box;
  to: Box;
  absorb: boolean;
  symbol: string;
  color: string;
}

function visibleBox(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return null;
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    size: Math.min(r.width, r.height),
  };
}

function anchorsFor(tab: string): Element[] {
  return Array.from(document.querySelectorAll(`[${ANCHOR_ATTR}="${tab}"]`));
}

/** The incoming tab's live anchor — the outgoing/hidden panes are inert. */
function liveAnchor(tab: string): Element | null {
  return (
    anchorsFor(tab).find(
      (el) => !el.closest("[inert], [aria-hidden='true']") && visibleBox(el),
    ) ?? null
  );
}

function identity(): { symbol: string; color: string } | null {
  const el = document.querySelector(`[${SYMBOL_ATTR}]`);
  const symbol = el?.getAttribute(SYMBOL_ATTR);
  if (!symbol) return null;
  return { symbol, color: el?.getAttribute(COLOR_ATTR) ?? "#2563eb" };
}

export default function ProtagonistFlight({ activeTab }: { activeTab: string }) {
  const reduced = useReducedMotion();
  const prevTab = useRef(activeTab);
  const landing = useRef<Element | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);

  const release = () => {
    landing.current?.removeAttribute(LANDING_ATTR);
    landing.current = null;
  };

  // Layout effect: the outgoing pane is still where the user last saw it.
  useLayoutEffect(() => {
    const from = prevTab.current;
    prevTab.current = activeTab;
    if (from === activeTab || reduced) return;

    release();
    setFlight(null);
    const who = identity();
    if (!who) return;
    const originEl = anchorsFor(from).find((el) => visibleBox(el)) ?? null;
    if (originEl && !holdsCurrency(originEl.getAttribute(HOLDS_ATTR), who.symbol)) return;
    const originBox = visibleBox(originEl);
    // Leaving the ring, the coin rises out of its hole, not the whole ring.
    const origin =
      originBox && originEl?.getAttribute(MODE_ATTR) === "absorb"
        ? { ...originBox, size: originBox.size * HOLE_RATIO }
        : originBox;
    if (!origin) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    const seek = () => {
      if (cancelled) return;
      const target = liveAnchor(activeTab);
      if (!target) {
        if (performance.now() - started < FIND_TIMEOUT_MS) timer = setTimeout(seek, 60);
        return;
      }
      if (!holdsCurrency(target.getAttribute(HOLDS_ATTR), who.symbol)) return;
      // A 'land' anchor IS a coin — hide it so the flyer can become it. An
      // 'absorb' anchor (the ring) stays; the coin sinks into its hole.
      const absorb = target.getAttribute(MODE_ATTR) === "absorb";
      if (!absorb) {
        target.setAttribute(LANDING_ATTR, "");
        landing.current = target;
      }
      timer = setTimeout(() => {
        if (cancelled) return;
        const to = visibleBox(target);
        if (!to) return release();
        setFlight({
          id: started,
          from: origin,
          to,
          absorb,
          symbol: who.symbol,
          color: who.color,
        });
      }, SETTLE_MS);
    };
    seek();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeTab, reduced]);

  useEffect(() => release, []);

  if (!flight) return null;
  const { from, to, absorb } = flight;
  const base = from.size;
  const endSize = absorb ? to.size * HOLE_RATIO : to.size;
  // A shallow arc: the coin lifts on its way, as if handed across.
  const lift = Math.min(from.y, to.y) - Math.min(80, Math.abs(to.x - from.x) * 0.25 + 24);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30">
      <motion.div
        key={flight.id}
        data-testid="protagonist-flight"
        className="absolute left-0 top-0"
        style={{ width: base, height: base, marginLeft: -base / 2, marginTop: -base / 2 }}
        initial={{ x: from.x, y: from.y, scale: 1, opacity: 1 }}
        animate={{
          x: [from.x, (from.x + to.x) / 2, to.x],
          y: [from.y, lift, to.y],
          scale: [1, 1, endSize / base],
          opacity: absorb ? [1, 1, 0] : 1,
        }}
        transition={{ duration: FLIGHT_S, ease: [0.32, 0.72, 0, 1], times: [0, 0.45, 1] }}
        onAnimationComplete={() => {
          release();
          setFlight(null);
        }}
      >
        <Coin size={base} symbol={flight.symbol} color={flight.color} shine={false} />
      </motion.div>
    </div>
  );
}

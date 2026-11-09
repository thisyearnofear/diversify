/**
 * Shared SVGator document builders — Guardian mark, coins, easings, text.
 * Emits SVGator document JSON (element trees), never SVG strings.
 * Geometry imports from the app's single sources of truth.
 */
import {
  SHIELD_D, VISOR_D, EYES, COIN, GUARDIAN_PALETTE,
} from '../../apps/web/components/shared/guardian-mark';
import { FOUNDRY_METAL_STOPS } from '../../apps/web/lib/foundry';

/* ---------- ids ---------- */
let seq = 0;
export const nid = (p: string) => `${p}-${(seq++).toString(36)}`;
export const resetIds = () => { seq = 0; };

/* ---------- easing ---------- */
type Bez = { from: { x: number; y: number }; to: { x: number; y: number } };
export const EZ = {
  out: (x1 = 0.16, x2 = 0.3): { type: string; value: Bez } => ({
    type: 'cubic-bezier',
    value: { from: { x: x1, y: 1 }, to: { x: x2, y: 1 } },
  }),
  settle: (): { type: string; value: Bez } => ({
    type: 'cubic-bezier',
    value: { from: { x: 0.4, y: 0 }, to: { x: 0.2, y: 1 } },
  }),
  blink: (): { type: string; value: Bez } => ({
    type: 'cubic-bezier',
    value: { from: { x: 0.4, y: 0 }, to: { x: 1, y: 1 } },
  }),
  /** ease-out with spring overshoot past 1 (y > 1 on the "to" handle) */
  spring: (overshoot = 1.3): { type: string; value: Bez } => ({
    type: 'cubic-bezier',
    value: { from: { x: 0.3, y: 0 }, to: { x: 0.4, y: overshoot } },
  }),
  inout: (): { type: string; value: Bez } => ({
    type: 'cubic-bezier',
    value: { from: { x: 0.42, y: 0 }, to: { x: 0.58, y: 1 } },
  }),
  linear: { type: 'linear', value: null } as const,
};

/* ---------- paint ---------- */
export const rgb = (hex: string, a = 1) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a,
  };
};
export const colorPaint = (hex: string, a = 1) => ({ type: 'color', value: rgb(hex, a) });
export const noPaint = { type: 'none' };
export const metalPaint = (material: keyof typeof FOUNDRY_METAL_STOPS, vertical = true) => ({
  type: 'linear-gradient',
  value: {
    from: { x: 0.5, y: vertical ? 0 : 0 },
    to: { x: 0.5, y: vertical ? 1 : 0 },
    ...(vertical ? {} : { to: { x: 1, y: 0.5 } }),
    stops: FOUNDRY_METAL_STOPS[material].map((s) => ({ color: rgb(s.color), offset: s.offset })),
    spread: 'pad',
    fixed: false,
  },
});

export const PATINA_HEX = '#4f8a78';

/**
 * Irregular verdigris blotches that grow over a metal face — NOT a flat disc,
 * so the metal gradient stays readable under the patina.
 * Children are authored in coin-local coords (coin centre = local 0,0); wrap
 * inside the coin group so they shrink/move with it.
 * @param R coin radius in local units
 * @param patina dataset patina value (0..1) — max blotch alpha = 0.75*patina
 */
export function patinaBlotches(title: string, R: number, patina: number, t0: number, t1: number) {
  /* [fracR, dx, dy, alphaFrac, delayFrac] — hand-placed irregular layout */
  const spec: Array<[number, number, number, number, number]> = [
    [0.34, -0.30, -0.12, 0.60, 0.00],
    [0.26, 0.30, -0.32, 0.50, 0.14],
    [0.21, 0.44, 0.22, 0.68, 0.28],
    [0.17, -0.46, 0.36, 0.55, 0.42],
    [0.14, 0.06, 0.54, 0.45, 0.56],
    [0.11, -0.08, -0.50, 0.72, 0.70],
  ];
  const cap = Math.min(0.75, 0.75 * patina);
  const kids = spec.map(([fr, dx, dy, af, df], i) => {
    const s0 = t0 + (t1 - t0) * df;
    const s1 = s0 + (t1 - t0) * 0.40;
    const a = Math.min(cap, cap * af * 1.35);
    return circleEl(`${title}-pat${i}`, fr * R, {
      transform: { translate: { x: dx * R, y: dy * R } },
      fill: { paint: colorPaint(PATINA_HEX, 0) },
    }, {
      animators: {
        fill: { paint: chan([kf(s0, colorPaint(PATINA_HEX, 0), EZ.out()), kf(s1, colorPaint(PATINA_HEX, a))]) },
      },
    });
  });
  return grp(title, kids);
}

/* ---------- d-string → SVGator path nodes ---------- */
/**
 * Minimal parser for the mark's simple path data: M, L, V, C, Z.
 * Absolute commands only (guardian-mark uses those). Returns node list.
 */
export function dToNodes(d: string) {
  const nodes: any[] = [];
  const toks = d.match(/[MLCVZmlcvz]|-?\d*\.?\d+(?:e-?\d+)?/g)!;
  let i = 0, cx = 0, cy = 0, startX = 0, startY = 0, prevC: { x: number; y: number } | null = null;
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i++];
    if (t === 'M') { cx = num(); cy = num(); startX = cx; startY = cy; nodes.push({ x: cx, y: cy, type: 'corner', mode: 0 }); prevC = null; }
    else if (t === 'L') { cx = num(); cy = num(); nodes.push({ x: cx, y: cy, type: 'corner', mode: 0 }); prevC = null; }
    else if (t === 'V') { cy = num(); nodes.push({ x: cx, y: cy, type: 'corner', mode: 0 }); prevC = null; }
    else if (t === 'C') {
      const c1x = num(), c1y = num(), c2x = num(), c2y = num(), x = num(), y = num();
      // attach end-ctrl to current last node, start-ctrl to new node
      nodes[nodes.length - 1].end = { x: c1x, y: c1y };
      nodes[nodes.length - 1].type = 'cusp';
      nodes.push({ x, y, type: 'cusp', mode: 0, start: { x: c2x, y: c2y } });
      cx = x; cy = y; prevC = { x: c2x, y: c2y };
    } else if (t === 'Z' || t === 'z') {
      cx = startX; cy = startY;
    }
  }
  // close: make last node coincide with first if needed
  const f = nodes[0], l = nodes[nodes.length - 1];
  if (l.x !== f.x || l.y !== f.y) {
    nodes.push({ x: f.x, y: f.y, type: l.type || 'corner', mode: 0, ...(l.start ? { start: l.start } : {}) });
    delete l.start;
  }
  return nodes;
}

/* ---------- element helpers ---------- */
export function el(type: string, title: string, props: any = {}, extra: any = {}) {
  return {
    id: nid(type),
    type,
    title,
    properties: {
      transform: { origin: { x: 0, y: 0, type: 'corner' }, ...(props.transform || {}) },
      ...Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'transform')),
    },
    ...(extra.animators ? { animators: extra.animators } : {}),
    ...(extra.children ? { children: extra.children } : {}),
  };
}
export const grp = (title: string, children: any[], props: any = {}, extra: any = {}) =>
  el('g', title, props, { ...extra, children });
export const pathEl = (title: string, nodes: any[], props: any = {}, extra: any = {}) => {
  const e = el('path', title, props, extra);
  (e.properties as any).shape = { path: nodes };
  return e;
};
export const circleEl = (title: string, radius: number, props: any = {}, extra: any = {}) => {
  const e = el('circle', title, props, extra);
  (e.properties as any).shape = { radius };
  return e;
};
export const rectEl = (title: string, w: number, h: number, props: any = {}, extra: any = {}) => {
  const e = el('rect', title, props, extra);
  (e.properties as any).shape = { size: { width: w, height: h }, radius: props.radiusXY ?? { x: 0, y: 0 } };
  return e;
};
export const textEl = (title: string, text: string, shape: any, props: any = {}, extra: any = {}) => {
  const e = el('text', title, props, extra);
  (e.properties as any).shape = {
    text,
    fontFamily: shape.fontFamily ?? 'Inter',
    fontSize: shape.fontSize ?? 24,
    fontStyle: shape.fontStyle ?? { weight: 400 },
    textAnchor: shape.textAnchor ?? 'start',
    letterSpacing: shape.letterSpacing ?? 0,
    wrap: false,
    ...(shape.rangeStyles ? { rangeStyles: shape.rangeStyles } : {}),
  };
  return e;
};

/** keyframe list helpers */
export const kf = (time: number, value: any, easing: any = EZ.out()) => ({ time, value, easing });
export const chan = (keys: any[]) => ({ disabled: false, keys });

/* ---------- Guardian mark builder ---------- */
/**
 * Builds a Guardian group, mark-local coords (0..100 viewBox),
 * positioned by the caller via a wrapper group or origin offsets.
 * Structure: group > [shield, shield-shade, visor, coin, coin-ring, eyes[eye-l,eye-r]]
 */
/** shift all node coords (and bezier control points) by (dx,dy) */
export const shiftNodes = (nodes: any[], dx: number, dy: number) =>
  nodes.map((n) => ({
    ...n, x: n.x + dx, y: n.y + dy,
    ...(n.start ? { start: { x: n.start.x + dx, y: n.start.y + dy } } : {}),
    ...(n.end ? { end: { x: n.end.x + dx, y: n.end.y + dy } } : {}),
  }));

export function guardianMark(title = 'guardian'): any {
  const P = GUARDIAN_PALETTE;
  /* mark authored CENTRED at local (0,0): source coords are 0..100, subtract (50,50).
     The group's origin stays (0,0) → scale/rotate pivot = mark centre, and a wrapper's
     translate = the mark's canvas-centre position. */
  const shield = pathEl('shield', shiftNodes(dToNodes(SHIELD_D), -50, -50), {
    fill: {
      paint: {
        type: 'linear-gradient',
        value: {
          from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 },
          stops: [{ color: rgb(P.iceTop), offset: 0 }, { color: rgb(P.iceBottom), offset: 1 }],
          spread: 'pad', fixed: false,
        },
      },
      opacity: 1,
    },
    stroke: { paint: colorPaint(P.edge), opacity: 1, width: 2, lineJoin: 'round' },
  });
  const shade = pathEl('shield-shade', shiftNodes(dToNodes(SHIELD_D), -50, -50), {
    fill: {
      paint: {
        type: 'linear-gradient',
        value: {
          from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 },
          stops: [{ color: rgb(P.edge, 0), offset: 0 }, { color: rgb(P.edge, 0.14), offset: 1 }],
          spread: 'pad', fixed: false,
        },
      },
    },
  });
  const visor = pathEl('visor', shiftNodes(dToNodes(VISOR_D), -50, -50), {
    fill: { paint: colorPaint(P.visor), opacity: 0.85 },
  });
  const coin = circleEl('coin', COIN.r, {
    transform: { translate: { x: COIN.cx - 50, y: COIN.cy - 50 } },
    fill: {
      paint: {
        type: 'linear-gradient',
        value: {
          from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 },
          stops: [{ color: rgb('#fcd34d'), offset: 0 }, { color: rgb(P.gold), offset: 1 }],
          spread: 'pad', fixed: false,
        },
      },
    },
  });
  const ring = circleEl('coin-ring', COIN.ringR, {
    transform: { translate: { x: COIN.cx - 50, y: COIN.cy - 50 } },
    fill: { paint: noPaint },
    stroke: { paint: colorPaint(P.ring), opacity: 0.9, width: COIN.ringW },
  });
  /* eye rects authored around pivot (50,44): local coords = mark - (50,44) */
  const eyes = grp('eyes', EYES.map((e, i) => rectEl(
    i === 0 ? 'eye-l' : 'eye-r', e.size, e.size,
    {
      transform: { translate: { x: e.x - 50, y: e.y - 44 } },
      radiusXY: { x: e.rx, y: e.rx },
      fill: { paint: colorPaint(P.eye) },
    },
  )), {
    /* eyes' pivot = eye-row centre (50,44) → (0,-6) in centred mark coords */
    transform: { origin: { x: 0, y: -6, type: 'corner' } },
  });
  return grp(title, [shield, shade, visor, coin, ring, eyes]);
}

/**
 * Eyes-group animator builder. The eyes group inside guardianMark is centered
 * at (50,44) in mark units; its transform.origin is the pivot for scale AND
 * the motion-path channel used for gaze shifts.
 * keys spec: [[time, mood]] where mood = {sY?, sX?, dx?, dy?}.
 * Produces parallel key lists for scale + origin. First key's value should
 * equal the static baseline (origin 50,44 scale 1,1) unless intentionally
 * starting mid-pose. (origin value = position of eyes-local (0,0) in mark
 * coords; eye children are centred at their local 0,0 so dx/dy is pure gaze
 * and scale pivots at the eye-row centre.)
 */
export function eyesKeys(moods: Array<[number, { sY?: number; sX?: number; dx?: number; dy?: number }, any?]>) {
  const scaleKeys = moods.map(([t, m, e]) => kf(t, { x: m.sX ?? 1, y: m.sY ?? 1 }, e ?? EZ.settle()));
  const originKeys = moods.map(([t, m, e]) => kf(t, { x: (m.dx ?? 0), y: -6 + (m.dy ?? 0), type: 'corner' }, e ?? EZ.settle()));
  return { scale: chan(scaleKeys), origin: chan(originKeys) };
}

export const GUARDIAN_MOODS = {
  neutral: { sY: 1, dx: 0, dy: 0 },
  thinking: { sY: 0.8, dx: 1, dy: -0.5 },
  protective: { sY: 0.35, dx: 0, dy: 2 },
  alert: { sY: 1.25, sX: 1.25, dx: 0, dy: -1.5 },
};

export const doc = (width: number, height: number, duration: number, children: any[], bg = '#0f172a') => ({
  id: nid('svg'),
  type: 'svg',
  title: 'root',
  animation: { duration, direction: 1, iterations: 1, fill: 1, alternate: false, speed: 1 },
  properties: {
    shape: {
      position: { x: 0, y: 0 },
      size: { width, height },
      bgColor: bg ? colorPaint(bg) : noPaint,
    },
  },
  children,
});

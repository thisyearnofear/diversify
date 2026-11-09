/**
 * Piece C — Foundry materials reel. 1920×1080, 7s, once, hold.
 * Four coins in a row, each entering with its own physics (stagger 350ms),
 * labels beneath, tagline at the end.
 * Emits .perch/svgator-lab/v3/docs/c-foundry.json
 */
import { writeFileSync } from 'node:fs';
import {
  doc, el, grp, pathEl, circleEl, rectEl, textEl, kf, chan, rgb, colorPaint,
  noPaint, metalPaint, patinaBlotches, EZ, resetIds,
} from './lib';
import { getCurrencyRisk } from '../../apps/web/constants/currency-risk';
import { patinaFor } from '../../apps/web/lib/foundry';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';

const W = 1920, H = 1080, DUR = 7000;
resetIds();

const ICE = '#dbeafe', DIM = '#64748b', TXT = '#e2e8f0';
const ngnDep = getCurrencyRisk('NGN')!.depreciation.vsUSD['5yr']; // -60
const ngnPatina = patinaFor('NGN'); // min(1,-dep/60)=1 -> cap visuals at 0.8
const PATINA = '#4f8a78';

const R = 140;
const ROW_Y = 500;
const XS = [420, 780, 1140, 1500];
const STAG = 350;

const label = (t: string, x: number, y: number, t0: number, size = 26, wgt = 600, col = TXT) =>
  textEl(`lbl-${t.slice(0, 10)}`, t, { fontFamily: 'Inter', fontSize: size, fontStyle: { weight: wgt }, textAnchor: 'middle' }, {
    transform: { translate: { x, y } },
    fill: { paint: colorPaint(col) },
  }, {
    animators: {
      compositing: { opacity: chan([kf(t0, 0, EZ.out()), kf(t0 + 400, 1)]) },
      transform: { origin: chan([kf(t0, { x: 0, y: 6, type: 'corner' }, EZ.out()), kf(t0 + 400, { x: 0, y: 0, type: 'corner' })]) },
    },
  });

/** base coin: group origin = canvas centre; children local */
const coinBase = (name: string, x: number, children: any[], props: any = {}, extra: any = {}) =>
  grp(name, children, { transform: { origin: { x, y: ROW_Y, type: 'corner' } }, ...props }, extra);

/* ---------- 1. machined "reserve · USDm" — spins in (scaleX flip x2) ---------- */
const t0a = 400;
const machined = coinBase('coin-machined', XS[0], [
  circleEl('m-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('machined') } }),
  /* milled edge ticks */
  circleEl('m-inner', R - 22, { fill: { paint: noPaint }, stroke: { paint: colorPaint('#e4e9ee', 0.5), opacity: 1, width: 3, dashArray: [8, 6] } }),
  textEl('m-code', 'USDm', { fontFamily: 'Inter', fontSize: 40, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 13 } }, fill: { paint: colorPaint('#334155') },
  }),
  /* edge glint at the two edge-on moments of the spin */
  grp('m-edge-clip', [
    el('clipPath', 'mcoin-clip', {}, { children: [circleEl('mcoin-clip-shape', R, {})] }),
    rectEl('m-edge', 10, 250, {
      transform: { rotate: 0 }, radiusXY: { x: 5, y: 5 },
      fill: { paint: colorPaint('#f8fafc', 0) },
    }, {
      animators: { fill: { paint: chan([
        kf(t0a, colorPaint('#f8fafc', 0.9), EZ.linear),
        kf(t0a + 120, colorPaint('#f8fafc', 0.9), EZ.linear),
        kf(t0a + 240, colorPaint('#f8fafc', 0), EZ.linear),
        kf(t0a + 640, colorPaint('#f8fafc', 0.9), EZ.linear),
        kf(t0a + 760, colorPaint('#f8fafc', 0.9), EZ.linear),
        kf(t0a + 880, colorPaint('#f8fafc', 0), EZ.linear),
      ]) } },
    }),
  ], { compositing: { clip: { path: 'mcoin-clip' } } }),
], {}, {
  animators: {
    compositing: { opacity: chan([kf(t0a, 0, EZ.linear), kf(t0a + 60, 1)]) },
    transform: {
      scale: chan([
        kf(t0a, { x: 0.01, y: 1 }, EZ.inout()),
        kf(t0a + 320, { x: 1, y: 1 }, EZ.inout()),
        kf(t0a + 640, { x: 0.12, y: 1 }, EZ.inout()),
        kf(t0a + 960, { x: 1, y: 1 }, EZ.settle()),
      ]),
    },
  },
});

/* ---------- 2. noble "hard asset · PAXG" — heavy drop + light sweep ---------- */
const t0b = t0a + STAG;
const noble = coinBase('coin-noble', XS[1], [
  circleEl('n-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('noble') } }),
  circleEl('n-inner', R - 20, { fill: { paint: noPaint }, stroke: { paint: colorPaint('#fef3c7', 0.5), width: 3 } }),
  textEl('n-code', 'PAXG', { fontFamily: 'Inter', fontSize: 34, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 11 } }, fill: { paint: colorPaint('#451a03') },
  }),
  /* light sweep clipped to the coin face */
  grp('n-sweep-clip', [
    el('clipPath', 'ncoin-clip', {}, { children: [circleEl('ncoin-clip-shape', R, {})] }),
    rectEl('n-sweep', 46, 260, {
      transform: { rotate: -18 },
      radiusXY: { x: 23, y: 23 },
      fill: { paint: colorPaint('#fefce8', 0) },
    }, {
      animators: {
        transform: { origin: chan([kf(t0b + 1100, { x: -170, y: 0, type: 'corner' }, EZ.linear), kf(t0b + 2000, { x: 170, y: 0, type: 'corner' }, EZ.linear)]) },
        fill: { paint: chan([kf(t0b + 1100, colorPaint('#fefce8', 0), EZ.linear), kf(t0b + 1400, colorPaint('#fefce8', 0.5), EZ.linear), kf(t0b + 1700, colorPaint('#fefce8', 0.5), EZ.linear), kf(t0b + 2000, colorPaint('#fefce8', 0), EZ.linear)]) },
      },
    }),
  ], { compositing: { clip: { path: 'ncoin-clip' } } }),
], {}, {
  animators: {
    compositing: { opacity: chan([kf(t0b, 0, EZ.linear), kf(t0b + 60, 1)]) },
    transform: {
      /* heavy drop from above: origin moves down, ease-in then tiny 1.02 settle */
      origin: chan([
        kf(t0b, { x: XS[1], y: -R - 120, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.5, y: 0 }, to: { x: 0.7, y: 1 } } }),
        kf(t0b + 620, { x: XS[1], y: ROW_Y, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.3, y: 0 }, to: { x: 0.5, y: 1.15 } } }),
        kf(t0b + 780, { x: XS[1], y: ROW_Y, type: 'corner' }, EZ.settle()),
      ]),
      scale: chan([
        kf(t0b + 620, { x: 1, y: 1 }, EZ.linear),
        kf(t0b + 720, { x: 1.02, y: 0.98 }, EZ.out()), /* squash on landing */
        kf(t0b + 900, { x: 1, y: 1 }, EZ.settle()),
      ]),
    },
  },
});

/* ---------- 3. living "weathers · NGN −60% (5y)" — lands, patina grows ---------- */
const t0c = t0b + STAG;
const living = coinBase('coin-living', XS[2], [
  circleEl('l-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('living') } }),
  patinaBlotches('l-weather', R, ngnPatina, t0c + 800, t0c + 800 + 1500),
  textEl('l-code', 'NGN', { fontFamily: 'Inter', fontSize: 34, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 11 } }, fill: { paint: colorPaint('#fff7ed') },
  }),
], {}, {
  animators: {
    compositing: { opacity: chan([kf(t0c, 0, EZ.linear), kf(t0c + 60, 1)]) },
    transform: {
      origin: chan([
        kf(t0c, { x: XS[2], y: ROW_Y - 140, type: 'corner' }, EZ.out()),
        kf(t0c + 450, { x: XS[2], y: ROW_Y, type: 'corner' }, EZ.settle()),
      ]),
      scale: chan([kf(t0c, { x: 0.6, y: 0.6 }, EZ.spring(1.25)), kf(t0c + 500, { x: 1, y: 1 })]),
    },
  },
});

/* ---------- 4. ghost "where metal should be" — dashed outline fades in ---------- */
const t0d = t0c + STAG;
const ghost = coinBase('coin-ghost', XS[3], [
  circleEl('g-ghost', R, {
    transform: { translate: { x: 0, y: 0 } },
    fill: { paint: noPaint },
    stroke: { paint: colorPaint('#8b99a5'), opacity: 0, width: 4, dashArray: [16, 12] },
  }, {
    animators: { stroke: { opacity: chan([kf(t0d, 0, EZ.out()), kf(t0d + 900, 0.6)]) } },
  }),
  textEl('g-mark', '?', { fontFamily: 'Inter', fontSize: 40, fontStyle: { weight: 600 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 13 } },
    fill: { paint: colorPaint(DIM, 0) },
  }, {
    animators: { fill: { paint: chan([kf(t0d + 400, colorPaint(DIM, 0), EZ.out()), kf(t0d + 900, colorPaint(DIM, 0.5))]) } },
  }),
]);

/* ---------- labels + tagline ---------- */
const labels = [
  label('reserve · USDm', XS[0], ROW_Y + R + 48, t0a + 800, 20, 600),
  label('hard asset · PAXG', XS[1], ROW_Y + R + 48, t0b + 800, 20, 600),
  label(`weathers · NGN ${ngnDep}% (5y)`, XS[2], ROW_Y + R + 48, t0c + 800, 20, 600),
  label('where metal should be', XS[3], ROW_Y + R + 48, t0d + 700, 20, 600, DIM),
];
const title = textEl('reel-title', 'The Foundry', { fontFamily: 'Inter', fontSize: 44, fontStyle: { weight: 700 }, textAnchor: 'start' }, {
  transform: { translate: { x: 120, y: 140 } }, fill: { paint: colorPaint(ICE) },
}, { animators: { compositing: { opacity: chan([kf(0, 0, EZ.out()), kf(500, 1)]) } } });
const tagline = textEl('tagline', "Tokens don't pick colors. They are a metal.", {
  fontFamily: 'Inter', fontSize: 34, fontStyle: { weight: 600 }, textAnchor: 'middle',
}, {
  transform: { translate: { x: W / 2, y: 880 } },
  fill: { paint: colorPaint(ICE) },
}, { animators: { compositing: { opacity: chan([kf(5600, 0, EZ.out()), kf(6300, 1)]) } } });

const document = doc(W, H, DUR, [title, machined, noble, living, ghost, ...labels, tagline]);
writeFileSync('/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs/c-foundry.json', JSON.stringify(document, null, 1));
console.log('written c-foundry.json', { ngnDep, ngnPatina });

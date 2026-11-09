/**
 * Piece C square re-compose — Foundry reel 1080×1080, 7s.
 * Same physics/stagger, 2×2 coin grid.
 */
import { writeFileSync } from 'node:fs';
import {
  doc, el, grp, pathEl, circleEl, rectEl, textEl, kf, chan, rgb, colorPaint,
  noPaint, metalPaint, patinaBlotches, EZ, resetIds,
} from './lib';
import { getCurrencyRisk } from '../../apps/web/constants/currency-risk';
import { patinaFor } from '../../apps/web/lib/foundry';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';

const W = 1080, H = 1080, DUR = 7000;
resetIds();
const ICE = '#dbeafe', DIM = '#64748b', TXT = '#e2e8f0';
const ngnDep = getCurrencyRisk('NGN')!.depreciation.vsUSD['5yr'];
const ngnPatina = patinaFor('NGN');
const PATINA = '#4f8a78';
const R = 120, STAG = 350;
const POS = [[330, 380], [750, 380], [330, 720], [750, 720]]; // machined, noble, living, ghost

const label = (t: string, x: number, y: number, t0: number, col = TXT) =>
  textEl(`lbl`, t, { fontFamily: 'Inter', fontSize: 28, fontStyle: { weight: 600 }, textAnchor: 'middle' }, {
    transform: { translate: { x, y } }, fill: { paint: colorPaint(col) },
  }, { animators: { compositing: { opacity: chan([kf(t0, 0, EZ.out()), kf(t0 + 400, 1)]) } } });

const t0a = 400, t0b = t0a + STAG, t0c = t0b + STAG, t0d = t0c + STAG;
const [MX, MY] = POS[0], [NX, NY] = POS[1], [LX, LY] = POS[2], [GX, GY] = POS[3];

const machined = grp('coin-machined', [
  circleEl('m-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('machined') } }),
  circleEl('m-inner', R - 20, { fill: { paint: noPaint }, stroke: { paint: colorPaint('#e4e9ee', 0.5), width: 3, dashArray: [8, 6] } }),
  textEl('m-code', 'USDm', { fontFamily: 'Inter', fontSize: 36, fontStyle: { weight: 800 }, textAnchor: 'middle' }, { transform: { translate: { x: 0, y: 12 } }, fill: { paint: colorPaint('#334155') } }),
  grp('m-edge-clip', [
    el('clipPath', 'mcoin-clip', {}, { children: [circleEl('mcoin-clip-shape', R, {})] }),
    rectEl('m-edge', 9, 210, {
      radiusXY: { x: 4, y: 4 }, fill: { paint: colorPaint('#f8fafc', 0) },
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
], { transform: { origin: { x: MX, y: MY, type: 'corner' } } }, {
  animators: {
    compositing: { opacity: chan([kf(t0a, 0, EZ.linear), kf(t0a + 60, 1)]) },
    transform: { scale: chan([
      kf(t0a, { x: 0.01, y: 1 }, EZ.inout()), kf(t0a + 320, { x: 1, y: 1 }, EZ.inout()),
      kf(t0a + 640, { x: 0.12, y: 1 }, EZ.inout()), kf(t0a + 960, { x: 1, y: 1 }, EZ.settle()),
    ]) },
  },
});
const noble = grp('coin-noble', [
  circleEl('n-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('noble') } }),
  circleEl('n-inner', R - 18, { fill: { paint: noPaint }, stroke: { paint: colorPaint('#fef3c7', 0.5), width: 3 } }),
  textEl('n-code', 'PAXG', { fontFamily: 'Inter', fontSize: 34, fontStyle: { weight: 800 }, textAnchor: 'middle' }, { transform: { translate: { x: 0, y: 10 } }, fill: { paint: colorPaint('#451a03') } }),
  grp('n-sweep-clip', [
    el('clipPath', 'ncoin-clip', {}, { children: [circleEl('ncoin-clip-shape', R, {})] }),
    rectEl('n-sweep', 40, 240, {
      transform: { rotate: -18 }, radiusXY: { x: 20, y: 20 }, fill: { paint: colorPaint('#fefce8', 0) },
    }, {
      animators: {
        transform: { origin: chan([kf(t0b + 1100, { x: -150, y: 0, type: 'corner' }, EZ.linear), kf(t0b + 2000, { x: 150, y: 0, type: 'corner' }, EZ.linear)]) },
        fill: { paint: chan([kf(t0b + 1100, colorPaint('#fefce8', 0), EZ.linear), kf(t0b + 1400, colorPaint('#fefce8', 0.5), EZ.linear), kf(t0b + 1700, colorPaint('#fefce8', 0.5), EZ.linear), kf(t0b + 2000, colorPaint('#fefce8', 0), EZ.linear)]) },
      },
    }),
  ], { compositing: { clip: { path: 'ncoin-clip' } } }),
], { transform: { origin: { x: NX, y: NY, type: 'corner' } } }, {
  animators: {
    compositing: { opacity: chan([kf(t0b, 0, EZ.linear), kf(t0b + 60, 1)]) },
    transform: {
      origin: chan([
        kf(t0b, { x: NX, y: -R - 100, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.5, y: 0 }, to: { x: 0.7, y: 1 } } }),
        kf(t0b + 620, { x: NX, y: NY, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.3, y: 0 }, to: { x: 0.5, y: 1.15 } } }),
        kf(t0b + 780, { x: NX, y: NY, type: 'corner' }, EZ.settle()),
      ]),
      scale: chan([
        kf(t0b + 620, { x: 1, y: 1 }, EZ.linear), kf(t0b + 720, { x: 1.02, y: 0.98 }, EZ.out()), kf(t0b + 900, { x: 1, y: 1 }, EZ.settle()),
      ]),
    },
  },
});
const living = grp('coin-living', [
  circleEl('l-disc', R, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('living') } }),
  patinaBlotches('l-weather', R, ngnPatina, t0c + 800, t0c + 800 + 1500),
  textEl('l-code', 'NGN', { fontFamily: 'Inter', fontSize: 34, fontStyle: { weight: 800 }, textAnchor: 'middle' }, { transform: { translate: { x: 0, y: 10 } }, fill: { paint: colorPaint('#fff7ed') } }),
], { transform: { origin: { x: LX, y: LY, type: 'corner' } } }, {
  animators: {
    compositing: { opacity: chan([kf(t0c, 0, EZ.linear), kf(t0c + 60, 1)]) },
    transform: {
      origin: chan([kf(t0c, { x: LX, y: LY - 130, type: 'corner' }, EZ.out()), kf(t0c + 450, { x: LX, y: LY, type: 'corner' }, EZ.settle())]),
      scale: chan([kf(t0c, { x: 0.6, y: 0.6 }, EZ.spring(1.25)), kf(t0c + 500, { x: 1, y: 1 })]),
    },
  },
});
const ghost = grp('coin-ghost', [
  circleEl('g-ghost', R, {
    transform: { translate: { x: 0, y: 0 } }, fill: { paint: noPaint },
    stroke: { paint: colorPaint('#8b99a5'), opacity: 0, width: 4, dashArray: [16, 12] },
  }, { animators: { stroke: { opacity: chan([kf(t0d, 0, EZ.out()), kf(t0d + 900, 0.6)]) } } }),
  textEl('g-mark', '?', { fontFamily: 'Inter', fontSize: 36, fontStyle: { weight: 600 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 12 } }, fill: { paint: colorPaint(DIM, 0) },
  }, { animators: { fill: { paint: chan([kf(t0d + 400, colorPaint(DIM, 0), EZ.out()), kf(t0d + 900, colorPaint(DIM, 0.5))]) } } }),
], { transform: { origin: { x: GX, y: GY, type: 'corner' } } });

const labels = [
  label('reserve · USDm', MX, MY + R + 40, t0a + 800),
  label('hard asset · PAXG', NX, NY + R + 40, t0b + 800),
  label(`weathers · NGN ${ngnDep}% (5y)`, LX, LY + R + 40, t0c + 800),
  label('where metal should be', GX, GY + R + 40, t0d + 700, DIM),
];
const title = textEl('reel-title', 'The Foundry', { fontFamily: 'Inter', fontSize: 36, fontStyle: { weight: 700 }, textAnchor: 'start' }, {
  transform: { translate: { x: 80, y: 100 } }, fill: { paint: colorPaint(ICE) },
}, { animators: { compositing: { opacity: chan([kf(0, 0, EZ.out()), kf(500, 1)]) } } });
const tagline = textEl('tagline', "Tokens don't pick colors. They are a metal.", {
  fontFamily: 'Inter', fontSize: 26, fontStyle: { weight: 600 }, textAnchor: 'middle',
}, { transform: { translate: { x: W / 2, y: 980 } }, fill: { paint: colorPaint(ICE) } },
  { animators: { compositing: { opacity: chan([kf(5600, 0, EZ.out()), kf(6300, 1)]) } } });

const document = doc(W, H, DUR, [title, machined, noble, living, ghost, ...labels, tagline]);
writeFileSync('/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs/c-foundry-1x1.json', JSON.stringify(document, null, 1));
console.log('written c-foundry-1x1.json');

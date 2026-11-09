/**
 * Piece A — "The Guardian's loop" hero film, REMAKE.
 * 1920×1080, 12.5s, once, hold. MODES TRANSFORM, never append:
 *   - gauge arc completes to become the allocation ring's base circle
 *   - the −60% number travels to become the NGN leg's label
 *   - needle/ticks/coin clear fast (~180ms) as ring legs land (~280ms)
 *   - beat 5: ring+fence dim to 0.25 and shift left; seal takes centre
 *   - beat 6: whole scene clears (fade + 12px drift), end card = poster
 * Scale: Guardian ~400px; object ~520px; number 96→36; captions ≥30; min text 24.
 */
import { writeFileSync } from 'node:fs';
import {
  doc, grp, pathEl, circleEl, rectEl, textEl, kf, chan, rgb, colorPaint,
  noPaint, metalPaint, guardianMark, eyesKeys, EZ, resetIds,
} from './lib';
import { getCurrencyRisk } from '../../apps/web/constants/currency-risk';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';

const W = 1920, H = 1080, DUR = 12500;
const dep = getCurrencyRisk('NGN')!.depreciation.vsUSD['5yr']; // -60
resetIds();
const ICE = '#dbeafe', DIM = '#64748b', TXT = '#e2e8f0', ACC = P.edge;
const EZO = EZ.out(), EZS = EZ.settle();

/* leaving beat helper: fade + small drift up, ~180ms */
const clearKeys = (t: number, d = 180) => ({
  compositing: { opacity: chan([kf(t, 1, EZO), kf(t + d, 0)]) },
  transform: { origin: chan([kf(t, { x: 0, y: 0, type: 'corner' }, EZO), kf(t + d, { x: 0, y: -12, type: 'corner' })]) },
});
const arcNodes = (cx: number, cy: number, r: number, a0: number, a1: number, n = 24) => {
  const pts: any[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * (i / n)) * Math.PI / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), type: i === 0 ? 'corner' : 'cusp', mode: 0 });
  }
  return pts;
};

/* ============ STAGE CENTRE — gauge→ring at (660,540), R=220 ============ */
const OX = 660, OY = 540, RING_R = 260;
const sceneKids: any[] = [];

/* ---- beat 1: NGN coin (left of gauge), ticks streaming into the gauge ---- */
const coinGrp = grp('ngn-coin', [
  circleEl('ngn-disc', 96, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('living') } }),
  textEl('ngn-label', 'NGN', { fontFamily: 'Inter', fontSize: 38, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 13 } }, fill: { paint: colorPaint('#fff7ed') }, compositing: { opacity: 0.85 },
  }),
], { transform: { origin: { x: 260, y: OY, type: 'corner' } } }, {
  animators: {
    transform: { scale: chan([kf(0, { x: 0, y: 0 }, EZ.spring(1.2)), kf(500, { x: 1, y: 1 }, EZ.linear), kf(1900, { x: 1, y: 1 }, EZO), kf(2150, { x: 0, y: 0 })]) },
  },
});
sceneKids.push(coinGrp);
const ticks = [0, 1, 2, 3, 4].map((i) => {
  const t0 = 350 + i * 120, t1 = t0 + 420, y = OY - 140 + i * 65;
  return rectEl(`tick-${i + 1}`, 52, 12, {
    radiusXY: { x: 6, y: 6 }, fill: { paint: colorPaint(ACC) }, compositing: { opacity: 0 },
  }, {
    animators: {
      transform: { origin: chan([kf(t0, { x: -70, y, type: 'corner' }, EZO), kf(t1, { x: OX - RING_R - 36, y, type: 'corner' })]) },
      compositing: { opacity: chan([kf(t0, 0, EZO), kf(t0 + 120, 1), kf(1850, 0.8, EZO), kf(2050, 0)]) },
    },
  });
});
sceneKids.push(...ticks);

/* ---- gauge: dim upper-semicircle arc (draws on via dashOffset) + a dashed
   full circle that fades in at beat 3 — reads as the arc completing into the
   ring's base circle. Wrapped so the beat-5 shift uses group origin keys. ---- */
const halfArc = Math.PI * RING_R;
const semiArc = pathEl('gauge-arc', arcNodes(OX, OY, RING_R, 180, 360, 20), {
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(DIM), opacity: 0.55, width: 12, lineCap: 'round', dashArray: [halfArc, halfArc], dashOffset: halfArc },
}, {
  animators: {
    stroke: {
      dashOffset: chan([kf(250, halfArc, EZ.out(0.3, 0.3)), kf(950, 0)]),
      opacity: chan([kf(250, 0, EZ.linear), kf(320, 0.55), kf(4300, 0.55, EZO), kf(4900, 0)]),
    },
  },
});
const ringBase = circleEl('ring-base', RING_R, {
  transform: { translate: { x: OX, y: OY } },
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(DIM), opacity: 0, width: 10, dashArray: [5, 9] },
}, {
  animators: {
    stroke: { opacity: chan([kf(4300, 0, EZO), kf(4900, 0.55)]) },
    transform: { rotate: chan([kf(4300, -40, EZO), kf(4900, 0)]) },
  },
});
const gaugeArcWrap = grp('gauge-wrap', [semiArc, ringBase]);
sceneKids.push(gaugeArcWrap);
const gaugeFill = pathEl('gauge-fill', arcNodes(OX, OY, RING_R, 180, 360, 20), {
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(ACC), opacity: 0.9, width: 16, lineCap: 'round', dashArray: [7, 9] },
}, {
  animators: {
    compositing: { opacity: chan([kf(2050, 0, EZO), kf(2500, 0.9), kf(4200, 0.9, EZO), kf(4400, 0)]) },
  },
});
sceneKids.push(gaugeFill);
/* needle — local blade, origin at centre; sweeps, then clears as ring forms */
const needle = grp('needle', [
  pathEl('needle-blade', [
    { x: -5, y: 0, type: 'corner', mode: 0 },
    { x: 0, y: -(RING_R - 34), type: 'corner', mode: 0 },
    { x: 5, y: 0, type: 'corner', mode: 0 },
  ], { fill: { paint: colorPaint(P.gold) } }),
  circleEl('needle-hub', 12, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: colorPaint(P.gold) } }),
], { transform: { origin: { x: OX, y: OY, type: 'corner' } } }, {
  animators: {
    transform: {
      rotate: chan([
        kf(2000, -88, EZ.out(0.2, 0.2)),
        kf(2900, 22, { type: 'cubic-bezier', value: { from: { x: 0.16, y: 1 }, to: { x: 0.25, y: 1.35 } } }),
        kf(3300, 18, EZS),
      ]),
      scale: chan([kf(4000, { x: 1, y: 1 }, EZO), kf(4200, { x: 0, y: 0 })]),
    },
    compositing: { opacity: chan([kf(4000, 1, EZO), kf(4200, 0)]) },
  },
});
sceneKids.push(needle);

/* ---- −60% number: lands under the gauge (96px), then travels to become the
   NGN leg's label (36px) inside the ring ---- */
const numSpot = { x: OX, y: 845 };
const legLabelSpot = { x: OX - 475, y: OY }; /* outside fence left edge (fx0=OX-320), ≥24px clear, centred on NGN arc midpoint */
const riskNum = textEl('risk-num', `${dep}%`, { fontFamily: 'Inter', fontSize: 96, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
  transform: { translate: numSpot },
  fill: { paint: colorPaint(TXT) },
}, {
  animators: {
    compositing: { opacity: chan([kf(3350, 0, EZO), kf(3700, 1), kf(5000, 1, EZO), kf(5180, 0)]) },
    transform: {
      origin: chan([
        kf(3350, { x: 0, y: 10, type: 'corner' }, EZO), kf(3700, { x: 0, y: 0, type: 'corner' }, EZS),
        kf(5000, { x: 0, y: 0, type: 'corner' }, EZO), kf(5180, { x: -16, y: 0, type: 'corner' }),
      ]),
    },
  },
});
sceneKids.push(riskNum);
/* static-size label at the NGN leg (fontSize animators are not honoured) */
sceneKids.push(textEl('ngn-risk-label', `${dep}%`, {
  fontFamily: 'Inter', fontSize: 40, fontStyle: { weight: 800 }, textAnchor: 'middle',
}, {
  transform: { translate: { x: legLabelSpot.x, y: legLabelSpot.y } }, fill: { paint: colorPaint(TXT) },
}, {
  animators: { compositing: { opacity: chan([kf(5100, 0, EZO), kf(5380, 1)]) } },
}));
const riskCap = textEl('risk-cap', 'NGN vs USD · 5 years', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 500 }, textAnchor: 'middle' }, {
  transform: { translate: { x: OX, y: 895 } }, fill: { paint: colorPaint(DIM) },
}, {
  animators: {
    compositing: { opacity: chan([kf(3550, 0, EZO), kf(3900, 1), kf(3950, 1, EZO), kf(4150, 0)]) },
    transform: { origin: chan([kf(3950, { x: 0, y: 0, type: 'corner' }, EZO), kf(4150, { x: 0, y: -12, type: 'corner' })]) },
  },
});
sceneKids.push(riskCap);

/* ---- beat 3: legs land on the completed ring; fence draws; NGN leg bumps ---- */
/* legs as GROUPS (origin on the group, child arc local-centred — the proven
   ngnLeg pattern; bare-path origin renders displaced) */
const leg = (name: string, a0: number, a1: number, metal: 'machined' | 'noble' | 'living', t0: number) =>
  grp(`leg-${name}`, [
    pathEl(`leg-${name}-arc`, arcNodes(0, 0, RING_R - 4, a0, a1, 20), {
      stroke: { paint: metalPaint(metal), opacity: 1, width: 40, lineCap: 'round' },
      fill: { paint: noPaint },
    }),
  ], {
    transform: { origin: { x: OX, y: OY, type: 'corner' } },
  }, {
    animators: {
      compositing: { opacity: chan([kf(t0, 0, EZO), kf(t0 + 250, 1)]) },
      transform: { scale: chan([kf(t0, { x: 0.55, y: 0.55 }, EZO), kf(t0 + 500, { x: 1, y: 1 })]) },
    },
  });
sceneKids.push(leg('usdm', -112, 2, 'machined', 4500), leg('paxg', 12, 118, 'noble', 4600));
const ngnLeg = grp('leg-ngn', [
  pathEl('leg-ngn-arc', arcNodes(0, 0, RING_R - 4, 128, 238, 16), {
    stroke: { paint: metalPaint('living'), opacity: 1, width: 40, lineCap: 'round' }, fill: { paint: noPaint },
  }),
], {
  transform: { origin: { x: OX, y: OY, type: 'corner' } }, compositing: { opacity: 0 },
}, {
  animators: {
    compositing: { opacity: chan([kf(4700, 0, EZO), kf(4950, 1)]) },
    transform: {
      scale: chan([
        kf(4700, { x: 0.55, y: 0.55 }, EZO), kf(5300, { x: 1, y: 1 }, EZ.linear),
        kf(5850, { x: 1.17, y: 1.17 }, { type: 'cubic-bezier', value: { from: { x: 0.4, y: 0 }, to: { x: 0.6, y: 1.3 } } }),
        kf(6250, { x: 1, y: 1 }, EZS),
      ]),
      origin: chan([
        kf(5300, { x: OX, y: OY, type: 'corner' }, EZO),
        kf(5850, { x: OX - 34, y: OY, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.4, y: 0 }, to: { x: 0.6, y: 1.25 } } }),
        kf(6250, { x: OX, y: OY, type: 'corner' }, EZS),
      ]),
    },
  },
});
sceneKids.push(ngnLeg);
/* ring group (for beat-5 dim + shift) wraps everything stage-left after this point —
   but elements are already pushed flat; instead dim the individual parts at beat 5. */
const stageLeft: any[] = []; // filled below for beat-5 dimming

/* fence draws around the ring */
const fx0 = OX - 320, fy0 = OY - 265, fw = 640, fh = 530;
const fence = rectEl('limits-fence', fw, fh, {
  transform: { translate: { x: fx0, y: fy0 } }, radiusXY: { x: 24, y: 24 },
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(ACC), opacity: 0.7, width: 3, dashArray: [14, 10], lineCap: 'round' },
}, {
  animators: {
    stroke: { dashOffset: chan([kf(4300, 2 * (fw + fh), EZ.out(0.3, 0.3)), kf(5400, 0)]) },
    compositing: { opacity: chan([kf(4300, 0, EZ.linear), kf(4350, 1)]) },
    transform: { origin: chan([
      kf(5900, { x: 0, y: 0, type: 'corner' }, EZO), kf(6030, { x: -7, y: 0, type: 'corner' }, EZO), kf(6250, { x: 0, y: 0, type: 'corner' }, EZS),
    ]) },
  },
});
sceneKids.push(fence);
const fenceLabel = textEl('limits-label', 'Your limits', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 600 }, textAnchor: 'start' }, {
  transform: { translate: { x: fx0 + 18, y: fy0 - 16 } }, fill: { paint: colorPaint(ACC) },
}, { animators: { compositing: { opacity: chan([kf(5200, 0, EZO), kf(5600, 1)]) } } });
sceneKids.push(fenceLabel);
/* other two leg labels (~30px) */
const legLabels = [
  textEl('leg-label-USDm', 'USDm', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 700 }, textAnchor: 'middle' }, {
    transform: { translate: { x: OX + 80, y: OY - RING_R - 45 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5450, 0, EZO), kf(5800, 1)]) } } }),
  textEl('leg-label-PAXG', 'PAXG', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 700 }, textAnchor: 'start' }, {
    transform: { translate: { x: OX + RING_R + 85, y: OY + 90 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5570, 0, EZO), kf(5920, 1)]) } } }),
  textEl('ngn-name-label', 'NGN', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 700 }, textAnchor: 'middle' }, {
    transform: { translate: { x: OX - 475, y: OY + 38 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5570, 0, EZO), kf(5920, 1)]) } } }),
];
sceneKids.push(...legLabels);

/* ---- beat 4: explanation replaces caption (bottom line, ~36px) ---- */
const explText = 'NGN lost 60% vs USD in 5 years — your plan caps any leg at 40%.';
const expl = textEl('explanation', explText, {
  fontFamily: 'Inter', fontSize: 36, fontStyle: { weight: 600 }, textAnchor: 'middle',
  rangeStyles: [{ from: explText.indexOf('60%'), to: explText.indexOf('60%') + 2, properties: { shape: { fontStyle: { weight: 800 } }, fill: { paint: colorPaint(P.gold) } } }],
}, {
  transform: { translate: { x: 700, y: 985 } }, fill: { paint: colorPaint(TXT) },
}, {
  animators: {
    compositing: { opacity: chan([kf(6600, 0, EZO), kf(7050, 1)]) },
    transform: { origin: chan([kf(6600, { x: 0, y: 8, type: 'corner' }, EZO), kf(7050, { x: 0, y: 0, type: 'corner' })]) },
  },
});
sceneKids.push(expl);

/* ---- beat 5: dim stage-left (ring+fence+labels) to 25%, shift left ~140px;
   seal takes centre at (1230,540). ---- */
const dimKeys = (base?: number) => ({
  compositing: { opacity: chan([kf(8600, base ?? 1, EZO), kf(8950, 0.25)]) },
});
for (const t of [gaugeArcWrap, ...sceneKids.filter((e) => (e.title || '').startsWith('leg-')), fence, fenceLabel]) {
  t.animators = t.animators || {};
  t.animators.compositing = t.animators.compositing || { opacity: { disabled: false, keys: [] } };
  const o = t.animators.compositing.opacity;
  const last = o.keys[o.keys.length - 1]?.value ?? 1;
  o.keys.push(kf(8600, last, EZO), kf(8950, 0.25));
}
/* shift-left on the stage elements via origin nudge (translate-based ones can't share;
   origin-shift moves element pos — apply to fence/legs/gauge which are origin/locals) */
for (const t of [fence, gaugeArcWrap, ...sceneKids.filter((e) => (e.title || '').startsWith('leg-'))]) {
  t.animators = t.animators || {};
  t.animators.transform = t.animators.transform || {};
  const oc = t.animators.transform.origin || (t.animators.transform.origin = { disabled: false, keys: [] });
  /* a fresh origin channel backward-holds its FIRST key for all prior time —
     seed it with the element's STATIC origin, else it jumps to (0,0) */
  const last = oc.keys[oc.keys.length - 1]?.value ?? t.properties?.transform?.origin ?? { x: 0, y: 0, type: 'corner' };
  oc.keys.push(kf(8600, last, EZO), kf(8950, { x: last.x - 130, y: last.y, type: 'corner' }));
}
const sealX = 1230, sealY = 540, sealR = 92;
const seal = grp('approve-seal', [
  circleEl('seal-ring', sealR, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: colorPaint(P.edge, 0.12) }, stroke: { paint: colorPaint(P.edge), opacity: 0.9, width: 5 } }),
  pathEl('seal-shield', [
    { x: 0, y: -34, type: 'cusp', mode: 0 }, { x: -26, y: -20, type: 'corner', mode: 0 },
    { x: -26, y: 8, type: 'cusp', mode: 0, end: { x: -26, y: 28 } },
    { x: 0, y: 38, type: 'cusp', mode: 0, start: { x: -14, y: 38 } },
    { x: 0, y: 38, type: 'cusp', mode: 0, end: { x: 14, y: 38 } },
    { x: 26, y: 8, type: 'cusp', mode: 0, start: { x: 26, y: 28 } },
    { x: 26, y: -20, type: 'corner', mode: 0 }, { x: 0, y: -34, type: 'cusp', mode: 0 },
  ], { fill: { paint: colorPaint(P.edge, 0.35) }, stroke: { paint: colorPaint(ICE), opacity: 0.8, width: 2.5 } }),
  pathEl('seal-check', [
    { x: -17, y: 1, type: 'corner', mode: 0 }, { x: -6, y: 13, type: 'corner', mode: 0 }, { x: 19, y: -13, type: 'corner', mode: 0 },
  ], { fill: { paint: noPaint }, stroke: { paint: colorPaint(P.gold), opacity: 1, width: 7, lineCap: 'round', lineJoin: 'round' } }),
], { transform: { origin: { x: sealX, y: sealY, type: 'corner' } } }, {
  animators: { transform: { scale: chan([kf(8600, { x: 0, y: 0 }, EZ.linear), kf(9000, { x: 1.12, y: 1.12 }, EZO), kf(9300, { x: 1, y: 1 }, EZS)]) } },
});
sceneKids.push(seal);
const holdR = sealR + 20, hcirc = 2 * Math.PI * holdR;
sceneKids.push(circleEl('hold-arc', holdR, {
  transform: { translate: { x: sealX, y: sealY }, rotate: -90 },
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(P.gold), opacity: 1, width: 6, lineCap: 'round', dashArray: [hcirc, hcirc], dashOffset: hcirc },
}, { animators: { stroke: { dashOffset: chan([kf(9150, hcirc, EZ.out(0.25, 0.25)), kf(10350, 0)]) } } }));
sceneKids.push(textEl('hold-cap', 'Hold to approve', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 500 }, textAnchor: 'middle' }, {
  transform: { translate: { x: sealX, y: sealY + sealR + 64 } }, fill: { paint: colorPaint(DIM) },
}, { animators: { compositing: { opacity: chan([kf(8800, 0, EZO), kf(9150, 1), kf(10450, 1, EZO), kf(10650, 0)]) } } }));

/* ---- scene group: everything clears at beat 6 (fade + 12px drift) ---- */

/* beat 5: the -60% label + NGN name clear entirely (not dimmed/shifted) */
for (const t of sceneKids.filter((e) => e.title === 'ngn-risk-label' || e.title === 'ngn-name-label')) {
  t.animators = t.animators || {};
  t.animators.compositing = t.animators.compositing || { opacity: { disabled: false, keys: [] } };
  const o = t.animators.compositing.opacity;
  const last = o.keys[o.keys.length - 1]?.value ?? t.properties?.compositing?.opacity ?? 1;
  o.keys.push(kf(8600, last, EZO), kf(8780, 0));
}

const scene = grp('scene', sceneKids, {}, {
  animators: {
    compositing: { opacity: chan([kf(10550, 1, EZO), kf(10750, 0)]) },
    transform: { origin: chan([kf(10550, { x: 0, y: 0, type: 'corner' }, EZO), kf(10750, { x: 0, y: -12, type: 'corner' })]) },
  },
});

/* ---- beat 6: END CARD (poster) — tagline centred-left ~72px, two lines;
   recorded row beneath ~28px with five dots; Guardian beside, neutral ---- */
const endcard = grp('endcard', [
  textEl('end-line', 'You set the rules.\nThe Guardian operates within them.', {
    fontFamily: 'Inter', fontSize: 64, fontStyle: { weight: 700 }, textAnchor: 'start',
  }, { transform: { translate: { x: 96, y: 430 } }, fill: { paint: colorPaint(ICE) } }),
  grp('ledger-row', [
    rectEl('ledger-bar', 560, 52, {
      transform: { translate: { x: 120, y: 640 } }, radiusXY: { x: 14, y: 14 },
      fill: { paint: colorPaint('#1e293b', 0.8) }, stroke: { paint: colorPaint(DIM), opacity: 0.35, width: 1.5 },
    }),
    textEl('ledger-text', 'Recorded · verifiable', { fontFamily: 'Inter', fontSize: 28, fontStyle: { weight: 600 }, textAnchor: 'start' }, {
      transform: { translate: { x: 144, y: 675 } }, fill: { paint: colorPaint(TXT) },
    }),
    ...[0, 1, 2, 3, 4].map((i) => circleEl(`net-dot-${i}`, 5, {
      transform: { translate: { x: 500 + i * 30, y: 666 } }, fill: { paint: colorPaint(P.gold, 0.25) },
    }, {
      animators: { fill: { paint: chan([kf(11300 + i * 130, colorPaint(P.gold, 0.25), EZO), kf(11400 + i * 130, colorPaint(P.gold, 1))]) } },
    })),
  ]),
], {}, {
  animators: {
    compositing: { opacity: chan([kf(10700, 0, EZO), kf(11350, 1)]) },
    transform: { origin: chan([kf(10700, { x: 0, y: 10, type: 'corner' }, EZO), kf(11350, { x: 0, y: 0, type: 'corner' })]) },
  },
});

/* ---- GUARDIAN ~400px, right third, vertically centred ---- */
const GC = { x: 1550, y: 520 };
const mark = guardianMark('guardian');
mark.properties.transform = { scale: { x: 4.0, y: 4.0 }, origin: { x: 0, y: 0, type: 'corner' } };
const dots = grp('think-dots', [
  circleEl('td1', 3.2, { transform: { translate: { x: 16, y: -28 } }, fill: { paint: colorPaint(P.eye) } }),
  circleEl('td2', 2.4, { transform: { translate: { x: 23, y: -33 } }, fill: { paint: colorPaint(P.eye) } }),
], {}, {
  animators: { compositing: { opacity: chan([kf(2150, 0, EZO), kf(2500, 0.9), kf(3300, 0.9, EZO), kf(3600, 0)]) } },
});
mark.children.push(dots);
const eyesGrp = mark.children.find((c: any) => c.title === 'eyes');
eyesGrp.animators = {
  transform: (() => {
    const k = eyesKeys([
      [0, { dx: -3 }], [2000, { dx: -3 }, EZS],
      [2350, { sY: 0.8, dx: 1, dy: -0.5 }, EZS],
      [3600, { sY: 1, dx: 0, dy: 0 }, EZS],
      [5400, { sY: 0.35, dy: 2 }, EZS],
      [6500, { sY: 1, dy: 0 }, EZS],
      [6700, { dx: -2.5 }, EZO], [8300, { dx: 2.5 }, EZ.linear], [8650, { dx: 0 }, EZS],
      [8750, { sY: 1.25, sX: 1.25, dy: -1.5 }, EZS],
      [10400, { sY: 1, sX: 1, dy: 0 }, EZS],
    ]);
    return { scale: k.scale, origin: k.origin };
  })(),
};
const guardian = grp('guardian-wrap', [mark], {
  transform: { origin: { x: GC.x, y: GC.y, type: 'corner' } },
}, {
  animators: {
    transform: { origin: chan([kf(0, { x: GC.x, y: GC.y + 30, type: 'corner' }, EZO), kf(900, { x: GC.x, y: GC.y, type: 'corner' })]) },
    compositing: { opacity: chan([kf(0, 0, EZO), kf(600, 1)]) },
  },
});

const document = doc(W, H, DUR, [scene, endcard, guardian]);
writeFileSync('/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs/a-loop.json', JSON.stringify(document, null, 1));
console.log('written a-loop.json (rework)', { dep });

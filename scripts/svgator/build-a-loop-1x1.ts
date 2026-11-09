/**
 * Piece A square — "The Guardian's loop" 1080×1080, 12.5s, modes-transform.
 * Stacked: stage object top-centre, Guardian right (~330px), explanation mid,
 * seal lower-right, end card bottom = tagline 2 lines + recorded row.
 */
import { writeFileSync } from 'node:fs';
import {
  doc, grp, pathEl, circleEl, rectEl, textEl, kf, chan, rgb, colorPaint,
  noPaint, metalPaint, guardianMark, eyesKeys, EZ, resetIds,
} from './lib';
import { getCurrencyRisk } from '../../apps/web/constants/currency-risk';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';

const W = 1080, H = 1080, DUR = 12500;
const dep = getCurrencyRisk('NGN')!.depreciation.vsUSD['5yr'];
resetIds();
const ICE = '#dbeafe', DIM = '#64748b', TXT = '#e2e8f0', ACC = P.edge;
const EZO = EZ.out(), EZS = EZ.settle();
const arcNodes = (cx: number, cy: number, r: number, a0: number, a1: number, n = 24) => {
  const pts: any[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * (i / n)) * Math.PI / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), type: i === 0 ? 'corner' : 'cusp', mode: 0 });
  }
  return pts;
};

const OX = 540, OY = 400, RING_R = 215;
const sceneKids: any[] = [];

/* beat 1 — coin + ticks into gauge */
sceneKids.push(grp('ngn-coin', [
  circleEl('ngn-disc', 74, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: metalPaint('living') } }),
  textEl('ngn-label', 'NGN', { fontFamily: 'Inter', fontSize: 30, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
    transform: { translate: { x: 0, y: 10 } }, fill: { paint: colorPaint('#fff7ed') }, compositing: { opacity: 0.85 } }),
], { transform: { origin: { x: 160, y: OY, type: 'corner' } } }, {
  animators: { transform: { scale: chan([kf(0, { x: 0, y: 0 }, EZ.spring(1.2)), kf(500, { x: 1, y: 1 }, EZ.linear), kf(1900, { x: 1, y: 1 }, EZO), kf(2150, { x: 0, y: 0 })]) } },
}));
sceneKids.push(...[0, 1, 2, 3, 4].map((i) => {
  const t0 = 350 + i * 120, t1 = t0 + 420, y = OY - 105 + i * 48;
  return rectEl(`tick-${i + 1}`, 40, 9, {
    radiusXY: { x: 4, y: 4 }, fill: { paint: colorPaint(ACC) }, compositing: { opacity: 0 },
  }, {
    animators: {
      transform: { origin: chan([kf(t0, { x: -55, y, type: 'corner' }, EZO), kf(t1, { x: OX - RING_R - 28, y, type: 'corner' })]) },
      compositing: { opacity: chan([kf(t0, 0, EZO), kf(t0 + 120, 1), kf(1850, 0.8, EZO), kf(2050, 0)]) },
    },
  });
}));

/* gauge: dim semicircle + bright fill + needle; at beat 3 a dashed full circle
   fades in = the arc completing into the ring's base */
const halfArc = Math.PI * RING_R;
const semiArc = pathEl('gauge-arc', arcNodes(OX, OY, RING_R, 180, 360, 18), {
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(DIM), opacity: 0.55, width: 10, lineCap: 'round', dashArray: [halfArc, halfArc], dashOffset: halfArc },
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
  stroke: { paint: colorPaint(DIM), opacity: 0, width: 8, dashArray: [4, 8] },
}, {
  animators: {
    stroke: { opacity: chan([kf(4300, 0, EZO), kf(4900, 0.55)]) },
    transform: { rotate: chan([kf(4300, -40, EZO), kf(4900, 0)]) },
  },
});
const gaugeWrap = grp('gauge-wrap', [semiArc, ringBase]);
sceneKids.push(gaugeWrap);
sceneKids.push(pathEl('gauge-fill', arcNodes(OX, OY, RING_R, 180, 360, 18), {
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(ACC), opacity: 0.9, width: 13, lineCap: 'round', dashArray: [6, 8] },
}, {
  animators: { compositing: { opacity: chan([kf(2050, 0, EZO), kf(2500, 0.9), kf(4200, 0.9, EZO), kf(4400, 0)]) } },
}));
sceneKids.push(grp('needle', [
  pathEl('needle-blade', [
    { x: -4, y: 0, type: 'corner', mode: 0 }, { x: 0, y: -(RING_R - 26), type: 'corner', mode: 0 }, { x: 4, y: 0, type: 'corner', mode: 0 },
  ], { fill: { paint: colorPaint(P.gold) } }),
  circleEl('needle-hub', 9, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: colorPaint(P.gold) } }),
], { transform: { origin: { x: OX, y: OY, type: 'corner' } } }, {
  animators: {
    transform: {
      rotate: chan([kf(2000, -88, EZ.out(0.2, 0.2)), kf(2900, 22, { type: 'cubic-bezier', value: { from: { x: 0.16, y: 1 }, to: { x: 0.25, y: 1.35 } } }), kf(3300, 18, EZS)]),
      scale: chan([kf(4000, { x: 1, y: 1 }, EZO), kf(4200, { x: 0, y: 0 })]),
    },
    compositing: { opacity: chan([kf(4000, 1, EZO), kf(4200, 0)]) },
  },
}));

/* −60% number 72px → travels to NGN leg label (30px) */
const numSpot = { x: OX, y: 645 };
const legLabelSpot = { x: OX - 360, y: OY }; /* outside fence left edge, ≥24px clear */
sceneKids.push(textEl('risk-num', `${dep}%`, { fontFamily: 'Inter', fontSize: 72, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
  transform: { translate: numSpot }, fill: { paint: colorPaint(TXT) },
}, {
  animators: {
    compositing: { opacity: chan([kf(3350, 0, EZO), kf(3700, 1), kf(5000, 1, EZO), kf(5180, 0)]) },
    transform: { origin: chan([
      kf(3350, { x: 0, y: 8, type: 'corner' }, EZO), kf(3700, { x: 0, y: 0, type: 'corner' }, EZS),
      kf(5000, { x: 0, y: 0, type: 'corner' }, EZO), kf(5180, { x: -16, y: 0, type: 'corner' }),
    ]) },
  },
}));
sceneKids.push(textEl('ngn-risk-label', `${dep}%`, {
  fontFamily: 'Inter', fontSize: 32, fontStyle: { weight: 800 }, textAnchor: 'middle',
}, {
  transform: { translate: { x: legLabelSpot.x, y: legLabelSpot.y } }, fill: { paint: colorPaint(TXT) },
}, {
  animators: { compositing: { opacity: chan([kf(5100, 0, EZO), kf(5380, 1)]) } },
}));
sceneKids.push(textEl('risk-cap', 'NGN vs USD · 5 years', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 500 }, textAnchor: 'middle' }, {
  transform: { translate: { x: OX, y: 685 } }, fill: { paint: colorPaint(DIM) },
}, {
  animators: {
    compositing: { opacity: chan([kf(3550, 0, EZO), kf(3900, 1), kf(3950, 1, EZO), kf(4150, 0)]) },
    transform: { origin: chan([kf(3950, { x: 0, y: 0, type: 'corner' }, EZO), kf(4150, { x: 0, y: -12, type: 'corner' })]) },
  },
}));

/* beat 3 — legs (groups!), fence, NGN bump */
const leg = (name: string, a0: number, a1: number, metal: 'machined' | 'noble' | 'living', t0: number) =>
  grp(`leg-${name}`, [
    pathEl(`leg-${name}-arc`, arcNodes(0, 0, RING_R - 3, a0, a1, 16), {
      stroke: { paint: metalPaint(metal), opacity: 1, width: 30, lineCap: 'round' }, fill: { paint: noPaint },
    }),
  ], { transform: { origin: { x: OX, y: OY, type: 'corner' } } }, {
    animators: {
      compositing: { opacity: chan([kf(t0, 0, EZO), kf(t0 + 250, 1)]) },
      transform: { scale: chan([kf(t0, { x: 0.55, y: 0.55 }, EZO), kf(t0 + 500, { x: 1, y: 1 })]) },
    },
  });
sceneKids.push(leg('usdm', -112, 2, 'machined', 4500), leg('paxg', 12, 118, 'noble', 4600));
sceneKids.push(grp('leg-ngn', [
  pathEl('leg-ngn-arc', arcNodes(0, 0, RING_R - 3, 128, 238, 14), {
    stroke: { paint: metalPaint('living'), opacity: 1, width: 30, lineCap: 'round' }, fill: { paint: noPaint },
  }),
], {
  transform: { origin: { x: OX, y: OY, type: 'corner' } },
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
        kf(5850, { x: OX - 26, y: OY, type: 'corner' }, { type: 'cubic-bezier', value: { from: { x: 0.4, y: 0 }, to: { x: 0.6, y: 1.25 } } }),
        kf(6250, { x: OX, y: OY, type: 'corner' }, EZS),
      ]),
    },
  },
}));
const fx0 = OX - 270, fy0 = OY - 215, fw = 540, fh = 430;
sceneKids.push(rectEl('limits-fence', fw, fh, {
  transform: { translate: { x: fx0, y: fy0 } }, radiusXY: { x: 20, y: 20 },
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(ACC), opacity: 0.7, width: 3, dashArray: [14, 10], lineCap: 'round' },
}, {
  animators: {
    stroke: { dashOffset: chan([kf(4300, 2 * (fw + fh), EZ.out(0.3, 0.3)), kf(5400, 0)]) },
    compositing: { opacity: chan([kf(4300, 0, EZ.linear), kf(4350, 1)]) },
    transform: { origin: chan([kf(5900, { x: 0, y: 0, type: 'corner' }, EZO), kf(6030, { x: -6, y: 0, type: 'corner' }, EZO), kf(6250, { x: 0, y: 0, type: 'corner' }, EZS)]) },
  },
}));
const fenceLabel = textEl('limits-label', 'Your limits', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 600 }, textAnchor: 'start' }, {
  transform: { translate: { x: fx0 + 14, y: fy0 - 12 } }, fill: { paint: colorPaint(ACC) },
}, { animators: { compositing: { opacity: chan([kf(5200, 0, EZO), kf(5600, 1)]) } } });
sceneKids.push(fenceLabel);
sceneKids.push(
  textEl('leg-label-USDm', 'USDm', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 700 }, textAnchor: 'middle' }, {
    transform: { translate: { x: OX + 60, y: OY - RING_R - 35 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5450, 0, EZO), kf(5800, 1)]) } } }),
  textEl('leg-label-PAXG', 'PAXG', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 700 }, textAnchor: 'start' }, {
    transform: { translate: { x: OX + RING_R + 65, y: OY + 75 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5570, 0, EZO), kf(5920, 1)]) } } }),
  textEl('ngn-name-label', 'NGN', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 700 }, textAnchor: 'middle' }, {
    transform: { translate: { x: OX - 360, y: OY + 30 } }, fill: { paint: colorPaint(TXT) },
  }, { animators: { compositing: { opacity: chan([kf(5570, 0, EZO), kf(5920, 1)]) } } }),
);

/* beat 4 — explanation */
const explText = 'NGN lost 60% vs USD in 5 years —\nyour plan caps any leg at 40%.';
sceneKids.push(textEl('explanation', explText, {
  fontFamily: 'Inter', fontSize: 28, fontStyle: { weight: 600 },
  rangeStyles: [{ from: explText.indexOf('60%'), to: explText.indexOf('60%') + 2, properties: { shape: { fontStyle: { weight: 800 } }, fill: { paint: colorPaint(P.gold) } } }],
  textAnchor: 'start',
}, {
  transform: { translate: { x: 48, y: 745 } }, fill: { paint: colorPaint(TXT) },
}, {
  animators: {
    compositing: { opacity: chan([kf(6600, 0, EZO), kf(7050, 1)]) },
    transform: { origin: chan([kf(6600, { x: 0, y: 8, type: 'corner' }, EZO), kf(7050, { x: 0, y: 0, type: 'corner' })]) },
  },
}));

/* beat 5 — dim stage to 25%, shift left; seal takes centre-right */
for (const t of [gaugeWrap, ...sceneKids.filter((e) => (e.title || '').startsWith('leg-')), sceneKids.find((e) => e.title === 'limits-fence'), fenceLabel, sceneKids.find((e) => e.title === 'never'),]) {
  if (!t) continue;
  t.animators = t.animators || {};
  t.animators.compositing = t.animators.compositing || { opacity: { disabled: false, keys: [] } };
  const o = t.animators.compositing.opacity;
  const last = o.keys[o.keys.length - 1]?.value ?? t.properties?.compositing?.opacity ?? 1;
  o.keys.push(kf(8600, last, EZO), kf(8950, 0.25));
}
for (const t of [sceneKids.find((e) => e.title === 'limits-fence'), gaugeWrap, ...sceneKids.filter((e) => (e.title || '').startsWith('leg-'))]) {
  if (!t) continue;
  t.animators = t.animators || {};
  t.animators.transform = t.animators.transform || {};
  const oc = t.animators.transform.origin || (t.animators.transform.origin = { disabled: false, keys: [] });
  const last = oc.keys[oc.keys.length - 1]?.value ?? t.properties?.transform?.origin ?? { x: 0, y: 0, type: 'corner' };
  oc.keys.push(kf(8600, last, EZO), kf(8950, { x: last.x - 110, y: last.y, type: 'corner' }));
}
const sealX = 540, sealY = 400, sealR = 64;
sceneKids.push(grp('approve-seal', [
  circleEl('seal-ring', sealR, { transform: { translate: { x: 0, y: 0 } }, fill: { paint: colorPaint(P.edge, 0.12) }, stroke: { paint: colorPaint(P.edge), opacity: 0.9, width: 4 } }),
  pathEl('seal-shield', [
    { x: 0, y: -24, type: 'cusp', mode: 0 }, { x: -18, y: -14, type: 'corner', mode: 0 },
    { x: -18, y: 6, type: 'cusp', mode: 0, end: { x: -18, y: 20 } },
    { x: 0, y: 27, type: 'cusp', mode: 0, start: { x: -10, y: 27 } },
    { x: 0, y: 27, type: 'cusp', mode: 0, end: { x: 10, y: 27 } },
    { x: 18, y: 6, type: 'cusp', mode: 0, start: { x: 18, y: 20 } },
    { x: 18, y: -14, type: 'corner', mode: 0 }, { x: 0, y: -24, type: 'cusp', mode: 0 },
  ], { fill: { paint: colorPaint(P.edge, 0.35) }, stroke: { paint: colorPaint(ICE), opacity: 0.8, width: 2 } }),
  pathEl('seal-check', [
    { x: -12, y: 1, type: 'corner', mode: 0 }, { x: -4, y: 9, type: 'corner', mode: 0 }, { x: 13, y: -9, type: 'corner', mode: 0 },
  ], { fill: { paint: noPaint }, stroke: { paint: colorPaint(P.gold), opacity: 1, width: 5, lineCap: 'round', lineJoin: 'round' } }),
], { transform: { origin: { x: sealX, y: sealY, type: 'corner' } } }, {
  animators: { transform: { scale: chan([kf(8600, { x: 0, y: 0 }, EZ.linear), kf(9000, { x: 1.12, y: 1.12 }, EZO), kf(9300, { x: 1, y: 1 }, EZS)]) } },
}));
const holdR = sealR + 14, hcirc = 2 * Math.PI * holdR;
sceneKids.push(circleEl('hold-arc', holdR, {
  transform: { translate: { x: sealX, y: sealY }, rotate: -90 },
  fill: { paint: noPaint },
  stroke: { paint: colorPaint(P.gold), opacity: 1, width: 5, lineCap: 'round', dashArray: [hcirc, hcirc], dashOffset: hcirc },
}, { animators: { stroke: { dashOffset: chan([kf(9150, hcirc, EZ.out(0.25, 0.25)), kf(10350, 0)]) } } }));
sceneKids.push(textEl('hold-cap', 'Hold to approve', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 500 }, textAnchor: 'middle' }, {
  transform: { translate: { x: sealX, y: sealY + sealR + 46 } }, fill: { paint: colorPaint(DIM) },
}, { animators: { compositing: { opacity: chan([kf(8800, 0, EZO), kf(9150, 1), kf(10450, 1, EZO), kf(10650, 0)]) } } }));


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

/* end card: tagline centred-left ~52px 2 lines + recorded row 24px under */
const endcard = grp('endcard', [
  textEl('end-line', 'You set the rules.\nThe Guardian operates within them.', {
    fontFamily: 'Inter', fontSize: 40, fontStyle: { weight: 700 }, textAnchor: 'start',
  }, { transform: { translate: { x: 48, y: 800 } }, fill: { paint: colorPaint(ICE) } }),
  grp('ledger-row', [
    rectEl('ledger-bar', 430, 42, {
      transform: { translate: { x: 48, y: 955 } }, radiusXY: { x: 12, y: 12 },
      fill: { paint: colorPaint('#1e293b', 0.8) }, stroke: { paint: colorPaint(DIM), opacity: 0.35, width: 1.5 },
    }),
    textEl('ledger-text', 'Recorded · verifiable', { fontFamily: 'Inter', fontSize: 24, fontStyle: { weight: 600 }, textAnchor: 'start' }, {
      transform: { translate: { x: 66, y: 984 } }, fill: { paint: colorPaint(TXT) },
    }),
    ...[0, 1, 2, 3, 4].map((i) => circleEl(`net-dot-${i}`, 4, {
      transform: { translate: { x: 358 + i * 24, y: 976 } }, fill: { paint: colorPaint(P.gold, 0.25) },
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

/* Guardian ~330px, right side upper-mid */
const GC = { x: 940, y: 860 };
const mark = guardianMark('guardian');
mark.properties.transform = { scale: { x: 2.6, y: 2.6 }, origin: { x: 0, y: 0, type: 'corner' } };
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
    transform: { origin: chan([kf(0, { x: GC.x, y: GC.y + 24, type: 'corner' }, EZO), kf(900, { x: GC.x, y: GC.y, type: 'corner' })]) },
    compositing: { opacity: chan([kf(0, 0, EZO), kf(600, 1)]) },
  },
});

const document = doc(W, H, DUR, [scene, endcard, guardian]);
writeFileSync('/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs/a-loop-1x1.json', JSON.stringify(document, null, 1));
console.log('written a-loop-1x1.json (rework)');

/**
 * Piece D — Guardian sticker pack. Six 512×512 transparent stickers, ≤3s,
 * seamless loops (first pose == last pose). Guardian fills ~80% of canvas.
 * Emits .perch/svgator-lab/v3/docs/sticker-<name>.json + docs list.
 */
import { writeFileSync } from 'node:fs';
import {
  doc, grp, pathEl, circleEl, rectEl, kf, chan, rgb, colorPaint, noPaint,
  guardianMark, eyesKeys, EZ, resetIds,
} from './lib';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';

const S = 512, DUR = 3000;
const OUT = '/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs';

/** guardian centred, ~80% of 512 → mark scale ~4.1 (100-unit centred mark) */
function stickerGuardian(extraChildren: any[] = [], opts: { scale?: number } = {}) {
  const mark = guardianMark('guardian');
  const sc = opts.scale ?? 4.1;
  mark.properties.transform = { scale: { x: sc, y: sc }, origin: { x: 0, y: 0, type: 'corner' } };
  mark.children.push(...extraChildren);
  const wrap = grp('guardian-wrap', [mark], {
    transform: { origin: { x: S / 2, y: S / 2 + 10, type: 'corner' } },
  });
  return { wrap, mark, eyes: mark.children.find((c: any) => c.title === 'eyes') };
}
const loopEyes = (eyes: any, moods: Array<[number, any, any?]>) => {
  const k = eyesKeys(moods);
  eyes.animators = { transform: { scale: k.scale, origin: k.origin } };
};

const docs: Record<string, any> = {};

/* watching — neutral, gaze glides left → right → centre */
{
  resetIds();
  const { wrap, eyes } = stickerGuardian();
  loopEyes(eyes, [
    [0, { dx: -4 }, EZ.settle()],
    [1100, { dx: -4 }, EZ.inout()],
    [2100, { dx: 4 }, EZ.inout()],
    [3000, { dx: -4 }],
  ]);
  docs.watching = doc(S, S, DUR, [wrap], '');
}

/* thinking — eyes ease to 0.8 + dots appear, hold, ease back */
{
  resetIds();
  const dots = grp('think-dots', [
    circleEl('td1', 6.4, { transform: { translate: { x: 14, y: -26 } }, fill: { paint: colorPaint(P.eye) } }),
    circleEl('td2', 4.8, { transform: { translate: { x: 20, y: -31 } }, fill: { paint: colorPaint(P.eye) } }),
  ], { compositing: { opacity: 0 } }, {
    animators: { compositing: { opacity: chan([kf(0, 0, EZ.linear), kf(500, 0, EZ.out()), kf(900, 0.9), kf(1900, 0.9, EZ.out()), kf(2300, 0), kf(3000, 0, EZ.linear)]) } },
  });
  const { wrap, eyes } = stickerGuardian([dots]);
  loopEyes(eyes, [
    [0, { sY: 1, dx: 0 }, EZ.settle()],
    [700, { sY: 0.8, dx: 1, dy: -0.5 }, EZ.settle()],
    [2000, { sY: 0.8, dx: 1, dy: -0.5 }, EZ.settle()],
    [2700, { sY: 1, dx: 0, dy: 0 }],
    [3000, { sY: 1, dx: 0, dy: 0 }],
  ]);
  docs.thinking = doc(S, S, DUR, [wrap], '');
}

/* alert — eyes 1.25 + gaze lift, hold, ease back */
{
  resetIds();
  const { wrap, eyes } = stickerGuardian();
  loopEyes(eyes, [
    [0, { sY: 1, sX: 1, dy: 0 }, EZ.out()],
    [620, { sY: 1.32, sX: 1.32, dy: -1.5 }, EZ.settle()],
    [850, { sY: 1.25, sX: 1.25, dy: -1.5 }, EZ.settle()],
    [1900, { sY: 1.25, sX: 1.25, dy: -1.5 }, EZ.settle()],
    [2700, { sY: 1, sX: 1, dy: 0 }],
    [3000, { sY: 1, sX: 1, dy: 0 }],
  ]);
  docs.alert = doc(S, S, DUR, [wrap], '');
}

/* protective — slit + gaze drop, hold, ease back */
{
  resetIds();
  const { wrap, eyes } = stickerGuardian();
  loopEyes(eyes, [
    [0, { sY: 1, dy: 0 }, EZ.inout()],
    [950, { sY: 0.35, dy: 2 }, EZ.settle()],
    [2000, { sY: 0.35, dy: 2 }, EZ.inout()],
    [2800, { sY: 1, dy: 0 }],
    [3000, { sY: 1, dy: 0 }],
  ]);
  docs.protective = doc(S, S, DUR, [wrap], '');
}

/* small seal builder (mark-local? — sticker-level, canvas coords via own group) */
function miniSeal(title: string, x: number, y: number, r: number, tIn: number, tHold: number, tOut: number, withCheck = true) {
  const kids: any[] = [
    circleEl(`${title}-ring`, r, {
      transform: { translate: { x: 0, y: 0 } },
      fill: { paint: colorPaint(P.edge, 0.15) },
      stroke: { paint: colorPaint(P.edge), opacity: 0.95, width: 4 },
    }),
  ];
  if (withCheck) {
    kids.push(pathEl(`${title}-check`, [
      { x: -r * 0.4, y: 0, type: 'corner', mode: 0 },
      { x: -r * 0.1, y: r * 0.32, type: 'corner', mode: 0 },
      { x: r * 0.42, y: -r * 0.3, type: 'corner', mode: 0 },
    ], { fill: { paint: noPaint }, stroke: { paint: colorPaint(P.gold), width: 5, lineCap: 'round', lineJoin: 'round' } }));
  }
  return grp(title, kids, {
    transform: { origin: { x, y, type: 'corner' }, scale: { x: 0, y: 0 } },
    compositing: { opacity: 0 },
  }, {
    animators: {
      transform: { scale: chan([
        kf(tIn, { x: 0, y: 0 }, EZ.linear),
        kf(tIn + 300, { x: 1.15, y: 1.15 }, EZ.out()),
        kf(tIn + 480, { x: 1, y: 1 }, EZ.settle()),
        kf(tOut, { x: 1, y: 1 }, EZ.inout()),
        kf(Math.min(DUR - 100, tOut + 350), { x: 0, y: 0 }),
      ]) },
      compositing: { opacity: chan([kf(tIn, 0, EZ.linear), kf(tIn + 80, 1), kf(tOut + 200, 1, EZ.out()), kf(Math.min(DUR - 50, tOut + 380), 0)]) },
    },
  });
}

/* plan-saved — seal stamps beside the Guardian then fades back out */
{
  resetIds();
  const { wrap, eyes } = stickerGuardian();
  loopEyes(eyes, [[0, {}]]);
  const seal = miniSeal('plan-seal', S / 2 + 148, S / 2 + 120, 70, 700, 2200, 2200);
  docs['plan-saved'] = doc(S, S, DUR, [wrap, seal], '');
}

/* verified — check-seal stamps then fades out */
{
  resetIds();
  const { wrap, eyes } = stickerGuardian();
  loopEyes(eyes, [
    [0, { sY: 1 }], [700, { sY: 1 }], [900, { sY: 0.8 }, EZ.blink()], [1150, { sY: 1 }, EZ.out()], [3000, { sY: 1 }], /* tiny confirm blink */
  ]);
  const seal = miniSeal('verify-seal', S / 2 + 145, S / 2 + 115, 72, 600, 2100, 2100);
  docs.verified = doc(S, S, DUR, [wrap, seal], '');
}

const list: string[] = [];
for (const [name, d] of Object.entries(docs)) {
  // transparent bg: doc() with '' bg → none
  writeFileSync(`${OUT}/sticker-${name}.json`, JSON.stringify(d, null, 1));
  list.push(name);
  console.log('written', name);
}
writeFileSync(`${OUT}/stickers-list.json`, JSON.stringify(list));

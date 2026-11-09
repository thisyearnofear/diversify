/**
 * Piece B — currency cards. One 1200×630 doc per code (4.5s, once, hold).
 * Data strictly from getCurrencyRisk(); skips codes missing or 5yr > -10.
 * Emits .perch/svgator-lab/v3/docs/card-<code>.json + report rows.
 */
import { writeFileSync } from 'node:fs';
import {
  doc, grp, circleEl, textEl, kf, chan, rgb, colorPaint, noPaint,
  metalPaint, guardianMark, eyesKeys, patinaBlotches, EZ, resetIds,
} from './lib';
import { getCurrencyRisk, CURRENCY_RISK_DATA_AS_OF } from '../../apps/web/constants/currency-risk';
import { GUARDIAN_PALETTE as P } from '../../apps/web/components/shared/guardian-mark';
import { patinaFor } from '../../apps/web/lib/foundry';

const W = 1200, H = 630, DUR = 4500;
const CODES = ['NGN', 'GHS', 'KES', 'ZAR', 'BRL', 'COP', 'PHP', 'EGP', 'ARS', 'TRY'];
const OUT = '/Users/udingethe/Dev/diversifi/.perch/svgator-lab/v3/docs';

const field = '#0f172a', TXT = '#e2e8f0', DIM = '#64748b', PATINA = '#4f8a78';

function card(code: string) {
  const entry = getCurrencyRisk(code);
  if (!entry) return { code, skipped: 'no dataset entry' };
  const dep = entry.depreciation.vsUSD['5yr'];
  if (!(dep <= -10)) return { code, dep, skipped: `5yr ${dep} > -10` };
  const kept = 1 + dep / 100;
  const shrink = Math.sqrt(kept);
  const patina = Math.min(1, Math.max(0, -dep / 60));

  resetIds();
  /* ghost + coin share ONE centre for the whole animation; coin enters filling
     the ghost exactly, then shrinks about that centre — never clipped. */
  const CX = 330, CY = 300, R = 190;

  const children: any[] = [];

  /* ghost outline — stays at original size */
  children.push(circleEl('ghost', R, {
    transform: { translate: { x: CX, y: CY } },
    fill: { paint: noPaint },
    stroke: { paint: colorPaint(DIM), opacity: 0.45, width: 3, dashArray: [12, 9] },
  }));

  /* coin group: disc + textured patina blotches + label, all local-centred;
     group origin = shared centre. scale 0→1 (fill ghost), hold, 1→sqrt(kept) over 1.6s */
  const coinGrp = grp('coin', [
    circleEl('disc', R, {
      transform: { translate: { x: 0, y: 0 } },
      fill: { paint: metalPaint('living') },
    }),
    patinaBlotches('coin-weather', R, patina, 900, 2500),
    textEl('code', code, { fontFamily: 'Inter', fontSize: 64, fontStyle: { weight: 800 }, textAnchor: 'middle' }, {
      transform: { translate: { x: 0, y: 22 } },
      fill: { paint: colorPaint('#fff7ed') },
    }),
  ], {
    transform: { origin: { x: CX, y: CY, type: 'corner' } },
  });
  coinGrp.animators = {
    transform: {
      scale: chan([
        kf(300, { x: 0, y: 0 }, EZ.spring(1.15)), kf(750, { x: 1, y: 1 }, EZ.linear),
        kf(1000, { x: 1, y: 1 }, EZ.out(0.25, 0.3)), kf(2600, { x: shrink, y: shrink }),
      ]),
    },
  };
  children.push(coinGrp);

  /* headline lands after the shrink — 3 lines, number+fewer emphasised */
  const hlX = 560, hlSize = 48;
  const l1 = `${code} buys`;
  const l2 = `${Math.abs(dep)}% fewer US dollars`;
  const l3 = 'than five years ago.';
  for (const ln of [l1, l2, l3]) {
    const w = ln.length * 0.55 * hlSize;
    if (hlX + w > 1200 - 48) throw new Error(`headline overflow ${code}: "${ln}" est ${w.toFixed(0)}px`);
  }
  const full = l1 + '\n' + l2 + '\n' + l3;
  children.push(textEl('headline', full, {
    fontFamily: 'Inter', fontSize: hlSize, fontStyle: { weight: 500 }, textAnchor: 'start',
    rangeStyles: [{ from: l1.length + 1, to: l1.length + 1 + `${Math.abs(dep)}% fewer`.length - 1, properties: { shape: { fontStyle: { weight: 800 } }, fill: { paint: colorPaint(P.gold) } } }],
  }, {
    transform: { translate: { x: hlX, y: 230 } },
    fill: { paint: colorPaint(TXT) },
    compositing: { opacity: 0 },
  }, {
    animators: {
      compositing: { opacity: chan([kf(2700, 0, EZ.out()), kf(3100, 1)]) },
      transform: { origin: chan([kf(2700, { x: 0, y: 8, type: 'corner' }, EZ.out()), kf(3100, { x: 0, y: 0, type: 'corner' })]) },
    },
  }));

  /* footer — visible from t=0 */
  children.push(textEl('footer', `DiversiFi curated FX dataset (central banks, IMF, World Bank) · approximate · reviewed ${CURRENCY_RISK_DATA_AS_OF} · facts, not advice`, {
    fontFamily: 'Inter', fontSize: 19, fontStyle: { weight: 400 }, textAnchor: 'start',
  }, {
    transform: { translate: { x: 48, y: 596 } },
    fill: { paint: colorPaint(DIM) },
  }));

  /* Guardian ~130px lower-right, protective, gaze at the coin */
  const g = guardianMark('guardian');
  /* mark children centred at local 0 → wrapper translate = mark-centre pos, scale 1.3 */
  const wrap = grp('guardian-wrap', [g], {
    transform: { translate: { x: 1040, y: 468 } },
  });
  g.properties.transform = { scale: { x: 1.3, y: 1.3 }, origin: { x: 0, y: 0, type: 'corner' } };
  const eyes = g.children.find((c: any) => c.title === 'eyes');
  eyes.animators = {
    transform: (() => {
      const k = eyesKeys([[0, { sY: 0.35, dx: -3.5, dy: 2 }]]);
      return { scale: k.scale, origin: k.origin };
    })(),
  };
  children.push(wrap);

  const d = doc(W, H, DUR, children, field);
  writeFileSync(`${OUT}/card-${code}.json`, JSON.stringify(d, null, 1));
  return { code, dep, kept: +kept.toFixed(3), patina: +patina.toFixed(2), shrink: +shrink.toFixed(3), file: `card-${code}.json` };
}

const report = CODES.map(card);
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/cards-report.json`, JSON.stringify(report, null, 1));

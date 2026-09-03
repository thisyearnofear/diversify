/**
 * RiskSparkline — the real 12-month path of a currency.
 *
 * Drawn from sampled daily tables (indexed to 100 at the start of the
 * window): a real path, never an interpolated curve. A declining line =
 * the currency bought less USD over the year.
 */

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function RiskSparkline({ values, code }: { values: number[]; code: string }) {
  const reduceMotion = useReducedMotion();
  const gradId = useId();
  const W = 100;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  const declining = values[values.length - 1] < values[0];
  const stroke = declining ? '#fbbf24' : '#34d399'; // amber-400 / emerald-400

  return (
    <div className="mb-3">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
          12-month path vs USD
        </span>
        <span className="text-[9px] text-slate-500">· live · indexed to 100</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12"
        role="img"
        aria-label={`${code} purchasing power against the US dollar over the last 12 months, indexed to 100 at the start of the window. Live data, ${declining ? 'declining' : 'holding or rising'}.`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <motion.path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
      </svg>
    </div>
  );
}

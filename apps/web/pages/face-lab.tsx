/**
 * Face lab — the Guardian's state board (dev page, like /stamps-test).
 *
 * Every mood × a few gaze targets, frozen side by side — the whole
 * emotional range at once, borrowed from bloub's #planche board. Rows
 * are moods, columns are gaze targets; the last row shows the live
 * (non-frozen) mascot beside it for calibration.
 */
import { GuardianMascot } from '@/components/shared/GuardianMascot';
import { saccadeAt } from '@/lib/mascot-scan';

const MOODS = ['happy', 'neutral', 'thinking', 'protective', 'alert'] as const;
const GAZES = [
  { label: 'rest', gaze: 'off' as const },
  { label: 'left', gaze: { x: -0.6, y: -0.1 } },
  { label: 'right', gaze: { x: 0.6, y: -0.1 } },
  { label: 'up', gaze: { x: 0.2, y: 0.2 } },
  { label: 'down', gaze: { x: -0.1, y: -0.25 } },
];

export default function FaceLab() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8 text-gray-900 dark:text-white">
      <h1 className="text-xl font-black">Face lab</h1>
      <p className="mt-1 text-sm text-gray-500">
        The Guardian&apos;s state board — every mood across gaze targets, frozen.
      </p>
      <div className="mt-8 space-y-8">
        {MOODS.map((mood) => (
          <section key={mood}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
              {mood}
            </h2>
            <div className="flex flex-wrap items-end gap-6">
              {GAZES.map((g) => (
                <div key={g.label} className="flex flex-col items-center gap-1">
                  <GuardianMascot size={88} mood={mood} gaze={g.gaze} frozen />
                  <span className="text-2xs text-gray-400">{g.label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
            live — for calibration
          </h2>
          <div className="flex flex-wrap items-end gap-6">
            <GuardianMascot size={96} mood="neutral" gaze={{ x: 0.4, y: -0.1 }} />
            <div className="flex flex-col items-center gap-1">
              <GuardianMascot size={96} mood="thinking" gaze="pointer" />
              <span className="text-2xs text-gray-400">pointer</span>
            </div>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
            scan schedule — first 8 saccades
          </h2>
          <ol className="text-xs text-gray-500 font-mono space-y-0.5">
            {Array.from({ length: 8 }, (_, i) => saccadeAt(1, i)).map((s, i) => (
              <li key={i}>
                #{i}: x={s.x} y={s.y} · {s.dwellMs}ms
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

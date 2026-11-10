/**
 * StageBands — the presenter control (design-language §1: controls are the
 * motif, §4: a segmented control is learned once and then reused).
 *
 * One row of pills, one reading slot, one band shown at a time. Choosing the
 * active pill is the exit, so the row never needs its own close button, and
 * a mode that has nothing to show withdraws its pill rather than rendering
 * an empty slot (§5: modes transform, never append).
 *
 * Exchange uses it for `Story | Pairs | Journey | Verify`; Shield and Home
 * for their own bands. `floor` is the band the row returns to — the resting
 * reading, not a mode.
 */

import React from "react";

export interface StageBandOption<T extends string = string> {
  id: T;
  label: string;
}

interface StageBandsProps<T extends string> {
  options: StageBandOption<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** What the row chooses, phrased for the object it rewrites. */
  groupLabel: string;
  /** Test-id root — `<base>-bands` for the row, `<base>-band-<id>` per pill.
   *  One base per tab so a suite only ever queries its own row. */
  testIdBase?: string;
}

export function StageBands<T extends string>({
  options,
  active,
  onSelect,
  groupLabel,
  testIdBase = "stage",
}: StageBandsProps<T>) {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-testid={`${testIdBase}-bands`}
      className="mt-3 flex items-center justify-center gap-1.5"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          data-testid={`${testIdBase}-band-${option.id}`}
          aria-pressed={active === option.id}
          onClick={() => onSelect(option.id)}
          className={`min-h-tap rounded-full px-3 text-2xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
            active === option.id
              ? "bg-ink text-surface"
              : "bg-ink/[0.05] text-ink/60 hover:bg-ink/10"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default StageBands;

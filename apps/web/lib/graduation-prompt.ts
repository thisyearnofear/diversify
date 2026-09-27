/**
 * Retail → business graduation prompt copy (Home transition slot).
 *
 * The graduation endpoint returns raw signal state, never a recommendation;
 * the line names the observed pattern as a question and points at the
 * per-cycle FX drag report. One line, neutral, evidence-first — it never
 * claims the user IS a business or that they lost money.
 */

export interface GraduationSignals {
  cyclical: boolean;
  corridor: boolean;
  largerBalance: boolean;
  hasSavedCycle: boolean;
}

/** Which signal leads the line — also the coarse funnel prop. */
export function leadGraduationSignal(signals: GraduationSignals): keyof GraduationSignals | null {
  if (signals.hasSavedCycle) return "hasSavedCycle";
  if (signals.corridor) return "corridor";
  if (signals.cyclical) return "cyclical";
  return null;
}

export function graduationPromptLine(signals: GraduationSignals): string | null {
  switch (leadGraduationSignal(signals)) {
    case "hasSavedCycle":
      return "Your saved payment cycle is ready — see what FX timing costs it →";
    case "corridor":
      return "Moving local savings into dollars often? See what FX timing costs each cycle →";
    case "cyclical":
      return "Saving toward regular payments? See what FX timing costs each cycle →";
    default:
      // largerBalance alone never clears the endpoint's threshold; if it
      // somehow arrives alone, say nothing rather than guess.
      return null;
  }
}

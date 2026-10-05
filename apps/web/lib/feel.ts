/**
 * Feel — the one preference for non-visual feedback.
 *
 *   silent: no vibration, no sound
 *   touch:  vibration on taps and confirms (the default — what haptics did before)
 *   sound:  touch + a soft clink when a coin settles (opt-in)
 *
 * Feedback marks real state only: a draft landing, a settlement confirmed.
 * Never ambient, never a reward loop.
 */
export type Feel = "silent" | "touch" | "sound";

export const FEELS: readonly Feel[] = ["silent", "touch", "sound"];
export const FEEL_KEY = "diversifi.feel";

export function getFeel(): Feel {
  if (typeof window === "undefined") return "touch";
  try {
    const v = window.localStorage.getItem(FEEL_KEY);
    return (FEELS as readonly string[]).includes(v ?? "") ? (v as Feel) : "touch";
  } catch {
    return "touch";
  }
}

export function setFeel(next: Feel): void {
  try {
    window.localStorage.setItem(FEEL_KEY, next);
  } catch {
    // Private mode — the preference just doesn't persist.
  }
}

let ctx: AudioContext | null = null;

/** A short metallic clink, synthesised — no asset to load. */
export function clink(): void {
  if (typeof window === "undefined" || getFeel() !== "sound") return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    out.connect(ctx.destination);
    for (const [freq, level] of [
      [1760, 1],
      [2637, 0.5],
      [4186, 0.2],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.value = level;
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.36);
    }
  } catch {
    // Sound must never break the app.
  }
}

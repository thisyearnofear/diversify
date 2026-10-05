/**
 * Protagonist anchors — where the user's currency coin lives on each tab.
 * Kept free of motion imports so objects (GuardianMascot, PairStage) can
 * mark their anchor without pulling in the flight overlay.
 */

export const ANCHOR_ATTR = "data-protagonist-anchor";
export const LANDING_ATTR = "data-protagonist-landing";
/** Where the coin declares its identity (Home's currency coin). */
export const SYMBOL_ATTR = "data-protagonist-symbol";
export const COLOR_ATTR = "data-protagonist-color";
/** 'land' = coin arrives at full anchor size; 'absorb' = it sinks into the
 *  anchor (Shield's ring hole) and fades. */
export const MODE_ATTR = "data-protagonist-mode";
/** What currency the anchor currently holds (Exchange's "from" token). The
 *  coin only lands where its own currency is — never on a different one. */
export const HOLDS_ATTR = "data-protagonist-holds";

export type ProtagonistMode = "land" | "absorb";

/** Data attributes that mark an element as the protagonist's home on a tab. */
export function protagonistAnchor(
  tab: string,
  opts: { symbol?: string; color?: string; mode?: ProtagonistMode; holds?: string } = {},
): Record<string, string> {
  const attrs: Record<string, string> = { [ANCHOR_ATTR]: tab };
  if (opts.symbol) attrs[SYMBOL_ATTR] = opts.symbol;
  if (opts.color) attrs[COLOR_ATTR] = opts.color;
  if (opts.mode) attrs[MODE_ATTR] = opts.mode;
  if (opts.holds) attrs[HOLDS_ATTR] = opts.holds;
  return attrs;
}

/** Does an anchor holding `holds` (e.g. "NGNm") carry currency `symbol` ("NGN")? */
export function holdsCurrency(holds: string | null, symbol: string): boolean {
  if (!holds) return true;
  return holds.toLowerCase().replace(/m$/, "") === symbol.toLowerCase();
}


/** Marks the onboarding coin the user just chose — the handoff's origin. */
export const HANDOFF_ORIGIN_ATTR = "data-handoff-origin";

export interface Handoff {
  from: { x: number; y: number; size: number };
  symbol: string;
  color: string;
  at: number;
}

/** A handoff older than this was never picked up — the shell is not coming. */
export const HANDOFF_TTL_MS = 5000;
let pending: Handoff | null = null;

/** Onboarding → app shell: onboarding unmounts as the shell mounts (same
 *  page, no navigation), so the chosen coin's last position is held here
 *  for the shell's first scene to pick up once. */
export function stashHandoff(h: Omit<Handoff, "at">): void {
  pending = { ...h, at: Date.now() };
}

/** Read without consuming — a StrictMode remount must still see it. */
export function peekHandoff(): Handoff | null {
  if (pending && Date.now() - pending.at > HANDOFF_TTL_MS) pending = null;
  return pending;
}

export function clearHandoff(): void {
  pending = null;
}

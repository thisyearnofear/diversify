/**
 * shieldPatternFor — the archetype pattern slot for Shield's shell.
 *
 * Derives the `shields-pattern--*` class + archetype accent tint from the
 * strategy key. Shared by BOTH Shield morphs (connected ProtectionTab,
 * unconnected ProtectionNotConnected) so the surface tints identically
 * whether or not a wallet is attached. Null when no philosophy is chosen —
 * the picker stays quiet gray until identity exists.
 */

import { strategyAccent } from "@/components/shared/palette";

export interface ShieldPattern {
  className: string;
  color: string;
}

export function shieldPatternFor(
  strategyKey: string | null | undefined,
): ShieldPattern | null {
  if (!strategyKey) return null;
  // Live strategy ids are already archetype-normalized ("islamic",
  // "global"); the replaces cover the archetype-id spellings.
  const normalized = strategyKey
    .replace("_finance", "")
    .replace("_diversification", "");
  return {
    className: `shields-pattern--${normalized}`,
    color: strategyAccent(strategyKey),
  };
}

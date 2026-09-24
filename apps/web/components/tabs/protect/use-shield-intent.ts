import { useEffect } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import { useNavigation } from "@/context/app/NavigationContext";
import { resolveIntentFocus } from "@/lib/resolve-intent-focus";
import { trackFunnelEvent } from "@/lib/analytics";
import type { ShieldShape } from "./shield-shape";

interface UseShieldIntentArgs {
  address: string | null;
  isDemo: boolean;
  isLoading: boolean | undefined;
  /** The live (non-demo) portfolio — used only for its lastUpdated gate. */
  portfolio: MultichainPortfolio | null;
  isPreviewing: boolean;
  hasPlan: boolean;
  shape: ShieldShape;
  allocations: { token: string; percent: number }[];
  heldPctByToken: Map<string, number>;
  setComparing: (v: boolean) => void;
  setFocusedToken: (v: string | null) => void;
}

export function useShieldIntent({
  address,
  isDemo,
  isLoading,
  portfolio,
  isPreviewing,
  hasPlan,
  shape,
  allocations,
  heldPctByToken,
  setComparing,
  setFocusedToken,
}: UseShieldIntentArgs): void {
  const { pendingIntent, consumeIntent } = useNavigation();

  // Cross-tab intent (e.g. Home's "Strengthen {region} coverage in Shield",
  // a compare deep link, or a receipt's "back to plan"): resolve the
  // question once the wallet has settled. Transient — consumed exactly
  // once, never persisted. A balance-preview draft is never silently
  // discarded: consume without focusing while previewing.
  useEffect(() => {
    if (pendingIntent?.tab !== "protect") return;
    if (address && !isDemo && isLoading && portfolio?.lastUpdated == null) return;
    const intent = pendingIntent.intent;
    let outcome: "compare" | "focused" | "unfocused" | "preview_kept";
    if (intent.lens === "compare") {
      // No plan → the picker already IS the gallery; just consume.
      if (hasPlan && shape !== "picker") {
        setFocusedToken(null);
        setComparing(true);
      }
      outcome = "compare";
    } else if (isPreviewing) {
      outcome = "preview_kept";
    } else if (hasPlan && shape !== "picker") {
      const token = resolveIntentFocus(intent, allocations, heldPctByToken);
      if (token) {
        setComparing(false);
        setFocusedToken(token);
      }
      outcome = token ? "focused" : "unfocused";
    } else {
      outcome = "unfocused";
    }
    trackFunnelEvent("intent_handoff", {
      source: intent.source,
      target: "protect",
      outcome,
    });
    consumeIntent();
  }, [
    pendingIntent,
    address,
    isDemo,
    isLoading,
    portfolio,
    isPreviewing,
    hasPlan,
    shape,
    allocations,
    heldPctByToken,
    consumeIntent,
    setComparing,
    setFocusedToken,
  ]);
}

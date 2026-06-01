/**
 * useAppInit — Handles initialisation: Farcaster SDK ready signal,
 * MiniPay detection, and routing. Keeps _app.tsx focused on layout.
 */
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

export function useAppInit() {
  const [isInMiniPay, setIsInMiniPay] = useState(false);
  const initialized = useRef(false);
  const router = useRouter();

  useEffect(() => {
    // Run once — router is captured in a ref to avoid re-triggering on navigation
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        const { isMiniPayEnvironment } = await import("@diversifi/shared");
        const inMiniPay = isMiniPayEnvironment();
        setIsInMiniPay(inMiniPay);

        // Signal Farcaster Readiness
        try {
          const { default: sdk } = await import("@farcaster/miniapp-sdk");
          if (sdk?.actions?.ready) {
            sdk.actions.ready();
          } else if ((sdk as any)?.ready) {
            (sdk as any).ready();
          }
        } catch {
          // Farcaster SDK not available — not in a Farcaster context
        }

        // Redirect MiniPay users to the MiniPay-specific page
        if (inMiniPay && router.pathname === "/") {
          router.push("/minipay-test");
        }
      } catch (e) {
        console.error("App initialization failed:", e);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isInMiniPay };
}
/**
 * OfflineBanner — one quiet line when the network drops, one when it
 * comes back. Says exactly what happens meanwhile: what you see is your
 * last reading, and swaps don't send (nothing is queued behind your back).
 */
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { reveal } from "@/lib/motion-tokens";

const BACK_ONLINE_MS = 2500;

export function OfflineBanner() {
  const online = useOnlineStatus();
  const reducedMotion = useReducedMotion();
  const wasOffline = useRef(false);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBack(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowBack(true);
    const t = window.setTimeout(() => setShowBack(false), BACK_ONLINE_MS);
    return () => window.clearTimeout(t);
  }, [online]);

  const message = !online
    ? "You're offline — showing your last reading. Swaps won't send until you reconnect."
    : showBack
      ? "Back online."
      : null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[120] pt-safe flex justify-center pointer-events-none px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {message && (
          <motion.p
            key={online ? "online" : "offline"}
            data-testid="offline-banner"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reducedMotion ? { duration: 0 } : reveal}
            className={`mt-2 max-w-md rounded-full px-4 py-1.5 text-xs font-medium shadow-card ${
              online
                ? "bg-emerald-600 text-white"
                : "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            }`}
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OfflineBanner;

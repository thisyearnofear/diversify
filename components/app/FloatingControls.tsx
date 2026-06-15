/**
 * FloatingControls — Advisor FAB, tour triggers, and guided tour overlay.
 *
 * Renders the floating UI elements that sit above the tab content.
 * Extracted from AppShell.tsx per the 9/10 roadmap (Task 3).
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import TourTrigger from "@/components/tour/TourTrigger";

const GuidedTour = dynamic(() => import("@/components/tour/GuidedTour"), {
  ssr: false,
});

export interface FloatingControlsProps {
  openAdvisor: () => void;
  unreadCount: number;
}

export default function FloatingControls({ openAdvisor, unreadCount }: FloatingControlsProps) {
  // Track unread count changes for bounce animation
  const [prevUnread, setPrevUnread] = useState(unreadCount);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (unreadCount > prevUnread) {
      setBounceKey((k) => k + 1);
    }
    setPrevUnread(unreadCount);
  }, [unreadCount, prevUnread]);

  return (
    <>
      <TourTrigger />

      <AnimatePresence>
        <GuidedTour />
      </AnimatePresence>

      {/* Ask the Advisor floating action button */}
      <motion.button
        key={bounceKey}
        onClick={openAdvisor}
        aria-label="Ask the Advisor — chat about your savings"
        title="Ask the Advisor"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed bottom-20 right-4 z-40 h-12 pl-3 pr-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center gap-2"
      >
        <span className="text-lg leading-none">💬</span>
        <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">Ask</span>
        {unreadCount > 0 && (
          <motion.span
            key={`badge-${bounceKey}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.2, 1], opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
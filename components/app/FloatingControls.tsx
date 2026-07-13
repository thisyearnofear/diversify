/**
 * FloatingControls — Guardian FAB, proactive updates, tour triggers.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import TourTrigger from "@/components/tour/TourTrigger";
import { GuardianMascot } from "@/components/shared/GuardianMascot";
import GuardianUpdates from "@/components/agent/GuardianUpdates";
import { ASK_GUARDIAN_LABEL } from "@/constants/guardian-copy";
import type { UserExperienceMode } from "@/context/app/types";
import type { GuardianUpdate } from "@/context/AIConversationContext";

const GuidedTour = dynamic(() => import("@/components/tour/GuidedTour"), {
  ssr: false,
});

export interface FloatingControlsProps {
  openAdvisor: () => void;
  unreadCount: number;
  experienceMode?: UserExperienceMode;
  guardianUpdates: GuardianUpdate[];
  onOpenGuardianReview: (id: string) => void;
  onDismissGuardianUpdate: (id: string) => void;
  onSnoozeGuardianUpdate: (id: string) => void;
  onMuteGuardianUpdateType: (type: GuardianUpdate['type']) => void;
}

export default function FloatingControls({
  openAdvisor,
  unreadCount,
  experienceMode,
  guardianUpdates = [],
  onOpenGuardianReview,
  onDismissGuardianUpdate,
  onSnoozeGuardianUpdate,
  onMuteGuardianUpdateType,
}: FloatingControlsProps) {
  const showGuardianFab = true;
  // Active (non-dismissed, non-expired) updates stay in the tray for review.
  const activeUpdates = guardianUpdates.filter(
    (u) => !u.dismissed && u.expiresAt.getTime() > Date.now(),
  );
  // Unread updates drive the badge and the alert mood. A read-but-unresolved
  // proposal remains in the tray without looking like a new alert.
  const unreadUpdates = activeUpdates.filter((u) => !u.read);
  const badgeCount = Math.max(unreadCount, unreadUpdates.length);

  const [prevBadge, setPrevBadge] = useState(badgeCount);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (badgeCount > prevBadge) {
      setBounceKey((k) => k + 1);
    }
    setPrevBadge(badgeCount);
  }, [badgeCount, prevBadge]);

  return (
    <>
      <TourTrigger />

      <AnimatePresence>
        <GuidedTour />
      </AnimatePresence>

      <GuardianUpdates
        updates={activeUpdates}
        onOpenReview={(update) => onOpenGuardianReview(update.id)}
        onDismiss={onDismissGuardianUpdate}
        onSnooze={onSnoozeGuardianUpdate}
        onMuteType={onMuteGuardianUpdateType}
      />

      {showGuardianFab && (
      <motion.button
        key={bounceKey}
        onClick={openAdvisor}
        aria-label={`${ASK_GUARDIAN_LABEL} — ask about your protection`}
        title={ASK_GUARDIAN_LABEL}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed bottom-20 right-4 z-40 h-12 pl-2.5 pr-4 rounded-2xl bg-white dark:bg-gray-900 text-blue-950 dark:text-blue-100 shadow-lg shadow-blue-900/20 border border-blue-200 dark:border-blue-800/60 flex items-center gap-2"
      >
        <GuardianMascot
          size={30}
          mood={badgeCount > 0 ? "alert" : "neutral"}
          className="shrink-0"
        />
        <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">{ASK_GUARDIAN_LABEL}</span>
        {badgeCount > 0 && (
          <motion.span
            key={`badge-${bounceKey}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.2, 1], opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </motion.span>
        )}
      </motion.button>
      )}
    </>
  );
}

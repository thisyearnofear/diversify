/**
 * FloatingControls — Guardian FAB, proactive updates, tour triggers.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";

import { useAIConversationOptional } from "@/context/AIConversationContext";

import TourTrigger from "@/components/tour/TourTrigger";
import { GuardianMascot } from "@/components/shared/GuardianMascot";
import GuardianUpdates from "@/components/agent/GuardianUpdates";
import { ASK_GUARDIAN_LABEL } from "@/constants/guardian-copy";
import type { UserExperienceMode } from "@/context/app/types";
import type { GuardianUpdate } from "@/context/AIConversationContext";
import { useGuardianVoice } from '@/context/app/GuardianVoiceContext';
import { GuardianVoiceControls } from '@/components/agent/GuardianVoiceControls';
import { useAgentChatContext } from "@/context/app/AgentChatContext";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { useAgentVoice } from "@/hooks/use-agent-voice";
import { useVault } from "@/hooks/use-vault";
import { useSessionKey } from "@/hooks/use-session-key";
import { useGuardianTierSnapshotFrom } from "@/components/agent/AgentTierStatus";
import { MOOD_BY_STATE } from "@/components/agent/GuardianObject";
import { beatImpulseForKey, GUARDIAN_BEAT_MOOD, subscribeBeats } from "@/lib/beat-impulse";
import { UI_FEATURES } from "@/config/features";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const GuidedTour = dynamic(() => import("@/components/tour/GuidedTour"), {
  ssr: false,
});

export interface FloatingControlsProps {
  onTranscription?: (text: string) => void | Promise<void>;
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
  onTranscription,
  openAdvisor,
  unreadCount,
  experienceMode,
  guardianUpdates = [],
  onOpenGuardianReview,
  onDismissGuardianUpdate,
  onSnoozeGuardianUpdate,
  onMuteGuardianUpdateType,
}: FloatingControlsProps) {
  const voice = useGuardianVoice();
  const { capabilities } = useAgentStatus();
  const { transcribeAudio } = useAgentVoice({ apiBase: API_BASE, capabilities });
  // The mascot carries the real Guardian tier (idle → monitoring), not
  // just the badge — same derivation the Guardian tab's object reads.
  const vault = useVault();
  const { signedPermission, sessionInfo, deriveGuardianState } = useSessionKey();
  const { guardianState } = useGuardianTierSnapshotFrom(vault, {
    signedPermission,
    sessionInfo,
    deriveGuardianState,
  });
  const chatting = useAgentChatContext()?.chatState.isChatting ?? false;
  // Beat posture: a beat landing on any instrument's LiveLine pulses the
  // mascot the same way GuardianObject reacts — once per key, ~2.4s,
  // dead under reduced motion.
  const reducedMotion = useReducedMotion();
  const [beatMood, setBeatMood] = useState<"alert" | "thinking" | null>(null);
  const playedBeats = useRef(new Set<string>());
  useEffect(() => {
    if (reducedMotion) return;
    return subscribeBeats(({ key }) => {
      if (playedBeats.current.has(key)) return;
      const next = GUARDIAN_BEAT_MOOD[beatImpulseForKey(key) ?? "settle"];
      if (!next) return;
      playedBeats.current.add(key);
      setBeatMood(next);
      setTimeout(() => setBeatMood((m) => (m === next ? null : m)), 2400);
    });
  }, [reducedMotion]);
  // The FAB morphs into the desktop docked panel via a shared layoutId —
  // while the drawer is open the pill folds away. Read the context
  // defensively so isolated tests outside the provider still render the FAB.
  const isDrawerOpen = useAIConversationOptional()?.isDrawerOpen ?? false;
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 1024px)");
    if (!mq) return;
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const showVoice = !isDrawerOpen && voice?.active && onTranscription;
  const showGuardianFab = !isDrawerOpen && !showVoice;
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

  // Alert wins; a landed beat outranks the resting state mood; a live
  // chat turn narrows the eyes; otherwise the tier's own mood.
  const mood =
    badgeCount > 0
      ? "alert"
      : (beatMood ?? (chatting ? "thinking" : MOOD_BY_STATE[guardianState]));

  // Tap = talk when voice is actually available — same start path as
  // VoiceButton (one session, one recorder). Otherwise tap just opens
  // the advisor.
  const canTalk = Boolean(
    UI_FEATURES.VOICE_UI && voice && capabilities.voiceInput && onTranscription,
  );
  const handleFabPress = () => {
    openAdvisor();
    if (canTalk && voice && onTranscription) {
      void voice.start(transcribeAudio, (text) => onTranscription(text));
    }
  };

  return (
    <>
      <TourTrigger />
      {showVoice && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 lg:left-auto lg:w-80 z-40">
          <GuardianVoiceControls compact onTranscription={onTranscription!} onOpenChat={openAdvisor} />
        </div>
      )}

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

      <AnimatePresence>
      {showGuardianFab && (
      <motion.button
        key={bounceKey}
        layoutId={isDesktop && !reducedMotion ? "ask-guardian" : undefined}
        onClick={handleFabPress}
        aria-label={canTalk ? "Ask Guardian — tap to speak" : `${ASK_GUARDIAN_LABEL} — ask about your protection`}
        title={ASK_GUARDIAN_LABEL}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={reducedMotion ? undefined : { scale: 1.04 }}
        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
        className="hidden lg:flex fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 pl-2.5 pr-4 rounded-2xl bg-white dark:bg-gray-900 text-blue-950 dark:text-blue-100 shadow-lg shadow-blue-900/20 border border-blue-200 dark:border-blue-800/60 items-center gap-2"
      >
        {/* Inner content fades out fast — the layout morph only reshapes the
            shared container; without this the pill's text stretches into the
            panel mid-flight. (Reduced motion keeps the plain fade above.) */}
        <motion.span
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
          className="flex items-center gap-2"
        >
        <GuardianMascot
          size={30}
          mood={mood}
          className="shrink-0"
        />
        <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">{ASK_GUARDIAN_LABEL}</span>
        {badgeCount > 0 && (
          <motion.span
            key={`badge-${bounceKey}`}
            initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: reducedMotion ? 1 : [0.6, 1.2, 1], opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
            className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm"
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </motion.span>
        )}
        </motion.span>
      </motion.button>
      )}
      </AnimatePresence>
    </>
  );
}

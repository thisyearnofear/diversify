import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAgentStatus } from '../../hooks/use-agent-status';
import { useAgentVoice } from '../../hooks/use-agent-voice';
import { useGuardianVoice } from '../../context/app/GuardianVoiceContext';
import { useAgentChatContext } from '../../context/app/AgentChatContext';
import { springPress } from '@/lib/motion-tokens';

const VOICE_DISABLED_KEY = 'diversifi-voice-disabled';
const VOICE_PREFERENCE_EVENT = 'diversifi:voice-preference';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface VoiceButtonProps {
  onTranscription?: (text: string) => void | Promise<void>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** A control for the app's one voice session, never a second recorder. */
export default function VoiceButton({ onTranscription, className = '', size = 'md' }: VoiceButtonProps) {
  const voice = useGuardianVoice();
  const { capabilities } = useAgentStatus();
  const { transcribeAudio } = useAgentVoice({ apiBase: API_BASE, capabilities });
  const { isEnabled, enable } = useVoiceEnabled();
  const reducedMotion = useReducedMotion();
  const transcriptionHandler = useRef(onTranscription);
  transcriptionHandler.current = onTranscription;
  const listening = voice?.phase === 'listening';
  const pending = voice?.phase === 'requesting_permission' || voice?.phase === 'transcribing';
  const chatBusy = useAgentChatContext()?.chatState.isChatting ?? false;
  const waitingForAnswer = chatBusy && !listening && !pending;
  const available = Boolean(voice && capabilities.voiceInput && onTranscription && !waitingForAnswer);
  const label = waitingForAnswer ? 'Guardian is answering — voice input will be ready shortly'
    : !available ? 'Voice unavailable — type your request'
    : pending ? 'Cancel voice input'
    : listening ? 'Finish speaking'
    : !isEnabled ? 'Enable voice input'
    : 'Speak to Guardian';

  const handlePress = () => {
    if (!voice || !onTranscription) return;
    if (pending) { voice.stop(); return; }
    if (listening) { voice.finish(); return; }
    if (!isEnabled) enable();
    void voice.start(transcribeAudio, text => transcriptionHandler.current?.(text));
  };

  return (
    <motion.button
      type="button"
      onClick={handlePress}
      disabled={!available}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      whileTap={reducedMotion ? undefined : { scale: 0.94 }}
      transition={springPress}
      className={`relative shrink-0 rounded-full inline-flex items-center justify-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        size === 'lg' ? 'size-14' : size === 'sm' ? 'size-tap' : 'size-12'
      } ${
        listening ? 'bg-blue-600 text-white border-blue-500'
          : pending ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
            : 'bg-surface text-ink-muted border-line hover:text-blue-600'
      } ${className}`}
    >
      {listening || pending ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
          {pending ? <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" /> : <rect x="5" y="5" width="14" height="14" rx="3" />}
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6" />
        </svg>
      )}
    </motion.button>
  );
}

/** The preference stays synchronized between Settings and the composer. */
export function useVoiceEnabled() {
  const [isEnabled, setIsEnabled] = useState(true);
  const voice = useGuardianVoice();
  useEffect(() => {
    const read = () => {
      try { setIsEnabled(localStorage.getItem(VOICE_DISABLED_KEY) !== 'true'); } catch { /* session default */ }
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener(VOICE_PREFERENCE_EVENT, read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener(VOICE_PREFERENCE_EVENT, read);
    };
  }, []);
  const enable = useCallback(() => {
    try { localStorage.removeItem(VOICE_DISABLED_KEY); } catch { /* session only */ }
    setIsEnabled(true);
    window.dispatchEvent(new Event(VOICE_PREFERENCE_EVENT));
  }, []);
  const endSession = voice?.endSession;
  const disable = useCallback(() => {
    endSession?.();
    try { localStorage.setItem(VOICE_DISABLED_KEY, 'true'); } catch { /* session only */ }
    setIsEnabled(false);
    window.dispatchEvent(new Event(VOICE_PREFERENCE_EVENT));
  }, [endSession]);
  return { isEnabled, enable, disable };
}

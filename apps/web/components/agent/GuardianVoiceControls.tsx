import React from 'react';
import { useGuardianVoice } from '@/context/app/GuardianVoiceContext';
import { useAgentChatContext } from '@/context/app/AgentChatContext';
import { GuardianMascot } from '../shared/GuardianMascot';
import VoiceButton from '../ui/VoiceButton';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { springSoft } from '@/lib/motion-tokens';

const LABELS = {
  idle: 'Ready when you are',
  requesting_permission: 'Waiting for microphone permission',
  listening: 'Listening · tap to finish',
  transcribing: 'Reading your words',
  preparing_speech: 'Preparing spoken response',
  speaking: 'Guardian is speaking',
  error: 'Try again, or type',
};

/** The same session control appears in the drawer or beside the instrument. */
export function GuardianVoiceControls({
  onTranscription, onOpenChat, compact = false,
}: {
  onTranscription: (text: string) => void | Promise<void>;
  onOpenChat?: () => void;
  compact?: boolean;
}) {
  const voice = useGuardianVoice();
  const reducedMotion = useReducedMotion();
  const inactiveLevel = useMotionValue(0);
  const meter = useSpring(voice?.level ?? inactiveLevel, springSoft);
  const chatBusy = useAgentChatContext()?.chatState.isChatting ?? false;
  if (!voice?.active) return null;
  const busy = chatBusy || ['preparing_speech', 'speaking', 'transcribing', 'requesting_permission'].includes(voice.phase);
  const speech = voice.phase === 'speaking' || voice.phase === 'preparing_speech';
  return (
    <section aria-label="Guardian voice session" className={compact
      ? 'rounded-2xl border border-line bg-surface shadow-lg p-3 text-ink'
      : 'border-t border-line pt-3 text-ink'}>
      <div className="flex items-center gap-2">
        {compact && <GuardianMascot size={32} mood={voice.phase === 'error' ? 'alert' : busy ? 'thinking' : 'neutral'} />}
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-xs font-medium">{chatBusy && voice.phase === 'idle' ? 'Guardian is considering your request' : LABELS[voice.phase]}</p>
        {compact && <VoiceButton size="sm" onTranscription={onTranscription} />}
        {speech && <button type="button" onClick={voice.stop} className="min-h-tap px-2 text-xs font-semibold">Stop</button>}
        <button type="button" onClick={voice.endSession} aria-label="End voice session" className="min-h-tap min-w-tap text-ink-muted hover:text-ink">×</button>
      </div>
      {voice.phase === 'listening' && (
        <div className="h-1 rounded-full bg-blue-100 dark:bg-blue-950 overflow-hidden" aria-hidden="true">
          <motion.div className="h-full origin-left bg-blue-600" style={{ scaleX: reducedMotion ? voice.level : meter }} />
        </div>
      )}
      {compact && voice.transcript && <p className="mt-2 text-xs text-ink-muted"><span className="font-semibold">You said:</span> {voice.transcript}</p>}
      {compact && voice.reply && <p className="mt-2 text-sm leading-relaxed line-clamp-3">{voice.reply}</p>}
      {voice.error && <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{voice.error}</p>}
      <div className="flex items-center gap-3">
        {voice.canReplay && !busy && <button type="button" onClick={voice.replay} className="min-h-tap text-xs font-semibold text-blue-700 dark:text-blue-300">Replay</button>}
        {onOpenChat && <button type="button" onClick={onOpenChat} className="min-h-tap text-xs font-semibold text-blue-700 dark:text-blue-300">Open transcript / type</button>}
      </div>
    </section>
  );
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigationOptional } from './NavigationContext';
import { useBalanceVisibility } from './BalanceVisibilityContext';
import { useMotionValue, type MotionValue } from 'framer-motion';

export type VoicePhase = 'idle' | 'requesting_permission' | 'listening' | 'transcribing' | 'preparing_speech' | 'speaking' | 'error';
type Transcribe = (audio: Blob, signal?: AbortSignal) => Promise<string | null>;
type GenerateSpeech = (text: string, signal?: AbortSignal) => Promise<Blob | null>;
type Capture = {
  stream: MediaStream;
  recorder: MediaRecorder;
  analyserContext?: AudioContext;
  frame?: number;
  limit?: ReturnType<typeof setTimeout>;
};

type VoiceSession = {
  phase: VoicePhase;
  active: boolean;
  transcript: string;
  reply: string;
  error: string | null;
  level: MotionValue<number>;
  canReplay: boolean;
  getEpoch: () => number;
  start: (transcribe: Transcribe, onTranscript: (text: string) => void | Promise<void>) => Promise<void>;
  finish: () => void;
  stop: () => void;
  endSession: () => void;
  speak: (text: string, generate: GenerateSpeech) => Promise<void>;
  replay: () => void;
  reportReply: (text: string, generate?: GenerateSpeech) => void;
};

const GuardianVoiceContext = createContext<VoiceSession | null>(null);

/** One owner for microphone, pending audio requests and playback across tabs. */
export function GuardianVoiceProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhaseState] = useState<VoicePhase>('idle');
  const phaseRef = useRef<VoicePhase>('idle');
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Meter samples update only the meter, not every chat/advisor consumer.
  const level = useMotionValue(0);
  const [canReplay, setCanReplay] = useState(false);
  const epoch = useRef(0);
  const getEpoch = useCallback(() => epoch.current, []);
  const capture = useRef<Capture | null>(null);
  const request = useRef<AbortController | null>(null);
  const playback = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const lastSpeech = useRef<{ text: string; generate: GenerateSpeech } | null>(null);
  const navigation = useNavigationOptional();
  const selected = navigation?.currencyView ?? navigation?.currencyReading;
  const viewKey = `${navigation?.activeTab}:${selected?.currencyCode}:${selected?.benchmark}:${selected?.horizon}`;
  const { hidden: balancesHidden } = useBalanceVisibility();

  const setPhase = useCallback((value: VoicePhase) => {
    phaseRef.current = value;
    setPhaseState(value);
  }, []);

  const releaseCapture = useCallback(() => {
    const current = capture.current;
    capture.current = null;
    if (!current) return;
    current.recorder.onstop = null;
    current.recorder.ondataavailable = null;
    current.recorder.onerror = null;
    if (current.recorder.state !== 'inactive') current.recorder.stop();
    current.stream.getTracks().forEach(track => track.stop());
    if (current.frame !== undefined) cancelAnimationFrame(current.frame);
    if (current.limit) clearTimeout(current.limit);
    void current.analyserContext?.close().catch(() => {});
  }, []);

  const releasePlayback = useCallback(() => {
    const current = playback.current;
    playback.current = null;
    if (!current) return;
    current.audio.onended = null;
    current.audio.onerror = null;
    current.audio.pause();
    current.audio.removeAttribute('src');
    URL.revokeObjectURL(current.url);
  }, []);

  const cleanup = useCallback(() => {
    ++epoch.current; // Suppress late permission grants, fetches and callbacks.
    request.current?.abort();
    request.current = null;
    releaseCapture();
    releasePlayback();
  }, [releaseCapture, releasePlayback]);

  const stop = useCallback(() => {
    cleanup();
    level.set(0);
    setError(null);
    setPhase('idle');
  }, [cleanup, setPhase, level]);

  const endSession = useCallback(() => {
    stop();
    setActive(false);
  }, [stop]);

  useEffect(() => {
    if (balancesHidden) {
      stop();
      lastSpeech.current = null;
      setCanReplay(false);
    }
  }, [balancesHidden, stop]);

  useEffect(() => {
    const onHide = () => { if (document.hidden) endSession(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      cleanup();
    };
  }, [cleanup, endSession]);

  // A turn cannot act on a screen the user left while it was being heard.
  useEffect(() => {
    if (['requesting_permission', 'listening', 'transcribing'].includes(phaseRef.current)) stop();
  }, [viewKey, stop]);

  const finish = useCallback(() => {
    const current = capture.current;
    if (current?.recorder.state === 'recording') {
      setPhase('transcribing');
      current.recorder.stop();
    }
  }, [setPhase]);

  const start = useCallback(async (transcribe: Transcribe, onTranscript: (text: string) => void | Promise<void>) => {
    stop(); // Barge-in also invalidates pending speech generation.
    setActive(true);
    setTranscript('');
    setReply('');
    lastSpeech.current = null;
    setCanReplay(false);
    const turn = epoch.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone recording is unavailable here. You can type the same request.');
      setPhase('error');
      return;
    }
    setPhase('requesting_permission');
    let acquiredStream: MediaStream | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (turn !== epoch.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      acquiredStream = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const current: Capture = { stream, recorder };
      capture.current = current;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (turn !== epoch.current) return;
        stop();
        setError('Recording stopped unexpectedly. Try again or type your request.');
        setPhase('error');
      };
      recorder.onstop = async () => {
        if (turn !== epoch.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'application/octet-stream' });
        releaseCapture();
        level.set(0);
        setPhase('transcribing');
        const controller = new AbortController();
        request.current = controller;
        try {
          const text = blob.size ? await transcribe(blob, controller.signal) : null;
          if (turn !== epoch.current) return;
          if (!text?.trim()) throw new Error('empty_transcript');
          setTranscript(text.trim());
          setPhase('idle');
          await onTranscript(text.trim());
        } catch {
          if (turn !== epoch.current) return;
          setError('I could not complete that voice turn. Try again or type your request.');
          setPhase('error');
        } finally {
          if (request.current === controller) request.current = null;
        }
      };
      // Actual microphone energy, never a simulated listening waveform.
      // Meter support is optional; failure must not prevent recording.
      try {
        const AudioContextClass = window.AudioContext
          ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          current.analyserContext = context;
          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
          const samples = new Uint8Array(analyser.frequencyBinCount);
          let lastPaint = 0;
          const meter = (time: number) => {
            if (capture.current !== current) return;
            if (time - lastPaint >= 100) {
              analyser.getByteTimeDomainData(samples);
              const rms = Math.sqrt(samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length);
              level.set(Math.min(1, rms * 4));
              lastPaint = time;
            }
            current.frame = requestAnimationFrame(meter);
          };
          current.frame = requestAnimationFrame(meter);
        }
      } catch { /* The transcript remains available without a level meter. */ }
      // A duration limit is not a committed turn: a clipped instruction
      // could lose its amount or a qualification. Discard it, never dispatch.
      current.limit = setTimeout(() => {
        if (turn !== epoch.current) return;
        stop();
        setError('That reached the 30-second limit. Try a shorter request, or type it.');
        setPhase('error');
      }, 30_000);
      recorder.start();
      setPhase('listening');
    } catch (cause) {
      if (turn !== epoch.current) return;
      releaseCapture();
      acquiredStream?.getTracks().forEach(track => track.stop());
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow it in browser settings, or type your request.'
        : 'The microphone could not start. Check that it is connected, or type your request.');
      setPhase('error');
    }
  }, [releaseCapture, setPhase, stop, level]);

  const speak = useCallback(async (text: string, generate: GenerateSpeech) => {
    if (['requesting_permission', 'listening', 'transcribing'].includes(phaseRef.current)) return;
    stop();
    setActive(true);
    const turn = epoch.current;
    lastSpeech.current = { text, generate };
    setCanReplay(true);
    setReply(text);
    setPhase('preparing_speech');
    const controller = new AbortController();
    request.current = controller;
    try {
      const blob = await generate(text, controller.signal);
      if (turn !== epoch.current) return;
      if (!blob) throw new Error('speech_unavailable');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      playback.current = { audio, url };
      audio.onended = () => {
        if (turn !== epoch.current) return;
        releasePlayback();
        setPhase('idle');
      };
      audio.onerror = () => {
        if (turn !== epoch.current) return;
        releasePlayback();
        setError('Audio could not play. The response is available as text.');
        setPhase('error');
      };
      setPhase('speaking');
      await audio.play();
    } catch {
      if (turn !== epoch.current) return;
      releasePlayback();
      setError('Speech is unavailable. Read the response or tap Replay to try again.');
      setPhase('error');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [releasePlayback, setPhase, stop]);

  const replay = useCallback(() => {
    if (lastSpeech.current) void speak(lastSpeech.current.text, lastSpeech.current.generate);
  }, [speak]);
  const reportReply = useCallback((text: string, generate?: GenerateSpeech) => {
    setReply(text);
    lastSpeech.current = generate ? { text, generate } : null;
    setCanReplay(Boolean(generate));
  }, []);
  const value = useMemo<VoiceSession>(() => ({
    phase, active, transcript, reply, error, level, canReplay, getEpoch, start, finish, stop, endSession, speak, replay, reportReply,
  }), [phase, active, transcript, reply, error, level, canReplay, getEpoch, start, finish, stop, endSession, speak, replay, reportReply]);
  return <GuardianVoiceContext.Provider value={value}>{children}</GuardianVoiceContext.Provider>;
}

export function useGuardianVoice(): VoiceSession | null {
  return useContext(GuardianVoiceContext);
}

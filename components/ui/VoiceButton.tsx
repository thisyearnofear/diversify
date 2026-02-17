import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiversifiAI } from '../../hooks/use-diversifi-ai';
import { useNetworkActivity } from '../../hooks/use-network-activity';
import { useToast } from './Toast';
import sdk from '@farcaster/miniapp-sdk';

const VOICE_DISABLED_KEY = 'diversifi-voice-disabled';
const VOICE_FIRST_SEEN_KEY = 'diversifi-voice-first-seen';

interface VoiceButtonProps {
    onTranscription?: (text: string) => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    /** Variant styling for different contexts */
    variant?: 'default' | 'header' | 'embedded';
    /** Show/hide the disable option */
    showDisableOption?: boolean;
    /** Show suggestions dropdown */
    showSuggestions?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing';

// Example voice commands to suggest (context-aware)
const VOICE_SUGGESTIONS = [
    { command: "What is DiversiFi?", icon: "❓" },
    { command: "How does this protect my money?", icon: "🛡️" },
    { command: "Is this safe to use?", icon: "🔒" },
    { command: "Show my portfolio", icon: "📊" },
    { command: "Swap $100 to gold", icon: "🥇" },
];

export default function VoiceButton({
    onTranscription,
    className = '',
    size = 'md',
    variant = 'default',
    showDisableOption = true,
    showSuggestions = true,
}: VoiceButtonProps) {
    const { transcribeAudio, capabilities } = useDiversifiAI();
    const { showToast } = useToast();
    const { setOverridePulse } = useNetworkActivity();

    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [isDisabled, setIsDisabled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
    const [isFirstVisit, setIsFirstVisit] = useState(false);
    const [hasBeenSeen, setHasBeenSeen] = useState(false);
    const [volume, setVolume] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Audio context for visualization
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Silence detection parameters
    const SILENCE_THRESHOLD = 0.01;
    const SILENCE_DURATION = 3000; // 3 seconds of silence to auto-stop

    // Load disabled state and first visit from localStorage
    useEffect(() => {
        const disabled = localStorage.getItem(VOICE_DISABLED_KEY) === 'true';
        setIsDisabled(disabled);

        const firstSeen = localStorage.getItem(VOICE_FIRST_SEEN_KEY);
        if (!firstSeen) {
            setIsFirstVisit(true);
        }
    }, []);

    // Mark as seen after animation
    useEffect(() => {
        if (isFirstVisit && !hasBeenSeen) {
            const timer = setTimeout(() => {
                setHasBeenSeen(true);
                localStorage.setItem(VOICE_FIRST_SEEN_KEY, 'true');
            }, 5000); // Show tooltip for 5 seconds
            return () => clearTimeout(timer);
        }
    }, [isFirstVisit, hasBeenSeen]);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
                setShowSuggestionsPanel(false);
            }
        };
        if (showMenu || showSuggestionsPanel) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu, showSuggestionsPanel]);

    // Touch-friendly sizes (min 44px for mobile accessibility)
    const sizeClasses = {
        sm: 'w-11 h-11 text-sm min-w-[44px] min-h-[44px]', // 44px minimum
        md: 'w-12 h-12 text-lg min-w-[48px] min-h-[48px]', // 48px
        lg: 'w-14 h-14 text-xl' // 56px
    };

    const variantClasses = {
        default: {
            idle: 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-2 border-blue-300 shadow-sm',
            recording: 'bg-red-500 text-white shadow-lg shadow-red-500/30 border-2 border-red-600',
            processing: 'bg-amber-500 text-white border-2 border-amber-600'
        },
        header: {
            idle: 'bg-white/10 hover:bg-white/20 text-white border-2 border-white/30',
            recording: 'bg-red-500 text-white shadow-lg shadow-red-500/50 scale-110 border-2 border-red-600',
            processing: 'bg-amber-500 text-white border-2 border-amber-600'
        },
        embedded: {
            idle: 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-2 border-blue-300 shadow-sm',
            recording: 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30 border-2 border-red-600',
            processing: 'bg-amber-500 text-white border-2 border-amber-600'
        }
    };

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        // Release microphone immediately for privacy
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Cleanup audio analysis
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // Clear Ghosting Ticker
        setOverridePulse(null);
        setVolume(0);
    }, [setOverridePulse]);

    const startRecording = async () => {
        if (!capabilities.voiceInput) {
            showToast('Voice features not available', 'error');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Ghosting Ticker State
            setOverridePulse({
                id: 'voice-ghost',
                type: 'voice',
                message: 'Listening for your command...',
                icon: '🎤',
                priority: 'medium'
            });

            // Initialize Audio Context for visualization and silence detection
            interface AudioContextWindow extends Window {
                webkitAudioContext?: typeof AudioContext;
            }
            const AudioContextConstructor = window.AudioContext || (window as unknown as AudioContextWindow).webkitAudioContext;
            if (!AudioContextConstructor) {
                throw new Error('Web Audio API is not supported in this browser');
            }
            const audioContext = new AudioContextConstructor();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVisuals = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength / 255;
                setVolume(average);

                // Silence detection
                if (average < SILENCE_THRESHOLD) {
                    if (!silenceTimerRef.current) {
                        silenceTimerRef.current = setTimeout(() => {
                            stopRecording();
                            showToast('Auto-stopped (silence)', 'info');
                        }, SILENCE_DURATION);
                    }
                } else {
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                }

                animationFrameRef.current = requestAnimationFrame(updateVisuals);
            };
            updateVisuals();

            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4')
                    ? 'audio/mp4'
                    : 'audio/ogg';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setRecordingState('processing');
                setOverridePulse({
                    id: 'voice-ghost',
                    type: 'voice',
                    message: 'Processing analysis...',
                    icon: '🧠',
                    priority: 'medium'
                });

                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    const transcription = await transcribeAudio(audioBlob);
                    if (transcription) {
                        setOverridePulse({
                            id: 'voice-ghost',
                            type: 'voice',
                            message: `Heard: "${transcription}"`,
                            icon: '✅',
                            priority: 'medium'
                        });
                        setTimeout(() => setOverridePulse(null), 2000);
                        onTranscription?.(transcription);
                    } else {
                        showToast('Could not understand audio. Try again?', 'error');
                        setOverridePulse(null);
                    }
                } catch (err) {
                    console.error('[VoiceButton] Stop error:', err);
                    showToast('Failed to process audio', 'error');
                    setOverridePulse(null);
                } finally {
                    setRecordingState('idle');
                }
            };

            mediaRecorder.start();
            setRecordingState('recording');
            showToast('Listening... Tap again to stop', 'info');
        } catch {
            showToast('Microphone access required', 'error');
            setRecordingState('idle');
            setOverridePulse(null);
        }
    };

    const handleToggle = () => {
        if (recordingState === 'processing') return; // Don't interrupt processing

        // Haptic feedback for mobile
        try {
            interface HapticSDK {
                hapticFeedback: (options: { type: 'selection' | 'impact' | 'notification' }) => void;
            }
            (sdk.actions as unknown as HapticSDK).hapticFeedback({ type: 'selection' });
        } catch { /* Ignore haptic errors */ }

        if (recordingState === 'recording') {
            stopRecording();
            showToast('Stopped listening', 'info');
        } else {
            startRecording();
        }
    };

    const handleDisableVoice = () => {
        localStorage.setItem(VOICE_DISABLED_KEY, 'true');
        setIsDisabled(true);
        setShowMenu(false);
        stopRecording();
        showToast('Voice disabled. Re-enable in settings.', 'info');
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (showDisableOption) {
            e.preventDefault();
            setShowMenu(true);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setShowSuggestionsPanel(false);
        onTranscription?.(suggestion);
    };

    // Don't render if user disabled it
    const isVoiceInputAvailable = capabilities.voiceInput;

    if (isDisabled) {
        return null;
    }

    // If voice input is definitely not available, still show button but disable it with tooltip
    if (!isVoiceInputAvailable && recordingState === 'idle') {
        return (
            <div className={`relative ${className}`}>
                <button
                    disabled
                    className={`${sizeClasses[size]} bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-2 border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center cursor-not-allowed opacity-50`}
                    title="Voice features unavailable. Check API keys."
                >
                    🎤
                </button>
            </div>
        );
    }

    const currentVariant = variantClasses[variant];
    const stateClass = currentVariant[recordingState];

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            {/* First Visit Tooltip */}
            <AnimatePresence>
                {isFirstVisit && !hasBeenSeen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-[9999]"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎤</span>
                                <div>
                                    <p className="font-bold text-sm">Ask Me Anything!</p>
                                    <p className="text-xs text-blue-100">Try &quot;What is DiversiFi?&quot;</p>
                                </div>
                            </div>
                            {/* Arrow */}
                            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                ref={buttonRef}
                onClick={handleToggle}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => showSuggestions && recordingState === 'idle' && setShowSuggestionsPanel(true)}
                disabled={recordingState === 'processing'}
                className={`
                    ${sizeClasses[size]} 
                    ${stateClass}
                    rounded-full flex items-center justify-center transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed relative
                `}
                whileTap={{ scale: 0.95 }}
                aria-label={recordingState === 'recording' ? 'Stop listening' : 'Start voice input'}
                title="Tap to speak, tap again to stop. Right-click to disable."
            >
                {/* Visualizer bars when recording */}
                {recordingState === 'recording' && (
                    <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <motion.div
                                key={i}
                                className="w-[3px] bg-white/60 rounded-full"
                                animate={{
                                    height: [
                                        '20%',
                                        `${Math.max(30, volume * 100 * (1 + Math.random()))}%`,
                                        '20%'
                                    ]
                                }}
                                transition={{
                                    duration: 0.2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </div>
                )}

                {recordingState === 'processing' ? (
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        ⏳
                    </motion.span>
                ) : recordingState === 'recording' ? (
                    <span className="relative z-10 text-white font-bold text-[10px]">STOP</span>
                ) : (
                    <motion.span
                        animate={{
                            scale: [1, 1.1, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        🎤
                    </motion.span>
                )}

                {/* Idle pulse ring */}
                {recordingState === 'idle' && (
                    <motion.span
                        className="absolute inset-0 rounded-full border-2 border-blue-400"
                        animate={{
                            scale: [1, 1.3, 1.3],
                            opacity: [0.5, 0, 0],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                    />
                )}

                {/* Recording pulse ring (volume reactive) */}
                {recordingState === 'recording' && (
                    <motion.span
                        className="absolute inset-0 rounded-full border-4 border-red-400/30"
                        animate={{
                            scale: [1, 1 + (volume * 1.5), 1],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{
                            duration: 0.1,
                            repeat: Infinity,
                        }}
                    />
                )}
            </motion.button>

            {/* Recording indicator */}
            <AnimatePresence>
                {recordingState === 'recording' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-1 -right-1"
                    >
                        <span className="flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status label */}
            <AnimatePresence>
                {recordingState !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10"
                    >
                        <div className={`text-white text-xs px-2 py-1 rounded-full font-bold ${recordingState === 'recording' ? 'bg-red-500' : 'bg-amber-500'
                            }`}>
                            {recordingState === 'recording' ? '🔴 Tap to stop' : 'Processing...'}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Suggestions Panel */}
            <AnimatePresence>
                {showSuggestionsPanel && showSuggestions && recordingState === 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[9999] min-w-[220px]"
                        onMouseLeave={() => setShowSuggestionsPanel(false)}
                    >
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Ask me anything...
                            </p>
                        </div>
                        {VOICE_SUGGESTIONS.map(({ command, icon }, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSuggestionClick(command)}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 transition-colors"
                            >
                                <span>{icon}</span>
                                <span className="font-medium">{command}</span>
                            </button>
                        ))}
                        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 mt-1">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                Ask questions or give commands
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Disable menu */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999] min-w-[160px]"
                    >
                        <button
                            onClick={handleDisableVoice}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <span>🚫</span>
                            <span>Disable Voice</span>
                        </button>
                        <button
                            onClick={() => setShowMenu(false)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                        >
                            <span>✕</span>
                            <span>Cancel</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Utility hook to check/toggle voice enabled state */
export function useVoiceEnabled() {
    const [isEnabled, setIsEnabled] = useState(true);

    useEffect(() => {
        const disabled = localStorage.getItem(VOICE_DISABLED_KEY) === 'true';
        setIsEnabled(!disabled);
    }, []);

    const enable = useCallback(() => {
        localStorage.removeItem(VOICE_DISABLED_KEY);
        setIsEnabled(true);
    }, []);

    const disable = useCallback(() => {
        localStorage.setItem(VOICE_DISABLED_KEY, 'true');
        setIsEnabled(false);
    }, []);

    return { isEnabled, enable, disable };
}
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWealthProtectionAgent } from '../../hooks/use-wealth-protection-agent';
import { useToast } from './Toast';

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

// Example voice commands to suggest
const VOICE_SUGGESTIONS = [
    { command: "Swap $100 to gold", icon: "🥇" },
    { command: "Protect my savings", icon: "🛡️" },
    { command: "Analyze my portfolio", icon: "📊" },
    { command: "What's my balance?", icon: "💰" },
    { command: "Show inflation data", icon: "📈" },
];

export default function VoiceButton({
    onTranscription,
    className = '',
    size = 'md',
    variant = 'default',
    showDisableOption = true,
    showSuggestions = true,
}: VoiceButtonProps) {
    const { transcribeAudio, capabilities } = useWealthProtectionAgent();
    const { showToast } = useToast();

    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [isDisabled, setIsDisabled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
    const [isFirstVisit, setIsFirstVisit] = useState(false);
    const [hasBeenSeen, setHasBeenSeen] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

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

    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-lg',
        lg: 'w-14 h-14 text-xl'
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
    }, []);

    const startRecording = async () => {
        if (!capabilities.transcription) {
            showToast('Voice features not available', 'error');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setRecordingState('processing');
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const transcription = await transcribeAudio(audioBlob);
                    if (transcription) {
                        showToast(`Heard: "${transcription}"`, 'ai');
                        onTranscription?.(transcription);
                    }
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
        }
    };

    const handleToggle = () => {
        if (recordingState === 'processing') return; // Don't interrupt processing

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
    // Note: We check capabilities.transcription but also allow if the API might be available
    // The actual availability is verified server-side, but we show the button optimistically
    const isTranscriptionAvailable = capabilities.transcription;
    
    if (isDisabled) {
        return null;
    }
    
    // If transcription is definitely not available, still show button but disable it with tooltip
    if (!isTranscriptionAvailable && recordingState === 'idle') {
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
                        className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-xl shadow-xl whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🎤</span>
                                <div>
                                    <p className="font-bold text-sm">Try Voice Commands!</p>
                                    <p className="text-xs text-blue-100">Tap and say "Swap $100 to gold"</p>
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
                {recordingState === 'processing' ? (
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        ⏳
                    </motion.span>
                ) : recordingState === 'recording' ? (
                    <span>⏹️</span>
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
                        className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-20 min-w-[220px]"
                        onMouseLeave={() => setShowSuggestionsPanel(false)}
                    >
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Try saying...
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
                                Or tap 🎤 and speak naturally
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
                        className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[160px]"
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

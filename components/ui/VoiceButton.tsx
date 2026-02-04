import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWealthProtectionAgent } from '../../hooks/use-wealth-protection-agent';
import { useToast } from './Toast';

const VOICE_DISABLED_KEY = 'diversifi-voice-disabled';

interface VoiceButtonProps {
    onTranscription?: (text: string) => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    /** Variant styling for different contexts */
    variant?: 'default' | 'header' | 'embedded';
    /** Show/hide the disable option */
    showDisableOption?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export default function VoiceButton({
    onTranscription,
    className = '',
    size = 'md',
    variant = 'default',
    showDisableOption = true
}: VoiceButtonProps) {
    const { transcribeAudio, capabilities } = useWealthProtectionAgent();
    const { showToast } = useToast();

    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [isDisabled, setIsDisabled] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Load disabled state from localStorage
    useEffect(() => {
        const disabled = localStorage.getItem(VOICE_DISABLED_KEY) === 'true';
        setIsDisabled(disabled);
    }, []);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu]);

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
            idle: 'bg-white/10 hover:bg-white/20 text-white',
            recording: 'bg-red-500 text-white shadow-lg shadow-red-500/50 scale-110',
            processing: 'bg-amber-500 text-white'
        },
        embedded: {
            idle: 'bg-gray-100 hover:bg-gray-200 text-gray-600',
            recording: 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30',
            processing: 'bg-amber-500 text-white'
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

    // Don't render if voice not available or user disabled it
    if (!capabilities.transcription || isDisabled) {
        return null;
    }

    const currentVariant = variantClasses[variant];
    const stateClass = currentVariant[recordingState];

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            <motion.button
                onClick={handleToggle}
                onContextMenu={handleContextMenu}
                disabled={recordingState === 'processing'}
                className={`
                    ${sizeClasses[size]} 
                    ${stateClass}
                    rounded-full flex items-center justify-center transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
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
                    <span>🎤</span>
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

            {/* Disable menu */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 min-w-[160px]"
                    >
                        <button
                            onClick={handleDisableVoice}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <span>🚫</span>
                            <span>Disable Voice</span>
                        </button>
                        <button
                            onClick={() => setShowMenu(false)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
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

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWealthProtectionAgent } from '../../hooks/use-wealth-protection-agent';
import { useToast } from './Toast';

interface VoiceButtonProps {
    onTranscription?: (text: string) => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function VoiceButton({
    onTranscription,
    className = '',
    size = 'md'
}: VoiceButtonProps) {
    const { transcribeAudio, capabilities } = useWealthProtectionAgent();
    const { showToast } = useToast();
    const [isListening, setIsListening] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-lg',
        lg: 'w-12 h-12 text-xl'
    };

    const startRecording = async () => {
        if (!capabilities.transcription) {
            showToast('Voice features not available', 'error');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const transcription = await transcribeAudio(audioBlob);
                if (transcription) {
                    onTranscription?.(transcription);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsListening(true);
        } catch (error) {
            showToast('Microphone access required', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
    };

    if (!capabilities.transcription) {
        return null;
    }

    return (
        <div className={`relative ${className}`}>
            <motion.button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`
          ${sizeClasses[size]} 
          ${isListening
                        ? 'bg-red-500 text-white scale-110'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }
          rounded-full flex items-center justify-center transition-all duration-200
        `}
                whileTap={{ scale: 0.95 }}
                aria-label="Voice input"
            >
                <span>{isListening ? '🎙️' : '🎤'}</span>
            </motion.button>

            <AnimatePresence>
                {isListening && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
                    >
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                            Listening...
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
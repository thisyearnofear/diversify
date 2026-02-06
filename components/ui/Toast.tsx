import React, { useState, useEffect, createContext, useCallback, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkActivity } from '../../hooks/use-network-activity';

interface ToastData {
    cost?: number;
    sources?: number;
    [key: string]: unknown;
}

export const Toast: React.FC<{
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning' | 'ai';
    onClose: () => void;
    duration?: number;
    data?: ToastData;
}> = ({ message, type = 'info', onClose, duration = 3000, data }) => {

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const typeStyles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        ai: 'bg-purple-50 border-purple-200 text-purple-800'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-6 right-6 z-50 p-4 rounded-lg shadow-lg border ${typeStyles[type]} max-w-sm`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {type === 'success' && (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    )}
                    {type === 'error' && (
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    )}
                    {type === 'info' && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    )}
                    {type === 'ai' && <span className="text-lg">🧠</span>}
                    <div>
                        <span className="text-sm font-medium">{message}</span>
                        {type === 'ai' && data?.cost && (
                            <div className="text-xs text-purple-600 mt-1">
                                Cost: ${data.cost} USDC • Sources: {data.sources || 0}
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </motion.div>
    );
};

export const ToastContext = createContext<{
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning' | 'ai', data?: ToastData) => void
}>({
    showToast: () => { }
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<{
        id: number;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning' | 'ai';
        data?: ToastData;
    }[]>([]);

    const { getRandomNudge } = useNetworkActivity();

    const showToast = useCallback((
        message: string,
        type: 'success' | 'error' | 'info' | 'warning' | 'ai' = 'info',
        data?: ToastData
    ) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, data }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Periodic Behavioral Nudge
    useEffect(() => {
        const interval = setInterval(() => {
            // Randomly show a nudge every few minutes if no active toasts
            if (document.visibilityState === 'visible' && Math.random() > 0.5) {
                setToasts(prev => {
                    if (prev.length > 0) return prev;
                    const nudge = getRandomNudge();
                    return [{ id: Date.now(), message: nudge.message, type: 'info' }];
                });
            }
        }, 180000); // 3 minutes

        return () => clearInterval(interval);
    }, [getRandomNudge]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <AnimatePresence>
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        data={toast.data}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </AnimatePresence>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext);
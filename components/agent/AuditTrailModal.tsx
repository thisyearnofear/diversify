import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuditEntry {
    id: string;
    timestamp: number;
    action: string;
    cid: string;
    provider: string;
    status: 'verified' | 'pending';
}

interface AuditTrailModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuditTrailModal({ isOpen, onClose }: AuditTrailModalProps) {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            // Simulate fetching from 0G persistence
            setTimeout(() => {
                setEntries([
                    {
                        id: '1',
                        timestamp: Date.now() - 1000 * 60 * 5,
                        action: 'Market Intelligence Synthesis',
                        cid: '0x7d...f3a2',
                        provider: 'Gemini 1.5 Flash',
                        status: 'verified'
                    },
                    {
                        id: '2',
                        timestamp: Date.now() - 1000 * 60 * 15,
                        action: 'Portfolio Risk Assessment',
                        cid: '0x2a...b9c1',
                        provider: 'Venice AI',
                        status: 'verified'
                    },
                    {
                        id: '3',
                        timestamp: Date.now() - 1000 * 60 * 30,
                        action: 'Proof of Efficacy Backtest',
                        cid: '0x9e...d4e5',
                        provider: 'ArcAgent Simulator',
                        status: 'verified'
                    }
                ]);
                setLoading(false);
            }, 800);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6">
                            <h2 className="text-white font-black text-xl flex items-center gap-2">
                                🛡️ 0G Audit Trail
                            </h2>
                            <p className="text-blue-100 text-xs mt-1">
                                Verifiable evidence anchored to 0G Storage
                            </p>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-20 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl" />
                                    ))}
                                </div>
                            ) : (
                                entries.map((entry) => (
                                    <div key={entry.id} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                {entry.action}
                                            </h3>
                                            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                                {entry.status}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">DA Anchor (CID)</div>
                                                <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate">
                                                    {entry.cid}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Provider</div>
                                                <div className="text-[10px] text-gray-700 dark:text-gray-300 font-bold">
                                                    {entry.provider}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-2 text-[8px] text-gray-400">
                                            {new Date(entry.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-lg"
                            >
                                Close Audit
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

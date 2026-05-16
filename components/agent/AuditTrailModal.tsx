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
                        className="relative w-full max-w-md bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden border border-white/20 dark:border-white/5"
                    >
                        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                            
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-white font-black text-2xl tracking-tighter flex items-center gap-2">
                                        🛡️ 0G Audit Trail
                                    </h2>
                                    <span className="flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                </div>
                                <p className="text-blue-100/80 text-xs font-medium max-w-[280px]">
                                    Immutable evidence bundles anchored to the 0G Data Availability layer for verifiable intelligence.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-4 custom-scrollbar">
                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 animate-pulse bg-gray-100 dark:bg-white/5 rounded-3xl" />
                                    ))}
                                </div>
                            ) : (
                                entries.map((entry) => (
                                    <motion.div 
                                        key={entry.id} 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-gray-50 dark:bg-white/5 p-5 rounded-[2rem] border border-gray-100 dark:border-white/10 hover:border-blue-400/30 transition-colors group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] text-blue-500 dark:text-blue-400 font-black uppercase tracking-widest">
                                                    Action Verified
                                                </div>
                                                <h3 className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                                                    {entry.action}
                                                </h3>
                                            </div>
                                            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-tighter">
                                                {entry.status}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200/50 dark:border-white/5">
                                            <div>
                                                <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Storage Anchor (CID)</div>
                                                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded-md truncate">
                                                    {entry.cid}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">AI Agent</div>
                                                <div className="text-[10px] text-gray-700 dark:text-gray-300 font-black">
                                                    {entry.provider}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3 flex items-center justify-between text-[8px] text-gray-400 dark:text-gray-600 font-bold uppercase">
                                            <span>Timestamp: {new Date(entry.timestamp).toLocaleTimeString()}</span>
                                            <span className="group-hover:text-blue-500 transition-colors cursor-pointer">View JSON ↗</span>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        <div className="p-8 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black rounded-3xl shadow-[0_12px_24px_rgba(0,0,0,0.1)] hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Close Audit Trail
                            </button>
                            <p className="text-center text-[8px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-widest mt-4">
                                Data Powered by 0G Foundation & Google Cloud
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

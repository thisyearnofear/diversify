import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IntelligenceItem } from '../../types/intelligence';

export function GuardianPulse() {
    const [data, setData] = useState<{ pulse: any; insights: IntelligenceItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPulse = async () => {
            try {
                const res = await fetch('/api/agent/intelligence');
                if (!res.ok) throw new Error('Failed to fetch intelligence');
                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPulse();
        const interval = setInterval(fetchPulse, 300000); // 5 mins
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl" />;
    if (error || !data) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Guardian Pulse
                </h3>
                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                    <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">Verifiable AI</span>
                    <span className="text-[10px]">🛡️</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Sentiment</div>
                    <div className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        {Math.round(data.pulse.sentiment)}
                        <span className="text-[10px] font-medium text-gray-500">/ 100</span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">War Risk</div>
                    <div className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        {Math.round(data.pulse.warRisk)}%
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <AnimatePresence>
                    {data.insights.map((insight, idx) => (
                        <motion.div
                            key={insight.id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3 rounded-xl border ${
                                insight.type === 'alert' 
                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' 
                                    : insight.type === 'impact'
                                        ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs">{insight.type === 'alert' ? '🚨' : insight.type === 'impact' ? '✨' : '📰'}</span>
                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {insight.title}
                                </h4>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                {insight.description}
                            </p>
                            {insight.impactAsset && (
                                <div className="mt-2 flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Target:</span>
                                    <span className="bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded-md text-[10px] font-black text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-gray-800">
                                        {insight.impactAsset}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            
            <div className="text-center">
                <p className="text-[10px] text-gray-400 italic">
                    All insights are anchored to 0G DA layer for auditability.
                </p>
            </div>
        </div>
    );
}

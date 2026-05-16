import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IntelligenceItem } from '../../types/intelligence';
import { AuditTrailModal } from './AuditTrailModal';
import { RiskHeatMap } from './RiskHeatMap';

export function GuardianPulse() {
    const [data, setData] = useState<{ pulse: any; insights: IntelligenceItem[]; regionalRisk?: any } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuditOpen, setIsAuditOpen] = useState(false);

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
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h3 className="text-[10px] font-black uppercase text-blue-500 dark:text-blue-400 tracking-widest flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Guardian Pulse
                    </h3>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                        Autonomous Market Synthesis
                    </p>
                </div>
                <button 
                    onClick={() => setIsAuditOpen(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_16px_rgba(37,99,235,0.4)] transition-all cursor-pointer active:scale-95 border border-white/10"
                >
                    <span className="text-[9px] font-black text-white uppercase tracking-tighter">Verifiable AI</span>
                    <span className="text-xs">🛡️</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-inner">
                    <div className="text-[9px] text-gray-400 font-bold uppercase mb-1 tracking-tighter">Market Sentiment</div>
                    <div className="text-xl font-black text-gray-900 dark:text-white flex items-baseline gap-1">
                        {Math.round(data.pulse.sentiment)}
                        <span className="text-[9px] font-bold text-gray-400">/100</span>
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-inner">
                    <div className="text-[9px] text-gray-400 font-bold uppercase mb-1 tracking-tighter">War Risk Index</div>
                    <div className="text-xl font-black text-red-600 dark:text-red-400 flex items-baseline gap-1">
                        {Math.round(data.pulse.warRisk)}
                        <span className="text-[9px] font-bold opacity-60">%</span>
                    </div>
                </div>
            </div>

            {data.regionalRisk && (
                <RiskHeatMap riskData={data.regionalRisk} />
            )}

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

            <AuditTrailModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
        </div>
    );
}

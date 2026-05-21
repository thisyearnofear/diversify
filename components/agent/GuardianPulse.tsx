import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, useTransform } from 'framer-motion';
import type { IntelligenceItem } from '../../types/intelligence';
import { VerifiableAIDashboard } from './VerifiableAIDashboard';
import { RiskHeatMap } from './RiskHeatMap';

export function GuardianPulse() {
    const [data, setData] = useState<{ pulse: any; insights: IntelligenceItem[]; regionalRisk?: any } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const reducedMotion = useReducedMotion();

    // Create animated values for pulse effect
    const pulseScale = useTransform(
        // This will create a continuous pulsing animation
        { 
          type: "animation", 
          definition: { 
            scale: [1, 1.05, 1], 
            transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } 
          } 
        },
        (scale) => scale
    );

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

    // Enhanced loading state with animated skeleton
    if (loading) {
        return (
            <motion.div
                className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl relative overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[skeleton-loading_1.5s_ease_in_out_infinite] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse dark:bg-gray-600"></div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Guardian Pulse</h3>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Autonomous Market Synthesis</p>
                </div>
            </motion.div>
        );
    }
    
    if (error || !data) return null;

    // Calculate animated values for metrics
    const sentimentPulse = useTransform(
        { type: "animation", definition: { scale: [1, 1.03, 1], transition: { duration: 3, repeat: Infinity } } },
        (scale) => scale
    );
    
    const warRiskPulse = useTransform(
        { type: "animation", definition: { scale: [1, 1.03, 1], transition: { duration: 3.5, repeat: Infinity, delay: 500 } } },
        (scale) => scale
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
        >
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <motion.h3
                        className="text-[10px] font-black uppercase text-blue-500 dark:text-blue-400 tracking-widest flex items-center gap-2"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <span className="relative flex h-2 w-2">
                            <motion.span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500">
                                {/* Add subtle pulse to the inner circle */}
                                <motion.span
                                    className="absolute inset-0 rounded-full bg-blue-500/20"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: [0, 0.8, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                />
                            </span>
                        </span>
                        Guardian Pulse
                    </motion.h3>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                        Autonomous Market Synthesis
                    </p>
                </div>
                <button 
                    onClick={() => setIsAuditOpen(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_16px_rgba(37,99,235,0.4)] transition-all cursor-pointer active:scale-95 border border-white/10"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <motion.span
                        className="text-[9px] font-black text-white uppercase tracking-tighter"
                        initial={{ x: 0 }}
                        animate={{ x: [0, 2, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        Verifiable AI
                    </motion.span>
                    <motion.span
                        className="text-xs"
                        initial={{ rotate: 0 }}
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        🛡️
                    </motion.span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Market Sentiment with enhanced animation */}
                <motion.div
                    className="bg-gray-50 dark:bg-white/5 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-inner"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ 
                        scale: [1, 1.02, 1], 
                        transition: { type: "spring", stiffness: 300, damping: 20 } 
                    }}
                >
                    <div className="text-[9px] text-gray-400 font-bold uppercase mb-1 tracking-tighter">
                        Market Sentiment
                    </div>
                    <div className="flex items-baseline gap-1">
                        <motion.span
                            className="text-xl font-black text-gray-900 dark:text-white"
                            style={{ transform: sentimentPulse }}
                        >
                            {Math.round(data.pulse.sentiment)}
                        </motion.span>
                        <span className="text-[9px] font-bold text-gray-400">/100</span>
                    </div>
                    {/* Add subtle background pulse */}
                    <div className="absolute inset-0 rounded-[1.5rem] -mx-4 -my-4 bg-blue-500/10"
                        style={{ 
                            transform: sentimentPulse, 
                            opacity: 0.3 
                        }}
                    />
                </motion.div>
                
                {/* War Risk Index with enhanced animation */}
                <motion.div
                    className="bg-gray-50 dark:bg-white/5 p-4 rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-inner"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ 
                        scale: [1, 1.02, 1], 
                        transition: { type: "spring", stiffness: 300, damping: 20 } 
                    }}
                >
                    <div className="text-[9px] text-gray-400 font-bold uppercase mb-1 tracking-tighter">
                        War Risk Index
                    </div>
                    <div className="flex items-baseline gap-1">
                        <motion.span
                            className={`text-xl font-black ${data.pulse.warRisk > 70 ? 'text-red-600 dark:text-red-400' : data.pulse.warRisk > 40 ? 'text-orange-500 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}
                            style={{ transform: warRiskPulse }}
                        >
                            {Math.round(data.pulse.warRisk)}
                        </motion.span>
                        <span className="text-[9px] font-bold opacity-60">%</span>
                    </div>
                    {/* Add subtle background pulse based on risk level */}
                    <div className="absolute inset-0 rounded-[1.5rem] -mx-4 -my-4"
                        style={{ 
                            backgroundColor: data.pulse.warRisk > 70 ? 'red-500/10' : data.pulse.warRisk > 40 ? 'orange-500/10' : 'green-500/10',
                            transform: warRiskPulse,
                            opacity: 0.2 
                        }}
                    />
                </motion.div>
            </div>

            {data.regionalRisk && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <RiskHeatMap riskData={data.regionalRisk} />
                </motion.div>
            )}

            <div className="space-y-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                        delay: 0.4,
                        staggerChildren: 0.07 
                    }}
                >
                    <AnimatePresence>
                        {data.insights.map((insight, idx) => (
                            <motion.div
                                key={insight.id || idx}
                                initial={{ opacity: 0, x: -20, rotate: -5 }}
                                animate={{ opacity: 1, x: 0, rotate: 0 }}
                                exit={{ opacity: 0, x: 20, rotate: 5 }}
                                transition={{ duration: 0.3 }}
                                className={`p-3 rounded-xl border ${
                                    insight.type === 'alert' 
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' 
                                        : insight.type === 'impact'
                                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <motion.span
                                        className="text-xs"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        {insight.type === 'alert' ? '🚨' : insight.type === 'impact' ? '✨' : '📰'}
                                    </motion.span>
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
                                        <motion.span
                                            className="bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded-md text-[10px] font-black text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-gray-800"
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        >
                                            {insight.impactAsset}
                                        </motion.span>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>
            
            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <p className="text-[10px] text-gray-400 italic">
                    All insights are anchored to 0G DA layer for auditability.
                </p>
            </motion.div>

            <VerifiableAIDashboard isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
        </motion.div>
    );
}

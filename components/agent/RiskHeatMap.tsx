import React from 'react';
import { motion } from 'framer-motion';

interface RiskHeatMapProps {
    riskData: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
}

export function RiskHeatMap({ riskData }: RiskHeatMapProps) {
    const regions = [
        { id: 'Africa', label: 'Africa', icon: '🌍' },
        { id: 'LatAm', label: 'LatAm', icon: '🌋' },
        { id: 'Asia', label: 'Asia', icon: '⛩️' },
        { id: 'Europe', label: 'Europe', icon: '🏰' },
        { id: 'USA', label: 'USA', icon: '🗽' },
    ];

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'critical': return 'bg-red-600/90 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)]';
            case 'high': return 'bg-orange-500/90 text-white border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.3)]';
            case 'medium': return 'bg-amber-400/90 text-gray-900 border-amber-200';
            case 'low': return 'bg-emerald-500/90 text-white border-emerald-300';
            default: return 'bg-gray-200 text-gray-500 border-gray-100';
        }
    };

    return (
        <div className="space-y-4 relative overflow-hidden group">
            {/* Scanning Line Effect */}
            <motion.div 
                animate={{ 
                    top: ['-10%', '110%'],
                    opacity: [0, 1, 0]
                }}
                transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    ease: "linear" 
                }}
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent z-20 pointer-events-none"
            />

            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                        Global Risk Heatmap
                    </h4>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
                        Live Cross-Regional Volatility Index
                    </p>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-full px-2">
                    {['low', 'mid', 'high', 'crit'].map((l, i) => (
                        <div key={l} className={`w-1.5 h-1.5 rounded-full ${
                            i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-amber-400' : i === 2 ? 'bg-orange-500' : 'bg-red-600'
                        }`} />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
                {regions.map((region, idx) => {
                    const risk = riskData[region.id] || 'low';
                    const isCritical = risk === 'critical';
                    
                    return (
                        <motion.div
                            key={region.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -4, scale: 1.05 }}
                            className={`relative p-2 rounded-2xl border-b-4 text-center transition-all cursor-default ${getRiskColor(risk)}`}
                        >
                            {isCritical && (
                                <motion.div 
                                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-red-400 rounded-2xl blur-md -z-10"
                                />
                            )}
                            <div className="text-xl mb-1 filter drop-shadow-md">{region.icon}</div>
                            <div className="text-[9px] font-black uppercase truncate tracking-tight">{region.label}</div>
                            <div className="text-[7px] font-black opacity-80 uppercase leading-none mt-0.5">{risk}</div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

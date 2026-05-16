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
            case 'critical': return 'bg-red-600 text-white border-red-400';
            case 'high': return 'bg-orange-500 text-white border-orange-300';
            case 'medium': return 'bg-amber-400 text-gray-900 border-amber-200';
            case 'low': return 'bg-emerald-500 text-white border-emerald-300';
            default: return 'bg-gray-200 text-gray-500 border-gray-100';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    Global Risk Heatmap
                </h4>
                <div className="flex gap-1">
                    {['low', 'mid', 'high', 'crit'].map((l, i) => (
                        <div key={l} className={`w-2 h-2 rounded-full ${
                            i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-amber-400' : i === 2 ? 'bg-orange-500' : 'bg-red-600'
                        }`} />
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {regions.map((region) => {
                    const risk = riskData[region.id] || 'low';
                    return (
                        <motion.div
                            key={region.id}
                            whileHover={{ y: -2 }}
                            className={`flex-1 min-w-[70px] p-2 rounded-xl border-b-2 text-center transition-all ${getRiskColor(risk)}`}
                        >
                            <div className="text-lg mb-1">{region.icon}</div>
                            <div className="text-[10px] font-black uppercase truncate">{region.label}</div>
                            <div className="text-[8px] font-bold opacity-80 uppercase">{risk}</div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

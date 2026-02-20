import React from 'react';
import { motion } from 'framer-motion';

interface OptimizationInsightProps {
  icon: string;
  title: string;
  description: string;
  impact: string;
  fromToken: string;
  toToken: string;
  fromInflation: number;
  toInflation: number;
  action: {
    label: string;
    onClick: () => void;
  };
  variant?: 'urgent' | 'default';
  secondaryOptions?: Array<{
    fromToken: string;
    toToken: string;
    annualSavings: number;
    onClick: () => void;
  }>;
}

const OptimizationInsight: React.FC<OptimizationInsightProps> = ({
  icon,
  title,
  description,
  impact,
  fromToken,
  toToken,
  fromInflation,
  toInflation,
  action,
  variant = 'default',
  secondaryOptions = [],
}) => {
  const isUrgent = variant === 'urgent';
  
  return (
    <div className={`rounded-3xl overflow-hidden border transition-all duration-500 shadow-xl ${
      isUrgent 
        ? 'border-orange-200 bg-white dark:bg-gray-800 dark:border-orange-900/30 shadow-orange-500/5' 
        : 'border-blue-100 bg-white dark:bg-gray-800 dark:border-blue-900/30 shadow-blue-500/5'
    }`}>
      {/* Header with Icon and Title */}
      <div className={`p-5 flex items-start gap-4 ${
        isUrgent ? 'bg-orange-50/50 dark:bg-orange-500/5' : 'bg-blue-50/50 dark:bg-blue-500/5'
      }`}>
        <motion.div 
          className={`size-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm border ${
            isUrgent ? 'bg-white border-orange-100 dark:bg-gray-700 dark:border-orange-800' : 'bg-white border-blue-100 dark:bg-gray-700 dark:border-blue-800'
          }`}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          {icon}
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
              {title}
            </h4>
            {isUrgent && (
              <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Visual Comparison Section */}
      <div className="p-5">
        <div className="relative flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 overflow-hidden group">
          {/* Animated background pulse */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* From Token */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="size-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center font-bold text-xs shadow-sm border border-gray-100 dark:border-gray-700">
              {fromToken}
            </div>
            <span className="text-[10px] font-black text-red-500">{fromInflation.toFixed(1)}% Inflation</span>
          </div>

          {/* Arrow / Connector */}
          <div className="flex-1 flex flex-col items-center gap-1 z-10">
             <div className="w-full flex items-center">
                <div className="flex-1 h-0.5 bg-gradient-to-r from-red-200 to-emerald-200 dark:from-red-900/30 dark:to-emerald-900/30" />
                <motion.div 
                  className="mx-2 text-gray-400"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </motion.div>
                <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-200 to-emerald-400 dark:from-emerald-900/30 dark:to-emerald-900" />
             </div>
             <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                {impact}
             </span>
          </div>

          {/* To Token */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-blue-500/20">
              {toToken}
            </div>
            <span className="text-[10px] font-black text-emerald-500">{toInflation.toFixed(1)}% Inflation</span>
          </div>
        </div>

        {/* Main CTA */}
        <motion.button
          onClick={action.onClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
        >
          {action.label}
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </motion.button>

        {/* Secondary Options */}
        {secondaryOptions.length > 0 && (
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
              Alternative Opportunities
            </p>
            <div className="space-y-2">
              {secondaryOptions.map((opt, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group cursor-pointer"
                  onClick={opt.onClick}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-500">{opt.fromToken}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{opt.toToken}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">+${opt.annualSavings.toFixed(2)}</span>
                    <div className="size-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizationInsight;
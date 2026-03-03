/**
 * AgentTierStatus - The unified Smart Command Center
 * 
 * Core Principles:
 * - CLEAN: Explicit separation of Oracle, Assistant, and Guardian tiers.
 * - ORGANIZED: Domain-driven design for status and action.
 * - PERFORMANT: Only re-renders when agent status changes.
 * - MULTI-ENV: Responsive for Web, MiniPay, and Farcaster.
 */

import React from 'react';
import { useDiversifiAI } from '../../hooks/use-diversifi-ai';
import { useExperience } from '../../context/app/ExperienceContext';
import { motion, AnimatePresence } from 'framer-motion';

export const AgentTierStatus: React.FC<{
  isMiniPay?: boolean;
  isFarcaster?: boolean;
}> = ({ isMiniPay, isFarcaster }) => {
  const { capabilities, autonomousStatus, isAnalyzing, thinkingStep } = useDiversifiAI();
  const { experienceMode } = useExperience();

  const isBeginner = experienceMode === 'beginner';

  // Tier 1: The Oracle (Reasoning)
  const oracleStatus = capabilities.analysis ? 'Online' : 'Unavailable';
  
  // Tier 2: The Assistant (Intents)
  const assistantStatus = capabilities.voiceInput ? 'Listening' : 'Ready';
  
  // Tier 3: The Guardian (Autonomous)
  const guardianActive = autonomousStatus?.enabled;
  const guardianStatus = guardianActive ? 'Protecting' : 'Advisory';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 ${isMiniPay ? 'px-1' : ''}`}>
      {/* Tier 1: The Oracle */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-xl">
            <span className="text-xl">🔮</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${oracleStatus === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {oracleStatus}
          </span>
        </div>
        <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight relative z-10">
          The Oracle
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 relative z-10">
          {isBeginner ? "Explains the market to you." : "High-fidelity macro reasoning engine."}
        </p>
        {isAnalyzing && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 bg-blue-50/80 dark:bg-blue-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            >
                <div className="text-center">
                    <div className="size-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                    <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 truncate max-w-[120px]">
                        {thinkingStep || "Thinking..."}
                    </p>
                </div>
            </motion.div>
        )}
      </motion.div>

      {/* Tier 2: The Assistant */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-green-100 dark:border-green-900 shadow-sm"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-xl">
            <span className="text-xl">🎙️</span>
          </div>
          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
            {assistantStatus}
          </span>
        </div>
        <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
          The Assistant
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {isBeginner ? "Helps you move money fast." : "Intent-based SocialConnect execution."}
        </p>
      </motion.div>

      {/* Tier 3: The Guardian */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900 shadow-sm relative"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-xl">
            <span className="text-xl">🛡️</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${guardianActive ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
            {guardianStatus}
          </span>
        </div>
        <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
          The Guardian
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {isBeginner ? "Keeps your savings safe." : "Autonomous rebalancing & Nanopayments."}
        </p>
        {guardianActive && (
            <div className="absolute top-2 right-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
            </div>
        )}
      </motion.div>
    </div>
  );
};

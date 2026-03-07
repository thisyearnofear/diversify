/**
 * AgentTierStatus - The unified Smart Command Center
 * 
 * Core Principles:
 * - CLEAN: Explicit separation of Oracle, Assistant, and Guardian tiers.
 * - ORGANIZED: Domain-driven design for status and action.
 * - PERFORMANT: Only re-renders when agent status changes.
 * - MULTI-ENV: Responsive for Web, MiniPay, and Farcaster.
 * - ENHANCEMENT FIRST: Enhanced with activity feed and performance metrics inline.
 */

import React, { useState, useMemo } from 'react';
import { useDiversifiAI } from '../../hooks/use-diversifi-ai';
import { useExperience } from '../../context/app/ExperienceContext';
import { motion, AnimatePresence } from 'framer-motion';

export const AgentTierStatus: React.FC<{
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  showActivityFeed?: boolean;
}> = ({ isMiniPay, isFarcaster, showActivityFeed = false }) => {
  const { capabilities, autonomousStatus, isAnalyzing, thinkingStep, activities } = useDiversifiAI();
  const { experienceMode } = useExperience();
  const [expandedTier, setExpandedTier] = useState<'oracle' | 'assistant' | 'guardian' | null>(null);

  const isBeginner = experienceMode === 'beginner';

  // Tier 1: The Oracle (Reasoning)
  const oracleStatus = capabilities.analysis ? 'Online' : 'Unavailable';
  
  // Tier 2: The Assistant (Intents)
  const assistantStatus = capabilities.voiceInput ? 'Listening' : 'Ready';
  
  // Tier 3: The Guardian (Autonomous)
  const guardianActive = autonomousStatus?.enabled;
  const guardianStatus = guardianActive ? 'Protecting' : 'Advisory';

  // Calculate performance metrics
  const metrics = useMemo(() => {
    const totalSavings = activities
      .filter(a => a.status === 'success' && a.details?.savings)
      .reduce((sum, a) => sum + (a.details?.savings || 0), 0);
    
    const totalActions = activities.filter(a => a.type === 'execution').length;
    const successfulActions = activities.filter(a => a.type === 'execution' && a.status === 'success').length;
    const successRate = totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;
    
    const totalCost = activities
      .filter(a => a.type === 'payment' && a.details?.cost)
      .reduce((sum, a) => sum + (a.details?.cost || 0), 0);

    return { totalSavings, totalActions, successRate, totalCost };
  }, [activities]);

  // Filter activities by tier
  const getActivitiesForTier = (tier: 'ORACLE' | 'ASSISTANT' | 'GUARDIAN') => {
    return activities.filter(a => a.tier === tier).slice(0, 5);
  };

  return (
    <div className="space-y-4">
      {/* Performance Summary (only when showActivityFeed is true) */}
      {showActivityFeed && metrics.totalActions > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
          <h3 className="text-xs font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-3">
            Agent Performance
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-2xl font-black text-green-600 dark:text-green-400">
                ${metrics.totalSavings.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Total Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {metrics.totalActions}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Actions Executed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {metrics.successRate.toFixed(0)}%
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Success Rate</div>
            </div>
          </div>
          {metrics.totalCost > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-center">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                x402 Payments: ${metrics.totalCost.toFixed(4)} USDC
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tier Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${isMiniPay ? 'px-1' : ''}`}>
        {/* Tier 1: The Oracle */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900 shadow-sm relative overflow-hidden cursor-pointer"
          onClick={() => showActivityFeed && setExpandedTier(expandedTier === 'oracle' ? null : 'oracle')}
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
          {showActivityFeed && expandedTier === 'oracle' && (
            <ActivityFeed activities={getActivitiesForTier('ORACLE')} />
          )}
        </motion.div>

        {/* Tier 2: The Assistant */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-green-100 dark:border-green-900 shadow-sm cursor-pointer"
          onClick={() => showActivityFeed && setExpandedTier(expandedTier === 'assistant' ? null : 'assistant')}
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
          {showActivityFeed && expandedTier === 'assistant' && (
            <ActivityFeed activities={getActivitiesForTier('ASSISTANT')} />
          )}
        </motion.div>

        {/* Tier 3: The Guardian */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900 shadow-sm relative cursor-pointer"
          onClick={() => showActivityFeed && setExpandedTier(expandedTier === 'guardian' ? null : 'guardian')}
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
          {showActivityFeed && expandedTier === 'guardian' && (
            <ActivityFeed activities={getActivitiesForTier('GUARDIAN')} />
          )}
        </motion.div>
      </div>
    </div>
  );
};

// Activity Feed Component (inline, not separate file)
const ActivityFeed: React.FC<{ activities: any[] }> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 text-center">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
      {activities.map((activity) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2"
        >
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
            activity.status === 'success' ? 'bg-green-500' :
            activity.status === 'pending' ? 'bg-amber-500' :
            'bg-red-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-tight">
              {activity.description}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-gray-400">
                {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {activity.details?.txHash && (
                <a
                  href={`https://celoscan.io/tx/${activity.details.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View tx →
                </a>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

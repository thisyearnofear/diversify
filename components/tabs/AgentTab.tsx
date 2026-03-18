/**
 * AgentTab - Dedicated Agent Control Center
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses enhanced AgentTierStatus component
 * - CONSOLIDATION: No duplicate components, reuses existing ones
 * - MINIMAL: Only essential UI, no bloat
 */

import React, { useCallback } from 'react';
import { AgentTierStatus } from '../agent/AgentTierStatus';
import AutomationSettings from '../agent/AutomationSettings';
import ActionableRecommendation from '../agent/ActionableRecommendation';
import { BacktestPanel } from '../agent/BacktestPanel';
import { useAgentStatus } from '../../hooks/use-agent-status';
import { useAgentConfig } from '../../hooks/use-agent-config';
import { useAgentAnalysis } from '../../hooks/use-agent-analysis';
import { useAgentActivities } from '../../hooks/use-agent-activities';
import { useExperience } from '../../context/app/ExperienceContext';
import { useAIOracle } from '../../hooks/use-ai-oracle';
import { useNavigation } from '../../context/app/NavigationContext';
import type { MultichainPortfolio } from '../../hooks/use-multichain-balances';
import { AUTONOMOUS_FEATURES } from '../../config/features';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
  portfolio?: MultichainPortfolio;
}

export default function AgentTab({ isMiniPay, isFarcaster, portfolio }: AgentTabProps) {
  const { capabilities, autonomousStatus } = useAgentStatus();
  const { config, updateConfig } = useAgentConfig();
  const { addActivity } = useAgentActivities();
  const noopMessage = useCallback(() => {}, []);
  const { portfolioAnalysis } = useAgentAnalysis({
    apiBase: API_BASE,
    capabilities,
    config,
    addMessage: noopMessage,
    addActivity,
    autonomousStatus,
    autonomousEnabled: AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
  });
  const { experienceMode } = useExperience();
  const { ask } = useAIOracle();
  const { navigateToSwap } = useNavigation();

  const handleAskAgent = () => {
    ask('Give me a summary of my portfolio protection status and any recommended actions.');
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
          {experienceMode === 'beginner' ? 'Your AI Assistant' : 'Agent Command Center'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {experienceMode === 'beginner' 
            ? 'See what your AI is doing to protect your savings'
            : 'Monitor and control your autonomous wealth protection agents'
          }
        </p>
      </div>

      {/* Enhanced Tier Status with Activity Feed */}
      <AgentTierStatus 
        isMiniPay={isMiniPay} 
        isFarcaster={isFarcaster}
        showActivityFeed={true}
      />

      {/* Actionable Recommendations — non-beginner only, shown when analysis exists */}
      {experienceMode !== 'beginner' && (
        <ActionableRecommendation
          analysis={portfolioAnalysis}
          portfolio={portfolio ?? null}
          onExecuteSwap={(fromToken, toToken, amount, reason) => {
            ask(`I'm about to swap ${fromToken} → ${toToken}${amount ? ` (${amount})` : ''} based on Oracle recommendation${reason ? `: ${reason}` : ''}. Please confirm this aligns with my strategy.`);
            addActivity({
              type: 'execution',
              tier: 'GUARDIAN',
              description: `Swap ${fromToken} → ${toToken}${amount ? ` ($${amount})` : ''}${reason ? ` — ${reason}` : ''}`,
              status: 'pending',
            });
            navigateToSwap({ fromToken, toToken, amount, reason });
          }}
        />
      )}

      {/* Backtest Lab (standard/advanced) */}
      {experienceMode !== 'beginner' && (
        <BacktestPanel />
      )}

      {/* Automation Settings (only in advanced mode) */}
      {experienceMode === 'advanced' && (
        <AutomationSettings 
          config={config}
          onConfigChange={updateConfig}
          autonomousStatus={autonomousStatus}
        />
      )}

      {/* Ask Agent CTA — bridges Agent tab to AI chat drawer */}
      <button
        onClick={handleAskAgent}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-sm border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        <span>💬</span>
        <span>Ask your Agent</span>
      </button>

    </div>
  );
}

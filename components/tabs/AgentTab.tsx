/**
 * AgentTab - Dedicated Agent Control Center
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Uses enhanced AgentTierStatus component
 * - CONSOLIDATION: No duplicate components, reuses existing ones
 * - MINIMAL: Only essential UI, no bloat
 */

import React from 'react';
import { AgentTierStatus } from '../agent/AgentTierStatus';
import { AutomationSettings } from '../agent/AutomationSettings';
import { useDiversifiAI } from '../../hooks/use-diversifi-ai';
import { useExperience } from '../../context/app/ExperienceContext';

interface AgentTabProps {
  isMiniPay?: boolean;
  isFarcaster?: boolean;
}

export default function AgentTab({ isMiniPay, isFarcaster }: AgentTabProps) {
  const { autonomousStatus, config, updateConfig } = useDiversifiAI();
  const { experienceMode } = useExperience();

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

      {/* Automation Settings (only in advanced mode) */}
      {experienceMode === 'advanced' && (
        autonomousStatus ? (
          <AutomationSettings
            config={config}
            onConfigChange={updateConfig}
            autonomousStatus={autonomousStatus}
          />
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-2xl mb-2">⚙️</div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Agent initialising…</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Automation settings will appear once the agent is ready.</p>
          </div>
        )
      )}

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">
              How It Works
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>🔮 <strong>Oracle</strong> analyzes your portfolio and market conditions</li>
              <li>🎙️ <strong>Assistant</strong> executes your voice commands and intents</li>
              <li>🛡️ <strong>Guardian</strong> autonomously protects your savings (coming soon)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AgentQuickActions — Quick action menu for the Advisor surface.
 * Shows a modal with Swap, Send, Check Balance actions instead of opening chat.
 *
 * CLEAN: Single-purpose component for quick actions.
 * MODULAR: Composable with AgentTierStatus.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigation } from '../../context/app/NavigationContext';

interface AgentQuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentQuickActions({ isOpen, onClose }: AgentQuickActionsProps) {
  const { setActiveTab, navigateToSwap } = useNavigation();

  const actions = [
    {
      icon: '💱',
      label: 'Swap Tokens',
      description: 'Convert between stablecoins',
      action: () => {
        navigateToSwap({
          reason: 'Quick action: Swap tokens',
        });
        onClose();
      },
    },
    {
      icon: '📤',
      label: 'Send to Contact',
      description: 'Send crypto via phone/email',
      action: () => {
        setActiveTab('exchange');
        onClose();
      },
    },
    {
      icon: '💰',
      label: 'Check Balance',
      description: 'View your portfolio',
      action: () => {
        setActiveTab('overview');
        onClose();
      },
    },
    {
      icon: '🛡️',
      label: 'Protection Status',
      description: 'View your protection score',
      action: () => {
        setActiveTab('protect');
        onClose();
      },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-24 z-50 max-w-sm mx-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎙️</span>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      Advisor Actions
                    </h3>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Shortcut into the Advisor workflow.
                </p>
              </div>

              {/* Actions */}
              <div className="p-2">
                {actions.map((action, index) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={action.action}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-lg">
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {action.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {action.description}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * OpenClawPanel — UI for OpenClaw integration.
 * Provides chat interface and execution controls for the autonomous agent.
 * 
 * CLEAN: Single-purpose component for OpenClaw interactions.
 * MODULAR: Composable with AgentTierStatus.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOpenClaw } from '../../hooks/use-openclaw';

interface OpenClawPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function OpenClawPanel({ isOpen, onClose }: OpenClawPanelProps) {
  const { 
    chat, 
    isLoading, 
    error, 
    isEnabled, 
    isUnavailable,
    analyzePortfolio,
    getIdentity 
  } = useOpenClaw();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [agentIdentity, setAgentIdentity] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load agent identity on mount
  useEffect(() => {
    if (isOpen && !agentIdentity) {
      getIdentity().then(identity => {
        if (identity) setAgentIdentity(identity);
      });
    }
  }, [isOpen, agentIdentity, getIdentity]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await chat([
        { role: 'system', content: 'You are DiversiFi-AI, an autonomous wealth diversification agent. Be concise and actionable.' },
        { role: 'user', content: input.trim() }
      ]);

      if (response.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Error: ${response.error || 'Failed to get response'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [input, isLoading, chat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const quickActions = [
    {
      label: 'Analyze Portfolio',
      icon: '📊',
      action: async () => {
        const response = await analyzePortfolio('Analyze my current portfolio and suggest diversification strategies.');
        setMessages(prev => [...prev, 
          { role: 'user', content: 'Analyze my portfolio', timestamp: new Date() },
          { role: 'assistant', content: response, timestamp: new Date() }
        ]);
      }
    },
    {
      label: 'Base Trading',
      icon: '📈',
      action: () => setInput('What Base trading strategies do you recommend?')
    },
    {
      label: 'Status L2 Gasless',
      icon: '⚡',
      action: () => setInput('How do I execute gasless transactions on Status L2?')
    },
    {
      label: 'Get Identity',
      icon: '🆔',
      action: async () => {
        const identity = await getIdentity();
        if (identity) {
          setAgentIdentity(identity);
          setMessages(prev => [...prev, 
            { role: 'user', content: 'Show agent identity', timestamp: new Date() },
            { role: 'assistant', content: `Agent ID: ${identity.agent_id}\nName: ${identity.name}\nVersion: ${identity.agent_version}\nMode: ${identity.operator_mode}`, timestamp: new Date() }
          ]);
        }
      }
    }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-x-4 bottom-4 top-20 z-50 max-w-2xl mx-auto flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <span className="text-xl">🦞</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">
                      OpenClaw Agent
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {agentIdentity ? `${agentIdentity.name} (${agentIdentity.agent_id})` : 'DiversiFi-AI'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEnabled && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                  {isUnavailable && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Unavailable
                    </span>
                  )}
                  {isEnabled && !isUnavailable && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Online
                    </span>
                  )}
                  <button
                    onClick={onClose}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    disabled={isLoading || !isEnabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🦞</div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                    OpenClaw Agent Ready
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ask about portfolio diversification, trading strategies, or execute transactions
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isEnabled ? "Ask OpenClaw..." : "OpenClaw not available"}
                  disabled={!isEnabled || isLoading}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || !isEnabled}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

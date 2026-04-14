import React, { useState } from 'react';
import { useAdvisor } from '../../hooks/use-advisor';
import { motion, AnimatePresence } from 'framer-motion';

interface AskAIButtonProps {
  /**
   * Context-specific prompt to send to AI when clicked
   * Can be a string or a function that returns a string
   */
  prompt?: string | (() => string);
  
  /**
   * Label for the button
   * @default "Ask AI"
   */
  label?: string;
  
  /**
   * Position of the button
   * @default "bottom-right"
   */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  
  /**
   * Size variant
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg';
  
  /**
   * Show as icon only (compact mode)
   * @default false
   */
  iconOnly?: boolean;
  
  /**
   * Custom className for styling
   */
  className?: string;
  
  /**
   * Show a quick input field for custom questions
   * @default false
   */
  allowCustomInput?: boolean;
  
  /**
   * Suggested quick questions to show in dropdown
   */
  quickQuestions?: string[];
  
  /**
   * Callback when AI is asked
   */
  onAsk?: (question: string) => void;
}

export default function AskAIButton({
  prompt,
  label = 'Ask AI',
  position = 'bottom-right',
  size = 'default',
  iconOnly = false,
  className = '',
  allowCustomInput = false,
  quickQuestions = [],
  onAsk,
}: AskAIButtonProps) {
  const { askAdvisor } = useAdvisor();
  const [showInput, setShowInput] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [showQuickQuestions, setShowQuickQuestions] = useState(false);

  const handleAsk = (question?: string) => {
    const finalQuestion = question || (typeof prompt === 'function' ? prompt() : prompt) || customQuestion;
    
    if (!finalQuestion.trim()) return;
    
    askAdvisor(finalQuestion);
    onAsk?.(finalQuestion);
    
    // Reset state
    setCustomQuestion('');
    setShowInput(false);
    setShowQuickQuestions(false);
  };

  const handleQuickQuestion = (question: string) => {
    // Special case: Browse Yield Vaults - skip AI and scroll to yield section
    if (question.includes('Browse Yield Vaults')) {
      setShowQuickQuestions(false);
      // Find yield section and scroll to it
      const yieldSection = document.getElementById('yield-opportunities');
      if (yieldSection) {
        yieldSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      onAsk?.(question);
      return;
    }
    
    askAdvisor(question);
    onAsk?.(question);
    setShowQuickQuestions(false);
  };

  // Position classes
  const positionClasses = {
    'top-right': 'top-2 right-2',
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-center': 'bottom-2 left-1/2 -translate-x-1/2',
  };

  // Size classes
  const sizeClasses = {
    sm: iconOnly ? 'w-8 h-8 text-xs' : 'px-2 py-1 text-xs',
    default: iconOnly ? 'w-10 h-10 text-sm' : 'px-3 py-2 text-sm',
    lg: iconOnly ? 'w-12 h-12 text-base' : 'px-4 py-2.5 text-base',
  };

  // If allowCustomInput or quickQuestions, show expanded UI
  const hasExpandedUI = allowCustomInput || quickQuestions.length > 0;

  return (
    <div className={`relative ${className}`}>
      {/* Main Button */}
      <motion.button
        onClick={() => {
          if (hasExpandedUI) {
            setShowInput(!showInput);
            setShowQuickQuestions(!showQuickQuestions);
          } else {
            handleAsk();
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          ${sizeClasses[size]}
          ${iconOnly ? 'rounded-full' : 'rounded-lg'}
          bg-gradient-to-r from-purple-500 to-indigo-600
          hover:from-purple-600 hover:to-indigo-700
          text-white font-bold
          shadow-lg shadow-purple-500/30
          hover:shadow-xl hover:shadow-purple-500/40
          transition-all duration-200
          flex items-center justify-center gap-2
          border border-purple-400/30
          backdrop-blur-sm
        `}
        title={iconOnly ? label : undefined}
      >
        <motion.span
          animate={{ rotate: showInput ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          🤖
        </motion.span>
        {!iconOnly && <span>{label}</span>}
      </motion.button>

      {/* Expanded Input/Quick Questions */}
      <AnimatePresence>
        {(showInput || showQuickQuestions) && hasExpandedUI && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-2 right-0 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 z-50"
          >
            {/* Quick Questions */}
            {quickQuestions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Quick Questions
                </p>
                <div className="space-y-1">
                  {quickQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(question)}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Input */}
            {allowCustomInput && (
              <>
                {quickQuestions.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                )}
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                    Ask Anything
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customQuestion.trim()) {
                          handleAsk();
                        }
                      }}
                      placeholder="Type your question..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAsk()}
                      disabled={!customQuestion.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-colors"
                    >
                      Ask
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Default prompt button if no custom input */}
            {!allowCustomInput && quickQuestions.length === 0 && prompt && (
              <button
                onClick={() => handleAsk()}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm transition-colors"
              >
                {typeof prompt === 'function' ? 'Ask AI' : prompt}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

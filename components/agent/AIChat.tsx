import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAIConversation } from "../../context/AIConversationContext";
import { useAppState } from "../../context/AppStateContext";
import { useDiversifiAI } from "../../hooks/use-diversifi-ai";
import VoiceButton from "../ui/VoiceButton";

// Track user-message count to distinguish "new message added" from "drawer closed"
function useUserMessageCount(messages: { role: string }[]) {
  return messages.filter(m => m.role === "user").length;
}

/**
 * AIChat - Global Bottom Sheet Drawer
 *
 * AGGRESSIVE CONSOLIDATION: Replaces standalone chat with a global
 * overlay that persists context across any screen.
 */
export default function AIChat() {
  const {
    messages,
    isDrawerOpen,
    setDrawerOpen,
    clearMessages,
    addUserMessage,
  } = useAIConversation();
  const { isAnalyzing, thinkingStep, sendChatMessage } = useDiversifiAI();
  const { setActiveTab } = useAppState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  // Track user-message count via ref so the auto-open effect only fires when
  // a NEW user message is added — not when the user simply closes the drawer.
  const prevUserMsgCountRef = useRef(useUserMessageCount(messages));
  const currentUserMsgCount = useUserMessageCount(messages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isAnalyzing) return;
    addUserMessage(inputValue.trim());
    sendChatMessage(inputValue.trim());
    setInputValue("");
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAnalyzing]);

  // Only auto-open the drawer when a NEW user message is added.
  // Using a ref to track the previous count prevents re-opening when the user
  // manually closes the drawer (closing doesn't change currentUserMsgCount).
  useEffect(() => {
    if (currentUserMsgCount > prevUserMsgCountRef.current) {
      prevUserMsgCountRef.current = currentUserMsgCount;
      setDrawerOpen(true);
    }
  }, [currentUserMsgCount, setDrawerOpen]);

  // Handle navigation actions from AI responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.action?.type === "navigate") {
      const { tab, delay = 1500 } = lastMessage.action;
      const timer = setTimeout(() => {
        setActiveTab(tab);
        setDrawerOpen(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [messages, setActiveTab, setDrawerOpen]);

  if (!isDrawerOpen) return null;

  const handleConfirmClear = () => {
    clearMessages();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          setDrawerOpen(false);
          setShowClearConfirm(false);
        }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
      />

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 max-w-[280px] mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Clear chat?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Drawer */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl w-full max-w-2xl mx-auto min-h-[60vh] max-h-[92vh] flex flex-col pointer-events-auto border-t border-white/10"
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center py-3">
          <div
            className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"
            onClick={() => setDrawerOpen(false)}
          />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 flex justify-between items-center border-b border-amber-200/30 dark:border-amber-800/20 bg-gradient-to-r from-amber-50/50 via-yellow-50/30 to-amber-50/50 dark:from-amber-900/10 dark:via-yellow-900/5 dark:to-amber-900/10">
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20 border-2 border-amber-300"
            >
              🪙
            </motion.div>
            <div>
              <h3 className="font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight text-sm">
                DiversiFi
              </h3>
              <div className="flex items-center gap-1.5">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500" 
                />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Get Stable or Die Trying
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
            >
              Clear
            </button>
            {/* Explicit close button so users can dismiss without confusion */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message List */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
        >
          {messages.length === 0 && !isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-5"
            >
              {/* Animated gold coin stack */}
              <div className="relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="text-5xl filter drop-shadow-lg"
                >
                  🪙
                </motion.div>
                <motion.div
                  animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  className="absolute -bottom-2 -right-4 text-3xl"
                >
                  🪙
                </motion.div>
                <motion.div
                  animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-2 -right-2 text-amber-400 text-xl"
                >
                  ✨
                </motion.div>
              </div>
              
              <div className="space-y-2">
                <p className="text-base font-bold text-amber-800 dark:text-amber-200">
                  DiversiFi awaits your question
                </p>
                <p className="text-sm text-amber-600/70 dark:text-amber-400/70 max-w-[240px]">
                  Ask about your portfolio, gold, yields, or inflation protection
                </p>
              </div>
              
              {/* Quick action pills */}
              <div className="flex flex-wrap justify-center gap-2 max-w-[280px]">
                {["What's my portfolio?", "How do I earn yield?", "Protect my savings"].map((prompt, i) => (
                  <motion.button
                    key={prompt}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setInputValue(prompt);
                      addUserMessage(prompt);
                      sendChatMessage(prompt);
                      setInputValue("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-700/30 hover:bg-amber-200 dark:hover:bg-amber-700/40 transition-colors"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                delay: i * 0.05 
              }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
            >
              {/* AI Avatar with coin */}
              {msg.role === "assistant" && (
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-8 h-8 mr-2 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 flex items-center justify-center text-lg shadow-lg shadow-amber-500/20 border-2 border-amber-200 self-end"
                >
                  🪙
                </motion.div>
              )}
              
              <div
                className={`relative max-w-[80%] px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 group-hover:scale-[1.02]"
                    : "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-amber-900/20 text-amber-900 dark:text-amber-100 rounded-bl-md border border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/10 group-hover:shadow-amber-500/20 group-hover:scale-[1.02]"
                }`}
              >
                {/* Subtle shimmer effect for AI messages */}
                {msg.role === "assistant" && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-amber-200/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                )}
                
                <div className="relative z-10">{msg.content}</div>
                
                {/* Timestamp */}
                <div className={`text-[10px] mt-1.5 opacity-60 ${
                  msg.role === "user" ? "text-blue-100" : "text-amber-700 dark:text-amber-400"
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-amber-900/20 rounded-2xl rounded-bl-md px-5 py-4 flex flex-col gap-3 border border-amber-200/50 dark:border-amber-700/30 max-w-[90%] shadow-lg shadow-amber-500/10">
                {/* Animated Gold Coin Oracle */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {/* Spinning gold coin */}
                    <motion.div
                      animate={{ rotateY: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 flex items-center justify-center text-2xl shadow-xl shadow-amber-500/30 border-4 border-amber-300"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      🪙
                    </motion.div>
                    {/* Sparkle effects */}
                    <motion.div
                      animate={{ 
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      className="absolute -top-2 -right-2 text-amber-400 text-lg"
                    >
                      ✨
                    </motion.div>
                    <motion.div
                      animate={{ 
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                        rotate: [0, -180, -360]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                      className="absolute -bottom-1 -left-2 text-yellow-400 text-sm"
                    >
                      ✦
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      {thinkingStep || "DiversiFi is analyzing..."}
                    </span>
                    {/* Gold progress bar */}
                    <div className="mt-2 h-1.5 bg-amber-200/50 dark:bg-amber-800/30 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ 
                          width: ["0%", "40%", "70%", "90%"],
                        }}
                        transition={{ 
                          duration: 8, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="h-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Animated data points with gold theme */}
                <div className="flex flex-wrap gap-2">
                  {["Cross-chain data", "Inflation rates", "RWA yields", "Risk models"].map((item, i) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15, repeat: Infinity, repeatDelay: 2 }}
                      className="text-[10px] px-2 py-1 bg-amber-100/60 dark:bg-amber-800/20 rounded-full text-amber-700 dark:text-amber-300 font-medium border border-amber-200/50 dark:border-amber-700/30"
                    >
                      <motion.span
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      >
                        🪙
                      </motion.span>{" "}
                      {item}
                    </motion.span>
                  ))}
                </div>

                <div className="pt-2 border-t border-blue-100 dark:border-blue-800/30">
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-300/80 font-medium leading-relaxed">
                    🔍 Analyzing your portfolio across multiple chains and comparing against real-time inflation data...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Input */}
        <div className="p-6 pt-2 pb-10 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 flex items-center gap-3">
          <form
            onSubmit={handleSubmit}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center shadow-inner"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type or tap microphone..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-white"
            />
            <VoiceButton
              size="sm"
              variant="embedded"
              onTranscription={(t) => {
                addUserMessage(t);
                sendChatMessage(t);
              }}
            />
            {inputValue.trim() && (
              <button
                type="submit"
                className="ml-2 text-blue-600 font-bold text-sm uppercase"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}

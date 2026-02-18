import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAIConversation } from "../../context/AIConversationContext";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = React.useState("");

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

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setDrawerOpen(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
      />

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
        <div className="px-6 pb-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg">
              🤖
            </div>
            <div>
              <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight text-sm">
                DiversiFi Oracle
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Live Analyst
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearMessages}
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
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <span className="text-4xl">🎤</span>
              <p className="text-sm font-medium text-gray-500 max-w-[200px]">
                Ask me about your portfolio, gold prices, or inflation
                protection.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl rounded-bl-md px-5 py-4 flex flex-col gap-3 border border-blue-100 dark:border-blue-800/30 max-w-[90%] shadow-lg shadow-blue-500/10">
                {/* Animated Oracle Icon */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-lg"
                    >
                      🤖
                    </motion.div>
                    {/* Orbiting dots */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0"
                    >
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full shadow-sm" />
                    </motion.div>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0"
                    >
                      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-emerald-400 rounded-full shadow-sm" />
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      {thinkingStep || "Oracle is analyzing..."}
                    </span>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ 
                          width: ["0%", "40%", "70%", "90%"],
                        }}
                        transition={{ 
                          duration: 8, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Animated data points */}
                <div className="flex flex-wrap gap-2">
                  {["Cross-chain data", "Inflation rates", "RWA yields", "Risk models"].map((item, i) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15, repeat: Infinity, repeatDelay: 2 }}
                      className="text-[10px] px-2 py-1 bg-white/60 dark:bg-white/10 rounded-full text-blue-600 dark:text-blue-300 font-medium border border-blue-100 dark:border-blue-800/30"
                    >
                      <motion.span
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      >
                        ✓
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
              onTranscription={(t) => sendChatMessage(t)}
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

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
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 flex flex-col gap-2 border border-gray-100 dark:border-white/5 max-w-[85%]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6 }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: 0.2,
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: 0.4,
                      }}
                      className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                    />
                  </div>
                  <span className="text-xs font-bold text-blue-600 animate-pulse uppercase tracking-widest">
                    {thinkingStep || "Oracle is analyzing..."}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-tight">
                  Searching cross-chain data and checking real-time inflation
                  protection strategies. This may take a moment.
                </p>
                <p className="text-[10px] text-blue-500/80 font-bold uppercase tracking-tight">
                  Feel free to explore the app. Your response will be here when
                  you return.
                </p>
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

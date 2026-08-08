/**
 * AgentChatContext — shared chat state (isChatting, thinkingStep).
 *
 * Replaces the module-level mutable singleton (cachedChatState + listeners)
 * that was previously in use-agent-chat.ts. That hand-rolled pub-sub
 * bypassed React's batching and caused double-renders when multiple
 * components subscribed. This context uses React's state system so
 * updates are batched and predictable.
 *
 * The provider must wrap any component that calls useAgentChat.
 * It's included in AppProviders so the whole app shares one instance.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ChatStoreState = {
  isChatting: boolean;
  thinkingStep: string;
};

const defaultChatState: ChatStoreState = {
  isChatting: false,
  thinkingStep: '',
};

type AgentChatContextValue = {
  chatState: ChatStoreState;
  updateChatState: (
    updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>),
  ) => void;
};

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [chatState, setChatState] = useState<ChatStoreState>(defaultChatState);

  const updateChatState = useCallback(
    (updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>)) => {
      setChatState((prev) => {
        const partial = typeof updater === 'function' ? updater(prev) : updater;
        return { ...prev, ...partial };
      });
    },
    [],
  );

  return (
    <AgentChatContext.Provider value={{ chatState, updateChatState }}>
      {children}
    </AgentChatContext.Provider>
  );
}

/**
 * Access the shared agent chat state. Returns null if used outside
 * a provider — callers should use the useAgentChatContextOrLocal
 * hook for a fallback that works in tests.
 */
export function useAgentChatContext(): AgentChatContextValue | null {
  return useContext(AgentChatContext);
}

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AIMessage } from '../hooks/use-diversifi-ai';

// Conversation persistence key
const CONVERSATION_STORAGE_KEY = 'diversifi-conversation';
const LAST_READ_KEY = 'diversifi-conversation-last-read';

interface AIConversationContextType {
  // Messages
  messages: AIMessage[];
  addMessage: (message: AIMessage) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, type?: 'text' | 'recommendation' | 'insight') => void;
  clearMessages: () => void;
  
  // Unread tracking
  unreadCount: number;
  markAsRead: () => void;
  hasUnread: boolean;
  
  // Active conversation metadata
  lastMessageTimestamp: Date | null;
  isConversationActive: boolean;

  // Drawer state
  isDrawerOpen: boolean;
  setDrawerOpen: (isOpen: boolean) => void;
}

const AIConversationContext = createContext<AIConversationContextType | undefined>(undefined);

export function AIConversationProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Restore Date objects
          return parsed.map((m: AIMessage) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      } catch (e) {
        console.warn('[AIConversation] Failed to load from storage:', e);
      }
    }
    return [];
  });
  
  const [lastReadTimestamp, setLastReadTimestamp] = useState<Date | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(LAST_READ_KEY);
        return stored ? new Date(stored) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Persist messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn('[AIConversation] Failed to save to storage:', e);
      }
    }
  }, [messages]);

  const addMessage = useCallback((message: AIMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    const message: AIMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
      type: 'text',
    };
    addMessage(message);
  }, [addMessage]);

  const addAssistantMessage = useCallback((content: string, type: 'text' | 'recommendation' | 'insight' = 'text') => {
    const message: AIMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      type,
    };
    addMessage(message);
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastReadTimestamp(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      localStorage.removeItem(LAST_READ_KEY);
    }
  }, []);

  const markAsRead = useCallback(() => {
    const now = new Date();
    setLastReadTimestamp(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_READ_KEY, now.toISOString());
    }
  }, []);

  // Calculate unread count
  const unreadCount = lastReadTimestamp 
    ? messages.filter(m => m.role === 'assistant' && new Date(m.timestamp) > lastReadTimestamp).length
    : messages.filter(m => m.role === 'assistant').length;

  const hasUnread = unreadCount > 0;
  const lastMessageTimestamp = messages.length > 0 
    ? new Date(messages[messages.length - 1].timestamp) 
    : null;
  const isConversationActive = messages.length > 0;

  const value: AIConversationContextType = {
    messages,
    addMessage,
    addUserMessage,
    addAssistantMessage,
    clearMessages,
    unreadCount,
    markAsRead,
    hasUnread,
    lastMessageTimestamp,
    isConversationActive,
    isDrawerOpen,
    setDrawerOpen
  };

  return (
    <AIConversationContext.Provider value={value}>
      {children}
    </AIConversationContext.Provider>
  );
}

export function useAIConversation() {
  const context = useContext(AIConversationContext);
  if (context === undefined) {
    throw new Error('useAIConversation must be used within an AIConversationProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider (for optional usage)
export function useAIConversationOptional() {
  const context = useContext(AIConversationContext);
  return context;
}

export default AIConversationContext;
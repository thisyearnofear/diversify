import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AIMessage } from '../hooks/agent-types';
import type { GuardianRecommendationContract } from '@diversifi/shared/src/types/guardian-protection';
import { useWalletContext } from '@/components/wallet/WalletProvider';

// Conversation persistence key
const CONVERSATION_STORAGE_KEY = 'diversifi-conversation';
const LAST_READ_KEY = 'diversifi-conversation-last-read';
const GUARDIAN_UPDATES_KEY = 'diversifi-guardian-updates';
const MUTED_UPDATE_TYPES_KEY = 'diversifi-guardian-muted-types';

export type GuardianUpdateType = 'observation' | 'proposal' | 'alert' | 'claim' | 'yield';

/**
 * Type-specific expiry windows so a daily-claim notification does not linger
 * for a week and a volatility alert is not still showing 6 hours later when
 * the market has already calmed. Callers can still pass an explicit
 * `expiresAt` to override (e.g. a payment-proposal tied to a specific date).
 */
const UPDATE_EXPIRY_MS: Record<GuardianUpdateType, number> = {
  claim: 24 * 60 * 60 * 1000,        // 24 hours — UBI is daily
  alert: 6 * 60 * 60 * 1000,          // 6 hours — volatility subsides
  yield: 6 * 60 * 60 * 1000,          // 6 hours — APY spikes are short-lived
  proposal: 7 * 24 * 60 * 60 * 1000,  // 7 days — payment proposals persist
  observation: 48 * 60 * 60 * 1000,  // 48 hours — general observations
};

export interface GuardianUpdate {
  id: string;
  summary: string;
  detail?: string;
  whyReason?: string;
  timestamp: Date;
  type: GuardianUpdateType;
  action?: AIMessage['action'];
  contract?: GuardianRecommendationContract;
  expiresAt: Date;
  dismissed?: boolean;
  /** Opened for review but not yet resolved — stays in the inbox. */
  read?: boolean;
  /** Snoozed until this timestamp — hidden from the tray but not dismissed. */
  snoozedUntil?: Date;
}

interface AIConversationContextType {
  // Messages
  messages: AIMessage[];
  addMessage: (message: AIMessage) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string, type?: 'text' | 'recommendation' | 'insight') => void;
  /**
   * Patch an existing message in place. Matched by `id` (preferred) or
   * `timestamp` fallback. Used by background tasks like the 0G ledger
   * anchor to update the receipt after the user already sees the message.
   */
  patchMessage: (match: { id?: string; timestamp: Date }, patch: Partial<AIMessage>) => void;
  clearMessages: () => void;

  // Proactive updates (non-modal — do not auto-open drawer)
  guardianUpdates: GuardianUpdate[];
  addGuardianUpdate: (update: Omit<GuardianUpdate, 'id' | 'timestamp' | 'expiresAt' | 'dismissed'> & { id?: string; timestamp?: Date; expiresAt?: Date }) => void;
  dismissGuardianUpdate: (id: string) => void;
  markGuardianUpdateRead: (id: string) => void;
  snoozeGuardianUpdate: (id: string, until: Date) => void;
  muteGuardianUpdateType: (type: GuardianUpdateType) => void;
  mutedUpdateTypes: GuardianUpdateType[];
  activeGuardianReview: GuardianUpdate | null;
  setActiveGuardianReview: (update: GuardianUpdate | null) => void;
  
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
  const { address } = useWalletContext();
  const storageScope = address?.toLowerCase() ?? 'anonymous';
  const scopedKey = useCallback((base: string) => `${base}:${storageScope}`, [storageScope]);
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  // Initialize from localStorage if available
  const [messages, setMessages] = useState<AIMessage[]>([]);
  
  const [lastReadTimestamp, setLastReadTimestamp] = useState<Date | null>(null);

  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const [guardianUpdates, setGuardianUpdates] = useState<GuardianUpdate[]>([]);
  const [activeGuardianReview, setActiveGuardianReview] = useState<GuardianUpdate | null>(null);

  const [mutedUpdateTypes, setMutedUpdateTypes] = useState<GuardianUpdateType[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedMessages = localStorage.getItem(scopedKey(CONVERSATION_STORAGE_KEY));
      const storedUpdates = localStorage.getItem(scopedKey(GUARDIAN_UPDATES_KEY));
      const storedMuted = localStorage.getItem(scopedKey(MUTED_UPDATE_TYPES_KEY));
      const storedLastRead = localStorage.getItem(scopedKey(LAST_READ_KEY));
      setMessages(storedMessages
        ? (JSON.parse(storedMessages) as AIMessage[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
        : []);
      const now = Date.now();
      setGuardianUpdates(storedUpdates
        ? (JSON.parse(storedUpdates) as GuardianUpdate[])
            .map((u) => ({
              ...u,
              timestamp: new Date(u.timestamp),
              expiresAt: new Date(u.expiresAt),
            }))
            .filter((u) => u.expiresAt.getTime() > now)
        : []);
      setMutedUpdateTypes(storedMuted ? JSON.parse(storedMuted) : []);
      setLastReadTimestamp(storedLastRead ? new Date(storedLastRead) : null);
      setActiveGuardianReview(null);
      localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      localStorage.removeItem(GUARDIAN_UPDATES_KEY);
      localStorage.removeItem(MUTED_UPDATE_TYPES_KEY);
      localStorage.removeItem(LAST_READ_KEY);
    } catch {
      setMessages([]);
      setGuardianUpdates([]);
      setMutedUpdateTypes([]);
      setLastReadTimestamp(null);
    }
    setHydratedScope(storageScope);
  }, [scopedKey, storageScope]);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedScope !== storageScope) return;
    try {
      const capped = guardianUpdates.slice(-20);
      localStorage.setItem(scopedKey(GUARDIAN_UPDATES_KEY), JSON.stringify(capped));
    } catch {
      // best-effort
    }
  }, [guardianUpdates, hydratedScope, scopedKey, storageScope]);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedScope !== storageScope) return;
    try {
      localStorage.setItem(scopedKey(MUTED_UPDATE_TYPES_KEY), JSON.stringify(mutedUpdateTypes));
    } catch {
      // best-effort
    }
  }, [mutedUpdateTypes, hydratedScope, scopedKey, storageScope]);

  const addGuardianUpdate = useCallback(
    (update: Omit<GuardianUpdate, 'id' | 'timestamp' | 'expiresAt' | 'dismissed'> & { id?: string; timestamp?: Date; expiresAt?: Date }) => {
      if (mutedUpdateTypes.includes(update.type)) return;
      const entry: GuardianUpdate = {
        id: update.id ?? `gu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        summary: update.summary,
        detail: update.detail,
        whyReason: update.whyReason,
        timestamp: update.timestamp ?? new Date(),
        type: update.type,
        action: update.action,
        contract: update.contract,
        expiresAt: update.expiresAt ?? new Date(Date.now() + (UPDATE_EXPIRY_MS[update.type] ?? UPDATE_EXPIRY_MS.observation)),
        dismissed: false,
        read: false,
      };
      setGuardianUpdates((prev) => [...prev.filter((u) => u.id !== entry.id), entry].slice(-20));
    },
    [mutedUpdateTypes],
  );

  const dismissGuardianUpdate = useCallback((id: string) => {
    setGuardianUpdates((prev) =>
      prev.map((u) => (u.id === id ? { ...u, dismissed: true } : u)),
    );
  }, []);

  const markGuardianUpdateRead = useCallback((id: string) => {
    setGuardianUpdates((prev) =>
      prev.map((u) => (u.id === id ? { ...u, read: true } : u)),
    );
  }, []);

  const snoozeGuardianUpdate = useCallback((id: string, until: Date) => {
    setGuardianUpdates((prev) =>
      prev.map((u) => (u.id === id ? { ...u, snoozedUntil: until } : u)),
    );
  }, []);

  const muteGuardianUpdateType = useCallback((type: GuardianUpdateType) => {
    setMutedUpdateTypes((prev) => (prev.includes(type) ? prev : [...prev, type]));
    setGuardianUpdates((prev) =>
      prev.map((u) => (u.type === type ? { ...u, dismissed: true } : u)),
    );
  }, []);

  // Persist messages to localStorage (capped to last 100 to prevent
  // unbounded growth — the server only uses the last 10 for context anyway)
  useEffect(() => {
    if (typeof window !== 'undefined' && hydratedScope === storageScope) {
      try {
        const capped = messages.slice(-100);
        localStorage.setItem(scopedKey(CONVERSATION_STORAGE_KEY), JSON.stringify(capped));
      } catch (e) {
        console.warn('[AIConversation] Failed to save to storage:', e);
      }
    }
  }, [messages, hydratedScope, scopedKey, storageScope]);

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

  const patchMessage = useCallback((match: { id?: string; timestamp: Date }, patch: Partial<AIMessage>) => {
    setMessages((prev) =>
      prev.map((m) => {
        const matchesId = match.id && m.id && m.id === match.id;
        const matchesTimestamp =
          !match.id && m.timestamp.getTime() === match.timestamp.getTime();
        if (!matchesId && !matchesTimestamp) return m;
        return { ...m, ...patch };
      }),
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastReadTimestamp(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(scopedKey(CONVERSATION_STORAGE_KEY));
      localStorage.removeItem(scopedKey(LAST_READ_KEY));
    }
  }, [scopedKey]);

  const markAsRead = useCallback(() => {
    const now = new Date();
    setLastReadTimestamp(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem(scopedKey(LAST_READ_KEY), now.toISOString());
    }
  }, [scopedKey]);

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
    patchMessage,
    clearMessages,
    guardianUpdates,
    addGuardianUpdate,
    dismissGuardianUpdate,
    markGuardianUpdateRead,
    snoozeGuardianUpdate,
    muteGuardianUpdateType,
    mutedUpdateTypes,
    activeGuardianReview,
    setActiveGuardianReview,
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

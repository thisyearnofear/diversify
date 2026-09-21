/**
 * Ask Guardian session-thread stance: transcript is not durable; closing
 * the drawer clears it; legacy localStorage keys are scrubbed.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AIConversationProvider,
  useAIConversation,
} from '../AIConversationContext';

const wallet = { address: '0xAbc0000000000000000000000000000000000001' as string | null };

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: wallet.address }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AIConversationProvider>{children}</AIConversationProvider>;
}

describe('AIConversationContext — session thread', () => {
  beforeEach(() => {
    wallet.address = '0xAbc0000000000000000000000000000000000001';
    localStorage.clear();
    localStorage.setItem(
      'diversifi-conversation:0xabc0000000000000000000000000000000000001',
      JSON.stringify([
        { role: 'user', content: 'old', timestamp: new Date().toISOString(), type: 'text' },
      ]),
    );
    localStorage.setItem('diversifi-conversation', JSON.stringify([{ role: 'user', content: 'legacy' }]));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not rehydrate a durable transcript and scrubs legacy keys', () => {
    const { result } = renderHook(() => useAIConversation(), { wrapper });
    expect(result.current.messages).toEqual([]);
    expect(
      localStorage.getItem('diversifi-conversation:0xabc0000000000000000000000000000000000001'),
    ).toBeNull();
    expect(localStorage.getItem('diversifi-conversation')).toBeNull();
  });

  it('clears the transcript when the drawer closes', () => {
    const { result } = renderHook(() => useAIConversation(), { wrapper });

    act(() => {
      result.current.setDrawerOpen(true);
      result.current.addUserMessage('hello');
      result.current.addAssistantMessage('hi there');
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.setDrawerOpen(false);
    });
    expect(result.current.isDrawerOpen).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it('New-conversation clearMessages empties the open thread', () => {
    const { result } = renderHook(() => useAIConversation(), { wrapper });

    act(() => {
      result.current.setDrawerOpen(true);
      result.current.addUserMessage('keep talking');
    });
    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isDrawerOpen).toBe(true);
  });
});

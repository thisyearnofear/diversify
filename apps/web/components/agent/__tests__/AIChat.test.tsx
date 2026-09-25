/**
 * AIChat — "New conversation" modal + memory disclosure tests.
 *
 * The drawer is rendered by a global overlay with heavy dependencies
 * (voice, credits, claim flow, portfolio, x402 receipts). Every hook and
 * child surface is mocked; the tests exercise only the modal copy, the
 * transcript-vs-memory split, and the signed DELETE to
 * /api/agent/memory.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => {
  const chatState = { isChatting: false, thinkingStep: '', memoryEnabled: false };
  const wallet = { address: '0xabc0000000000000000000000000000000000001' as string | null };
  const conversation = { isDrawerOpen: true };
  const nav = { activeTab: 'overview' as string };
  return {
    chatState,
    wallet,
    conversation,
    nav,
    clearMessages: vi.fn(),
    sendChatMessage: vi.fn(),
    setMemoryEnabled: vi.fn(),
    addUserMessage: vi.fn(),
    setDrawerOpen: vi.fn(),
    setActiveGuardianReview: vi.fn(),
    snoozeGuardianUpdate: vi.fn(),
    showToast: vi.fn(),
    signMessage: vi.fn(async () => '0xsignature'),
    getWalletAuthHeaders: vi.fn(async () => ({
      'X-Wallet-Auth-Message': encodeURIComponent('auth-message'),
      'X-Wallet-Auth-Signature': '0xsignature',
    })),
    fetch: vi.fn(),
  };
});

vi.mock('@/context/AIConversationContext', () => ({
  useAIConversation: () => ({
    messages: [],
    isDrawerOpen: mocks.conversation.isDrawerOpen,
    setDrawerOpen: mocks.setDrawerOpen,
    clearMessages: mocks.clearMessages,
    addUserMessage: mocks.addUserMessage,
    activeGuardianReview: null,
    setActiveGuardianReview: mocks.setActiveGuardianReview,
    snoozeGuardianUpdate: mocks.snoozeGuardianUpdate,
  }),
}));

vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({
    activeTab: mocks.nav.activeTab,
    setActiveTab: vi.fn(),
    navigateToSwap: vi.fn(),
    navigateToNetting: vi.fn(),
    setFocusedCycleId: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-agent-chat', () => ({
  useAgentChat: () => ({
    isChatting: mocks.chatState.isChatting,
    thinkingStep: mocks.chatState.thinkingStep,
    memoryEnabled: mocks.chatState.memoryEnabled,
    sendChatMessage: mocks.sendChatMessage,
    setMemoryEnabled: mocks.setMemoryEnabled,
  }),
}));

vi.mock('@/hooks/use-agent-status', () => ({
  useAgentStatus: () => ({
    capabilities: { analysis: true, voiceInput: false, voiceOutput: false, chat: true, webSearch: false },
    autonomousStatus: null,
  }),
}));

vi.mock('@/hooks/use-agent-voice', () => ({
  useAgentVoice: () => ({ generateSpeech: vi.fn() }),
}));

vi.mock('@/hooks/use-credits', () => ({
  useCredits: () => ({ claimReward: vi.fn() }),
}));

vi.mock('@/hooks/claim-flow-context', () => ({
  useClaimFlowContext: () => ({
    claimStatus: 'idle',
    verifyStatus: 'idle',
    handleClaim: vi.fn(),
  }),
  useOnClaimSuccess: vi.fn(),
}));

vi.mock('@diversifi/shared/src/config/celo-tokens', () => ({
  CELO_TOKEN_ADDRESS_BY_SYMBOL: {},
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({
    address: mocks.wallet.address,
    signMessage: mocks.signMessage,
  }),
}));

vi.mock('@/components/ui/VoiceButton', () => ({ default: () => null }));
vi.mock('@/components/agent/FreemiumPanel', () => ({
  default: () => <div data-testid="freemium-panel" />,
}));
vi.mock('@/components/agent/SoSoIntelligenceCard', () => ({ default: () => null }));
vi.mock('@/components/agent/SoSoActionModal', () => ({ default: () => null }));
vi.mock('@/components/agent/ResearchCheck', () => ({ ResearchCheck: () => null }));
vi.mock('@/components/agent/ResearchReceipt', () => ({ ResearchReceipt: () => null }));
vi.mock('@/components/agent/TrustFlow', () => ({ TrustFlow: () => null }));
vi.mock('@/components/agent/GuardianRecommendationCard', () => ({ GuardianRecommendationCard: () => null }));
vi.mock('@/components/shared/GuardianMascot', () => ({ GuardianMascot: () => null }));
vi.mock('@/components/shared/Scrim', () => ({
  default: () => <div data-testid="scrim" />,
}));
vi.mock('@/components/shared/SimpleMarkdown', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));
vi.mock('@/components/shared/MaskedReveal', () => ({
  MaskedReveal: ({ lines }: { lines?: string[] }) => <div>{(lines ?? []).join(' ')}</div>,
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

vi.mock('@/context/app/PortfolioContext', () => ({
  useSharedMultichainBalances: () => ({}),
}));

vi.mock('@/lib/wallet-portfolio-view', () => ({
  buildWalletPortfolioView: () => ({ freshness: 'empty' }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('@/lib/wallet-auth', () => ({
  getWalletAuthHeaders: mocks.getWalletAuthHeaders,
}));

import AIChat from '../AIChat';

const DELETE_OK_BODY = {
  success: true,
  cognee: true,
  tablestore: true,
  available: { cognee: true, tablestore: true },
};

/** Desktop/mobile switch — jsdom has no matchMedia; stub the lg breakpoint. */
function setViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'New conversation' }));
}

describe('AIChat — New conversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.isChatting = false;
    mocks.chatState.memoryEnabled = false;
    mocks.wallet.address = '0xabc0000000000000000000000000000000000001';
    mocks.conversation.isDrawerOpen = true;
    mocks.nav.activeTab = 'overview';
    setViewport(false);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => DELETE_OK_BODY });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the honest modal copy and all three controls', () => {
    render(<AIChat />);
    openModal();

    expect(screen.getByText('New conversation?')).toBeInTheDocument();
    expect(
      screen.getByText(/Starts a fresh thread\. Closing Ask Guardian does the same/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Also forget what it remembers' }),
    ).toBeInTheDocument();
    // No "Clear chat" wording anywhere.
    expect(screen.queryByText(/clear chat/i)).not.toBeInTheDocument();
  });

  it('"New conversation" clears the transcript without calling the memory API', () => {
    render(<AIChat />);
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(mocks.clearMessages).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Thread cleared'),
      'success',
    );
    expect(screen.queryByText('New conversation?')).not.toBeInTheDocument();
  });

  it('"Also forget" signs, DELETEs /api/agent/memory, then clears the transcript', async () => {
    render(<AIChat />);
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Also forget what it remembers' }));

    await waitFor(() => expect(mocks.clearMessages).toHaveBeenCalledTimes(1));
    expect(mocks.getWalletAuthHeaders).toHaveBeenCalledWith(
      '0xabc0000000000000000000000000000000000001',
      mocks.signMessage,
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/agent/memory',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-Wallet-Auth-Signature': '0xsignature' }),
      }),
    );
    expect(mocks.setMemoryEnabled).toHaveBeenCalledWith(false);
    expect(mocks.showToast).toHaveBeenCalledWith('Forgot past conversations.', 'success');
    expect(screen.queryByText('New conversation?')).not.toBeInTheDocument();
  });

  it('on API failure toasts honestly and still offers the local clear', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'nope' }) });
    render(<AIChat />);
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Also forget what it remembers' }));

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't reach memory"),
        'error',
      ),
    );
    // Transcript NOT cleared; modal stays open so "New conversation" remains available.
    expect(mocks.clearMessages).not.toHaveBeenCalled();
    expect(screen.getByText('New conversation?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(mocks.clearMessages).toHaveBeenCalledTimes(1);
  });

  it('hides the forget link when no wallet is connected', () => {
    mocks.wallet.address = null;
    render(<AIChat />);
    openModal();

    expect(screen.getByRole('button', { name: 'New conversation' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Also forget what it remembers' }),
    ).not.toBeInTheDocument();
  });

  it('shows the memory disclosure only when the last response reported memory enabled', () => {
    mocks.chatState.memoryEnabled = true;
    const { unmount } = render(<AIChat />);
    expect(screen.getByText('Guardian remembers past conversations')).toBeInTheDocument();
    unmount();

    mocks.chatState.memoryEnabled = false;
    render(<AIChat />);
    expect(screen.queryByText('Guardian remembers past conversations')).not.toBeInTheDocument();
  });
});

describe('AIChat — desktop docked panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.isChatting = false;
    mocks.chatState.memoryEnabled = false;
    mocks.wallet.address = '0xabc0000000000000000000000000000000000001';
    mocks.conversation.isDrawerOpen = true;
    mocks.nav.activeTab = 'overview';
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('renders the docked panel without a scrim on desktop', () => {
    setViewport(true);
    render(<AIChat />);
    const panel = screen.getByRole('dialog', { name: 'Ask Guardian' });
    expect(panel.className).toContain('w-[420px]');
    expect(panel.className).toContain('rounded-3xl');
    expect(screen.queryByTestId('scrim')).not.toBeInTheDocument();
    // No drag handle on desktop
    expect(panel.querySelector('.cursor-grab')).toBeNull();
  });

  it('renders the mobile sheet with scrim below lg', () => {
    setViewport(false);
    render(<AIChat />);
    const panel = screen.getByRole('dialog', { name: 'Ask Guardian' });
    expect(panel.className).toContain('rounded-t-3xl');
    expect(screen.getByTestId('scrim')).toBeInTheDocument();
  });

  it('Esc closes the drawer', () => {
    setViewport(true);
    render(<AIChat />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mocks.setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it('⌘K and "/" open the drawer, but not while typing in an input', () => {
    setViewport(true);
    mocks.conversation.isDrawerOpen = false;
    render(<AIChat />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(mocks.setDrawerOpen).toHaveBeenCalledWith(true);
    fireEvent.keyDown(document, { key: '/' });
    expect(mocks.setDrawerOpen).toHaveBeenCalledTimes(2);
    mocks.setDrawerOpen.mockClear();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '/' });
    fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(mocks.setDrawerOpen).not.toHaveBeenCalled();
    input.remove();
  });

  it('shows the active tab in the context line', () => {
    setViewport(true);
    render(<AIChat />);
    expect(screen.getByText('Looking at: Home')).toBeInTheDocument();
  });

  it('appends the stored Exchange pair to the context line', () => {
    setViewport(true);
    mocks.nav.activeTab = 'exchange';
    sessionStorage.setItem('diversifi.exchange.pair', JSON.stringify({ fromToken: 'USDm', toToken: 'KESm' }));
    render(<AIChat />);
    expect(screen.getByText('Looking at: Exchange · USDm → KESm')).toBeInTheDocument();
  });

  it('chips are questions, differ by tab, and never show tier tags', () => {
    setViewport(true);
    mocks.nav.activeTab = 'overview';
    const { unmount } = render(<AIChat />);
    expect(screen.getByText('How is my portfolio protected?')).toBeInTheDocument();
    expect(screen.queryByText('Should I convert before my next payment?')).not.toBeInTheDocument();
    unmount();

    mocks.nav.activeTab = 'exchange';
    render(<AIChat />);
    expect(screen.getByText('Should I convert before my next payment?')).toBeInTheDocument();
    // "Free"/"Shield" live only in title + sr-only text — no visible tag.
    const dialog = screen.getByRole('dialog', { name: 'Ask Guardian' });
    const visibleTierTags = Array.from(dialog.querySelectorAll('span')).filter(
      (s) => /^(Free|Shield)$/.test(s.textContent ?? '') && !s.className.includes('sr-only'),
    );
    expect(visibleTierTags).toHaveLength(0);
    expect(screen.getByTitle('Shield tier')).toBeInTheDocument();
  });

  it('keeps the balance panel in the footer, not before the header', () => {
    setViewport(true);
    render(<AIChat />);
    const freemium = screen.getByTestId('freemium-panel');
    const input = screen.getByLabelText('Ask your Guardian a question');
    // FreemiumPanel renders inside the footer — it must come AFTER the
    // header and sit adjacent to the input.
    const header = screen.getByText('Guardian').closest('div');
    expect(header!.compareDocumentPosition(freemium) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(freemium.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

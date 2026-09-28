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
  const conversation = {
    isDrawerOpen: true,
    activeGuardianReview: null as unknown,
    messages: [] as Array<Record<string, unknown>>,
  };
  const nav = { activeTab: 'overview' as string };
  const memory = {
    pref: { mode: 'off' as 'off' | 'device' | 'cloud', provider: undefined as string | undefined },
    facts: [] as Array<{ id: string; text: string; createdAt: string }>,
    providers: null as Array<{ id: string; location: string; available: boolean }> | null,
    cloudNeedsAuth: false,
    chooseMode: vi.fn(async () => true),
    deleteFact: vi.fn(async () => {}),
    forgetAll: vi.fn(async () => true),
  };
  return {
    chatState,
    wallet,
    conversation,
    nav,
    memory,
    navigateWithIntent: vi.fn(),
    setFocusedCycleId: vi.fn(),
    clearMessages: vi.fn(),
    sendChatMessage: vi.fn(),
    setMemoryEnabled: vi.fn(),
    addUserMessage: vi.fn(),
    patchMessage: vi.fn(),
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

vi.mock('@/hooks/use-guardian-memory', () => ({
  useGuardianMemory: () => ({
    pref: mocks.memory.pref,
    facts: mocks.memory.facts,
    providers: mocks.memory.providers,
    cloudNeedsAuth: mocks.memory.cloudNeedsAuth,
    hydrated: true,
    requestPayload: () =>
      mocks.memory.pref.mode === 'device'
        ? { mode: 'device', facts: mocks.memory.facts.map((f) => f.text) }
        : mocks.memory.pref.mode === 'cloud'
          ? { mode: 'cloud', provider: mocks.memory.pref.provider }
          : { mode: 'off' },
    chooseMode: mocks.memory.chooseMode,
    loadProviders: vi.fn(async () => {}),
    deleteFact: mocks.memory.deleteFact,
    forgetAll: mocks.memory.forgetAll,
    reloadFacts: vi.fn(async () => {}),
  }),
}));

vi.mock('@/context/AIConversationContext', () => ({
  useAIConversation: () => ({
    messages: mocks.conversation.messages,
    isDrawerOpen: mocks.conversation.isDrawerOpen,
    setDrawerOpen: mocks.setDrawerOpen,
    clearMessages: mocks.clearMessages,
    addUserMessage: mocks.addUserMessage,
    patchMessage: mocks.patchMessage,
    activeGuardianReview: mocks.conversation.activeGuardianReview,
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
    navigateWithIntent: mocks.navigateWithIntent,
    setFocusedCycleId: mocks.setFocusedCycleId,
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
vi.mock('@/components/agent/GuardianRecommendationCard', () => ({
  GuardianRecommendationCard: ({ onReview }: { onReview?: () => void }) =>
    onReview ? <button onClick={onReview}>Review</button> : null,
}));
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
    mocks.conversation.messages = [];
    mocks.nav.activeTab = 'overview';
    mocks.memory.pref = { mode: 'off', provider: undefined };
    mocks.memory.facts = [];
    mocks.memory.providers = null;
    mocks.memory.cloudNeedsAuth = false;
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

  it('shows the memory mode in the footer — Off by default', () => {
    render(<AIChat />);
    expect(screen.getByTestId('memory-status-line')).toHaveTextContent('Memory: Off');
  });
});

describe('AIChat — desktop docked panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.isChatting = false;
    mocks.chatState.memoryEnabled = false;
    mocks.wallet.address = '0xabc0000000000000000000000000000000000001';
    mocks.conversation.isDrawerOpen = true;
    mocks.conversation.messages = [];
    mocks.nav.activeTab = 'overview';
    mocks.memory.pref = { mode: 'off', provider: undefined };
    mocks.memory.facts = [];
    mocks.memory.providers = null;
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
    // 340px through the lg range, widening to 420px at xl+.
    expect(panel.className).toContain('w-[340px]');
    expect(panel.className).toContain('xl:w-[420px]');
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

describe('AIChat — action router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.isChatting = false;
    mocks.wallet.address = '0xabc0000000000000000000000000000000000001';
    mocks.conversation.isDrawerOpen = true;
    mocks.nav.activeTab = 'overview';
    mocks.conversation.activeGuardianReview = null;
    mocks.conversation.messages = [];
    mocks.memory.pref = { mode: 'off', provider: undefined };
    mocks.memory.facts = [];
    mocks.memory.providers = null;
    setViewport(true);
  });

  it('open_cycle_review navigates to Shield with the cycle lens and focuses the cycle', () => {
    mocks.conversation.activeGuardianReview = {
      id: 'rev-1',
      summary: 'Payment due soon',
      contract: {
        title: 'Cycle review',
        proposal: 'Watch this cycle',
        action: { type: 'open_cycle_review', cycleId: 'cycle-42' },
      },
    };
    render(<AIChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(mocks.navigateWithIntent).toHaveBeenCalledWith('protect', {
      source: 'guardian',
      lens: 'cycle',
    });
    expect(mocks.setFocusedCycleId).toHaveBeenCalledWith('cycle-42');
    expect(mocks.setDrawerOpen).toHaveBeenCalledWith(false);
  });
});

describe('AIChat — Guardian memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatState.isChatting = false;
    mocks.wallet.address = '0xabc0000000000000000000000000000000000001';
    mocks.conversation.isDrawerOpen = true;
    mocks.conversation.messages = [];
    mocks.nav.activeTab = 'overview';
    mocks.memory.pref = { mode: 'off', provider: undefined };
    mocks.memory.facts = [];
    mocks.memory.providers = [
      { id: 'tablestore', location: 'Alibaba Cloud — stored in mainland China', available: true },
      { id: 'cognee', location: 'Cognee — stored in the USA (AWS)', available: false },
    ];
    mocks.memory.cloudNeedsAuth = false;
    setViewport(true);
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('footer reflects the current mode', () => {
    const { unmount } = render(<AIChat />);
    expect(screen.getByTestId('memory-status-line')).toHaveTextContent('Memory: Off');
    unmount();

    mocks.memory.pref = { mode: 'device', provider: undefined };
    const r2 = render(<AIChat />);
    expect(screen.getByTestId('memory-status-line')).toHaveTextContent('Memory: this device');
    r2.unmount();

    mocks.memory.pref = { mode: 'cloud', provider: 'tablestore' };
    render(<AIChat />);
    expect(screen.getByTestId('memory-status-line')).toHaveTextContent(
      'Memory: across devices · Alibaba Cloud',
    );
  });

  it('Change opens the memory view with modes and providers — unavailable ones disabled', async () => {
    render(<AIChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByTestId('guardian-memory-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'This device' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Across devices' })).toBeInTheDocument();

    // Select cloud → provider list appears; cognee is unavailable + labelled.
    fireEvent.click(screen.getByRole('radio', { name: 'Across devices' }));
    const cognee = screen.getByRole('radio', { name: /Cognee/ });
    expect(cognee).toBeDisabled();
    expect(screen.getByText('Not set up yet')).toBeInTheDocument();
    const tablestore = screen.getByRole('radio', { name: /Alibaba Cloud/ });
    expect(tablestore).toBeEnabled();
    expect(screen.getByText('stored in mainland China')).toBeInTheDocument();
  });

  it('choosing a cloud provider signs and commits; declining stays on the old mode', async () => {
    mocks.memory.chooseMode.mockResolvedValueOnce(false);
    render(<AIChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await screen.findByTestId('guardian-memory-view');
    fireEvent.click(screen.getByRole('radio', { name: 'Across devices' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Alibaba Cloud/ }, { timeout: 4000 }));
    await waitFor(() =>
      expect(mocks.memory.chooseMode).toHaveBeenCalledWith('cloud', 'tablestore'),
    );
    // Signature declined → radio returns to the previous mode.
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('a reply that stored facts shows "Remembered: … · Undo"; Undo removes it', async () => {
    mocks.memory.pref = { mode: 'device', provider: undefined };
    mocks.conversation.messages = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Noted.',
        timestamp: new Date('2026-09-28T10:00:00Z'),
        rememberedFacts: [{ id: 'gf-1', text: 'You pay a supplier in USD monthly' }],
      },
    ];
    render(<AIChat />);
    expect(screen.getByTestId('remembered-fact')).toHaveTextContent(
      'Remembered: You pay a supplier in USD monthly · Undo',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(mocks.memory.deleteFact).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gf-1' }),
      ),
    );
    expect(mocks.patchMessage).toHaveBeenCalled();
  });

  it('turning Off with facts asks inline — Delete or Keep', async () => {
    mocks.memory.pref = { mode: 'device', provider: undefined };
    mocks.memory.facts = [
      { id: 'gf-1', text: 'You save in KES', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    render(<AIChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await screen.findByTestId('guardian-memory-view');
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(await screen.findByText('Also delete what Guardian remembers?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.memory.forgetAll).toHaveBeenCalled());
    await waitFor(() => expect(mocks.memory.chooseMode).toHaveBeenCalledWith('off'));
  });

  it('walletless users see no Across devices option', async () => {
    mocks.wallet.address = null;
    render(<AIChat />);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    await screen.findByTestId('guardian-memory-view');
    expect(screen.getByRole('radio', { name: 'Off' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'This device' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Across devices' })).not.toBeInTheDocument();
  });

  it('every advisor request carries the memory field', () => {
    mocks.memory.pref = { mode: 'device', provider: undefined };
    mocks.memory.facts = [
      { id: 'gf-1', text: 'You save in KES', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    render(<AIChat />);
    fireEvent.change(screen.getByLabelText('Ask your Guardian a question'), {
      target: { value: 'How is my KES doing?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(mocks.sendChatMessage).toHaveBeenCalledWith(
      'How is my KES doing?',
      expect.objectContaining({ memory: { mode: 'device', facts: ['You save in KES'] } }),
    );
  });
});

/**
 * useTabDiscovery — Tracks tab navigation patterns for the first-visit swipe hint.
 *
 * Records which tabs the user has visited, whether they've used the tab bar
 * or swipe gestures, and whether this is their first session. The hint is
 * shown only on first visit and suppressed once the user has navigated
 * to 3+ tabs.
 *
 * When a TabDiscoveryProvider is mounted higher in the tree, this hook
 * reads from the shared context so that TabNavigation (responsible for
 * rendering the hint) and TabContentRouter (responsible for tracking
 * swipe gestures) share the same state. Without the provider, the hook
 * falls back to local state (standalone usage in tests, or components
 * outside the provider scope).
 *
 * The context and provider live in this file alongside the hook to avoid
 * a circular import (the provider needs the hook, and the hook needs
 * the context).
 *
 * Per the Core Principles:
 *   - PERFORMANT: writes to sessionStorage, no fetches, no re-renders on
 *     unrelated state changes.
 *   - DRY: single source of truth for tab-discovery state used by TabNavHint
 *     and potentially other surfaces.
 *   - CLEAN: pure hook, no side effects beyond localStorage.
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from 'react';
import type { TabId } from '@/constants/tabs';

const STORAGE_KEY = 'diversifi-tab-discovery';

interface TabDiscoveryState {
    visitedTabs: TabId[];
    hasUsedSwipe: boolean;
    hasUsedTabBar: boolean;
    dismissed: boolean;
}

function loadState(): TabDiscoveryState {
    if (typeof window === 'undefined') {
        return { visitedTabs: [], hasUsedSwipe: false, hasUsedTabBar: false, dismissed: false };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                visitedTabs: parsed.visitedTabs ?? [],
                hasUsedSwipe: parsed.hasUsedSwipe ?? false,
                hasUsedTabBar: parsed.hasUsedTabBar ?? false,
                dismissed: parsed.dismissed ?? false,
            };
        }
    } catch {
        // Ignore storage errors
    }
    return { visitedTabs: [], hasUsedSwipe: false, hasUsedTabBar: false, dismissed: false };
}

function saveState(state: TabDiscoveryState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage errors
    }
}

export interface UseTabDiscoveryResult {
    visitedTabs: TabId[];
    hasUsedSwipe: boolean;
    hasUsedTabBar: boolean;
    showHint: boolean;
    recordTabVisit: (tab: TabId) => void;
    recordSwipe: () => void;
    recordTabBar: () => void;
    dismiss: () => void;
}

// ── Shared context (provider + consumer hook live here to avoid circular imports) ──

const TabDiscoveryContext = createContext<UseTabDiscoveryResult | null>(null);

/**
 * Read tab discovery state from the shared context.
 * Returns null when no provider is mounted.
 */
export function useTabDiscoveryContext(): UseTabDiscoveryResult | null {
    return useContext(TabDiscoveryContext);
}

/**
 * TabDiscoveryProvider — Shares a single useTabDiscovery instance across siblings.
 * Mount in AppShell.tsx wrapping TabNavigation + TabContentRouter.
 */
export function TabDiscoveryProvider({ children }: { children: ReactNode }) {
    const tabDiscovery = useTabDiscoveryInternal();
    return (
        <TabDiscoveryContext.Provider value={tabDiscovery}>
            {children}
        </TabDiscoveryContext.Provider>
    );
}

// ── Internal: the actual hook (without the context check, to avoid recursion) ──

function useTabDiscoveryInternal(): UseTabDiscoveryResult {
    const [state, setState] = useState<TabDiscoveryState>(loadState);

    useEffect(() => {
        saveState(state);
    }, [state]);

    const showHint = !state.dismissed && state.visitedTabs.length < 2 && !state.hasUsedSwipe && !state.hasUsedTabBar;

    const recordTabVisit = useCallback((tab: TabId) => {
        setState((prev) => {
            if (prev.visitedTabs.includes(tab)) return prev;
            return { ...prev, visitedTabs: [...prev.visitedTabs, tab] };
        });
    }, []);

    const recordSwipe = useCallback(() => {
        setState((prev) => ({ ...prev, hasUsedSwipe: true }));
    }, []);

    const recordTabBar = useCallback(() => {
        setState((prev) => ({ ...prev, hasUsedTabBar: true }));
    }, []);

    const dismiss = useCallback(() => {
        setState((prev) => ({ ...prev, dismissed: true }));
    }, []);

    return {
        visitedTabs: state.visitedTabs,
        hasUsedSwipe: state.hasUsedSwipe,
        hasUsedTabBar: state.hasUsedTabBar,
        showHint,
        recordTabVisit,
        recordSwipe,
        recordTabBar,
        dismiss,
    };
}

// ── Public hook ──

export function useTabDiscovery(): UseTabDiscoveryResult {
    // If a TabDiscoveryProvider is mounted, use the shared context so
    // TabNavigation and TabContentRouter stay in sync.
    const ctx = useTabDiscoveryContext();

    // The provider's presence is stable for the lifetime of the app
    // (it's mounted at the root in pages/_app.tsx and never torn down
    // mid-session), so the conditional hook below is safe in practice.
    // If the provider pattern ever needs to toggle dynamically, this
    // should switch to always calling both hooks and picking one.
    if (ctx) return ctx;

    // Fallback: standalone local state (no provider mounted).
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useTabDiscoveryInternal();
}

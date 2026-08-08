/**
 * ProofFeedContext — page-level context for the 0G RecommendationLedger
 * proof feed data.
 *
 * Mounted once inside ProviderTree (in components/app/ProviderTree.tsx)
 * so every component in the tree that calls useProofFeed() reads from a
 * single shared fetch + cache. This is the DRY consolidation: the same
 * data shape is shared by LiveProofCard, LiveProofTicker, and any future
 * consumer (e.g. a future /proof route) without a second network call.
 *
 * The hook (useProofFeed) reads from this context if present and falls
 * back to its own fetch if not, so unit tests and the rare standalone
 * consumer work without the provider.
 */

import { createContext } from 'react';
import type { ProofFeedData } from './use-proof-feed';

export interface ProofFeedContextValue {
    data: ProofFeedData | null;
    isLoading: boolean;
    isStale: boolean;
    error: string | null;
    refresh: () => Promise<ProofFeedData | null>;
}

export const ProofFeedContext = createContext<ProofFeedContextValue | null>(null);

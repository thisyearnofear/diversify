/**
 * Watchlist Hook
 * Track favorite stocks for quick access
 * ENHANCEMENT FIRST: Works with existing components
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'diversifi-watchlist';

export function useWatchlist() {
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setWatchlist(parsed);
            } catch (e) {
                console.error('Failed to parse watchlist:', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever watchlist changes
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
        }
    }, [watchlist, isLoaded]);

    const addToWatchlist = useCallback((symbol: string) => {
        setWatchlist(prev => {
            if (prev.includes(symbol)) return prev;
            return [symbol, ...prev].slice(0, 10); // Max 10 favorites
        });
    }, []);

    const removeFromWatchlist = useCallback((symbol: string) => {
        setWatchlist(prev => prev.filter(s => s !== symbol));
    }, []);

    const toggleWatchlist = useCallback((symbol: string) => {
        setWatchlist(prev => {
            if (prev.includes(symbol)) {
                return prev.filter(s => s !== symbol);
            }
            return [symbol, ...prev].slice(0, 10);
        });
    }, []);

    const isInWatchlist = useCallback((symbol: string) => {
        return watchlist.includes(symbol);
    }, [watchlist]);

    const clearWatchlist = useCallback(() => {
        setWatchlist([]);
    }, []);

    return {
        watchlist,
        isLoaded,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlist,
        isInWatchlist,
        clearWatchlist,
    };
}

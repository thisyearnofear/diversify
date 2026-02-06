import { useState, useEffect, useMemo } from 'react';

/**
 * useNetworkActivity - Behavioral & Social Proof Hook
 * 
 * Provides simulated or indexed global metrics to drive engagement:
 * - Total value protected (Global)
 * - Recent user activity (Simulated "Pulse")
 * - High-impact price alerts (Gold, Stables)
 */

export interface NetworkPulse {
    id: string;
    type: 'social' | 'market' | 'volume';
    message: string;
    icon: string;
    priority: 'low' | 'medium' | 'high';
}

export interface Nudge {
    message: string;
    type: 'social' | 'market' | 'volume';
}

export function useNetworkActivity() {
    const [stats, setStats] = useState({
        totalUsers: 1248,
        totalProtected: 1245000,
        activeProtections24h: 84,
        topTrendingRegion: 'Africa',
        goldPriceChange24h: 1.25,
    });

    const nudges: Nudge[] = useMemo(() => [
        { message: "Someone in Kenya just swapped KESm → PAXG", type: 'social' },
        { message: "Gold reserves on Arbitrum up 15% this week", type: 'market' },
        { message: "New EURm diversification strategy detected in Europe", type: 'social' },
        { message: "Institutional volume for USDY rising", type: 'volume' },
        { message: "User in Brazil protected $500 from 8% inflation", type: 'social' },
        { message: "PAXG volatility remains low vs fiat currencies", type: 'market' }
    ], []);

    const [currentPulseIndex, setCurrentPulseIndex] = useState(0);

    const getRandomNudge = () => nudges[Math.floor(Math.random() * nudges.length)];

    // List of pulses to cycle through
    const pulses: NetworkPulse[] = useMemo(() => [
        {
            id: 'p1',
            type: 'social',
            message: `${stats.activeProtections24h} users protected wealth in the last 24h`,
            icon: '🛡️',
            priority: 'medium'
        },
        {
            id: 'p2',
            type: 'market',
            message: `Gold (PAXG) momentum: +${stats.goldPriceChange24h}% today`,
            icon: '🏆',
            priority: 'high'
        },
        {
            id: 'p3',
            type: 'volume',
            message: `$${(stats.totalProtected / 1000000).toFixed(1)}M+ total assets secured via DiversiFi`,
            icon: '📈',
            priority: 'low'
        },
        {
            id: 'p4',
            type: 'social',
            message: `Trending: High demand for EURm in ${stats.topTrendingRegion}`,
            icon: '🔥',
            priority: 'medium'
        }
    ], [stats]);

    // Auto-cycle the pulse
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPulseIndex(prev => (prev + 1) % pulses.length);
        }, 8000); // 8 seconds per pulse
        return () => clearInterval(interval);
    }, [pulses.length]);

    return {
        stats,
        pulses,
        currentPulse: pulses[currentPulseIndex],
        nextPulse: () => setCurrentPulseIndex(prev => (prev + 1) % pulses.length),
        getRandomNudge
    };
}

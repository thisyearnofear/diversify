/**
 * React hook for Hyperliquid commodity position management
 * Provides real-time position tracking, PnL, trading actions, and bridge functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import {
    HyperliquidPositionService,
    HyperliquidBridgeService,
    getHyperliquidAccountStatus,
    fetchHyperliquidPrices,
    fetchHyperliquidMeta,
    HYPERLIQUID_MARKET_TICKERS,
    analyzeCommodityAvailability,
} from '@diversifi/shared';
import type { CommodityPosition, PortfolioSummary, HyperliquidAccountStatus, HyperliquidBridgeResult } from '@diversifi/shared';

interface CommodityPrice {
    symbol: string;
    ticker: string;
    price: number;
    name: string;
}

interface UseHyperliquidOptions {
    address?: string | null;
    signer?: ethers.Signer | null;
    autoRefresh?: boolean;
    refreshInterval?: number; // ms, default 10s
}

interface UseHyperliquidReturn {
    // Position data
    positions: CommodityPosition[];
    portfolio: PortfolioSummary | null;
    prices: CommodityPrice[];
    
    // Account status
    accountStatus: HyperliquidAccountStatus | null;
    hyperliquidBalance: number;
    isActivated: boolean;
    
    // Loading states
    isLoading: boolean;
    isActivating: boolean;
    isWithdrawing: boolean;
    
    // Errors
    error: string | null;
    
    // Actions
    refresh: () => Promise<void>;
    activateAccount: () => Promise<HyperliquidBridgeResult>;
    withdraw: (amount: string) => Promise<HyperliquidBridgeResult>;
    
    // Risk monitoring
    atRiskPositions: CommodityPosition[];
    
    // Availability
    unavailableSymbols: string[];
    unavailableReasons: Partial<Record<string, string>>;
    
    // Deposit instructions
    depositInstructions: {
        steps: string[];
        requiredChains: string[];
        bridgeUrl: string;
    };
}

const COMMODITY_NAMES: Record<string, string> = {
    GOLD: 'Gold',
    SILVER: 'Silver',
    OIL: 'Crude Oil',
    COPPER: 'Copper',
};

const positionService = new HyperliquidPositionService();
const bridgeService = new HyperliquidBridgeService();

export function useHyperliquid(options: UseHyperliquidOptions = {}): UseHyperliquidReturn {
    const { address, signer, autoRefresh = true, refreshInterval = 10000 } = options;

    // Position data
    const [positions, setPositions] = useState<CommodityPosition[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
    const [prices, setPrices] = useState<CommodityPrice[]>([]);
    const [atRiskPositions, setAtRiskPositions] = useState<CommodityPosition[]>([]);
    
    // Account status
    const [accountStatus, setAccountStatus] = useState<HyperliquidAccountStatus | null>(null);
    
    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    
    // Errors
    const [error, setError] = useState<string | null>(null);
    const [unavailableSymbols, setUnavailableSymbols] = useState<string[]>([]);
    const [unavailableReasons, setUnavailableReasons] = useState<Partial<Record<string, string>>>({});
    
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Derived values
    const hyperliquidBalance = accountStatus?.availableBalance ?? 0;
    const isActivated = accountStatus?.isActivated ?? false;

    const fetchPrices = useCallback(async () => {
        try {
            const [allMids, meta] = await Promise.all([
                fetchHyperliquidPrices(),
                fetchHyperliquidMeta(),
            ]);
            const availability = analyzeCommodityAvailability(allMids, meta);
            const resolvedTickers = availability.resolvedTickers;

            const commodityPrices: CommodityPrice[] = Object.entries(HYPERLIQUID_MARKET_TICKERS)
                .map(([symbol, ticker]) => ({
                    symbol,
                    ticker: resolvedTickers[symbol] || ticker,
                    price: resolvedTickers[symbol] && allMids[resolvedTickers[symbol]]
                        ? parseFloat(allMids[resolvedTickers[symbol]] as string)
                        : 0,
                    name: COMMODITY_NAMES[symbol] || symbol,
                }))
                .filter(p => p.price > 0);

            setUnavailableSymbols(availability.unavailableSymbols);
            setUnavailableReasons(availability.unavailableReasons);
            setPrices(commodityPrices);
        } catch (err: any) {
            console.warn('[useHyperliquid] Price fetch failed:', err.message);
            setUnavailableSymbols(Object.keys(HYPERLIQUID_MARKET_TICKERS));
            setUnavailableReasons({
                GOLD: 'Failed to fetch Hyperliquid commodity market data',
                SILVER: 'Failed to fetch Hyperliquid commodity market data',
                OIL: 'Failed to fetch Hyperliquid commodity market data',
                COPPER: 'Failed to fetch Hyperliquid commodity market data',
            });
        }
    }, []);

    const fetchAccountStatus = useCallback(async (userAddress: string) => {
        try {
            const status = await getHyperliquidAccountStatus(userAddress);
            setAccountStatus(status);
        } catch (err: any) {
            console.warn('[useHyperliquid] Account status fetch failed:', err.message);
            setAccountStatus(null);
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await fetchPrices();

            if (address) {
                // Fetch account status and positions in parallel
                const [, , summary, atRisk] = await Promise.all([
                    fetchAccountStatus(address),
                    positionService.clearCache(),
                    positionService.getPortfolioSummary(address),
                    positionService.getAtRiskPositions(address),
                ]);
                
                setPortfolio(summary);
                setPositions(summary.positions);
                setAtRiskPositions(atRisk);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch Hyperliquid data');
        } finally {
            setIsLoading(false);
        }
    }, [address, fetchPrices, fetchAccountStatus]);

    // Activate account for trading
    const activateAccount = useCallback(async (): Promise<HyperliquidBridgeResult> => {
        if (!signer) {
            return { success: false, error: 'No signer available' };
        }

        setIsActivating(true);
        try {
            const result = await bridgeService.activateAccount(signer, 'DiversiFi Trading');
            
            if (result.success && address) {
                // Refresh account status after activation
                await fetchAccountStatus(address);
            }
            
            return result;
        } catch (err: any) {
            return { success: false, error: err.message || 'Activation failed' };
        } finally {
            setIsActivating(false);
        }
    }, [signer, address, fetchAccountStatus]);

    // Withdraw USDC to Arbitrum
    const withdraw = useCallback(async (amount: string): Promise<HyperliquidBridgeResult> => {
        if (!signer) {
            return { success: false, error: 'No signer available' };
        }

        setIsWithdrawing(true);
        try {
            const result = await bridgeService.initiateWithdrawal(signer, amount);
            
            if (result.success) {
                // Refresh account status after withdrawal
                await refresh();
            }
            
            return result;
        } catch (err: any) {
            return { success: false, error: err.message || 'Withdrawal failed' };
        } finally {
            setIsWithdrawing(false);
        }
    }, [signer, refresh]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        refresh();

        if (autoRefresh) {
            intervalRef.current = setInterval(refresh, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [refresh, autoRefresh, refreshInterval]);

    // Deposit instructions (static, but kept in hook for convenience)
    const depositInstructions = bridgeService.getDepositInstructions();

    return {
        // Position data
        positions,
        portfolio,
        prices,
        
        // Account status
        accountStatus,
        hyperliquidBalance,
        isActivated,
        
        // Loading states
        isLoading,
        isActivating,
        isWithdrawing,
        
        // Errors
        error,
        
        // Actions
        refresh,
        activateAccount,
        withdraw,
        
        // Risk monitoring
        atRiskPositions,
        
        // Availability
        unavailableSymbols,
        unavailableReasons,
        
        // Deposit instructions
        depositInstructions,
    };
}

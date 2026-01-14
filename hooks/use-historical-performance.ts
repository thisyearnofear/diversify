import { useState, useEffect } from 'react';
import type { Region } from './use-user-region';

interface HistoricalData {
  dates: string[];
  values: number[];
  regions: Record<Region, number[]>;
  percentChange: number;
  volatility: number;
}

export function useHistoricalPerformance(address: string | undefined | null) {
  const [data, setData] = useState<HistoricalData>({
    dates: [],
    values: [],
    regions: {
      USA: [],
      Europe: [],
      Africa: [],
      LatAm: [],
      Asia: [],
    },
    percentChange: 0,
    volatility: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }
    
    const fetchHistoricalData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check cache first
        const cacheKey = `historical-performance-${address}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          // Cache valid for 1 hour
          if (Date.now() - timestamp < 60 * 60 * 1000) {
            setData(cachedData);
            setIsLoading(false);
            return;
          }
        }
        
        // For demo purposes, generate mock historical data
        // In a real implementation, this would fetch from an API or blockchain
        const today = new Date();
        const dates: string[] = [];
        const values: number[] = [];
        const regions: Record<Region, number[]> = {
          USA: [],
          Europe: [],
          Africa: [],
          LatAm: [],
          Asia: [],
        };
        
        // Generate 30 days of data
        for (let i = 30; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
          
          // Generate random portfolio value with slight upward trend
          const baseValue = 1000 + (30 - i) * 5;
          const randomFactor = 0.95 + Math.random() * 0.1;
          const value = baseValue * randomFactor;
          values.push(value);
          
          // Generate regional allocations
          const usaValue = value * (0.3 + Math.random() * 0.1);
          const europeValue = value * (0.25 + Math.random() * 0.1);
          const africaValue = value * (0.15 + Math.random() * 0.1);
          const latamValue = value * (0.15 + Math.random() * 0.1);
          const asiaValue = value - usaValue - europeValue - africaValue - latamValue;
          
          regions.USA.push(usaValue);
          regions.Europe.push(europeValue);
          regions.Africa.push(africaValue);
          regions.LatAm.push(latamValue);
          regions.Asia.push(asiaValue);
        }
        
        // Calculate percent change (last 30 days)
        const percentChange = ((values[values.length - 1] - values[0]) / values[0]) * 100;
        
        // Calculate volatility (standard deviation of daily returns)
        const dailyReturns = [];
        for (let i = 1; i < values.length; i++) {
          const dailyReturn = (values[i] - values[i - 1]) / values[i - 1];
          dailyReturns.push(dailyReturn);
        }
        
        const meanReturn = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
        const squaredDiffs = dailyReturns.map(val => Math.pow(val - meanReturn, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized volatility in percent
        
        const result = {
          dates,
          values,
          regions,
          percentChange,
          volatility,
        };
        
        setData(result);
        
        // Cache the result
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: result,
            timestamp: Date.now(),
          }));
        } catch (e) {
          console.warn('Error caching historical data:', e);
        }
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error fetching historical data:', err);
        setError(err.message || 'Failed to fetch historical data');
        setIsLoading(false);
      }
    };
    
    fetchHistoricalData();
  }, [address]);
  
  return { data, isLoading, error };
}

import { useState, useEffect } from 'react';
import type { AssetRegion } from '../config';

interface HistoricalData {
  dates: string[];
  values: number[];
  regions: Record<AssetRegion, number[]>;
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
      Global: [],
      Commodities: [],
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
        
        // If no cache, we currently have no live API for historical data in this demo version.
        // We simply return the empty state rather than generating mock data.
        // In a real implementation, this would fetch from an API or blockchain indexer.
        
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

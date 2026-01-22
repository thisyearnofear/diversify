/**
 * Data Freshness Hook
 * Provides information about data source reliability and last update times
 */

import { useState, useEffect } from 'react';

interface DataFreshnessInfo {
  source: string;
  lastUpdated: string;
  ageInHours: number;
  isFresh: boolean;
  reliability: 'high' | 'medium' | 'low';
  warning?: string;
}

const SOURCE_RELIABILITY: Record<string, 'high' | 'medium' | 'low'> = {
  'statbureau': 'high',
  'tradingeconomics': 'high',
  'fred': 'high',
  'worldbank': 'medium',
  'cache': 'medium',
  'fallback': 'low'
};

const FRESHNESS_THRESHOLDS = {
  high: 24,    // hours - considered fresh
  medium: 168, // hours (1 week) - acceptable
  low: 720     // hours (1 month) - stale
};

export function useDataFreshness(lastUpdated: string, source: string): DataFreshnessInfo {
  const [freshnessInfo, setFreshnessInfo] = useState<DataFreshnessInfo>({
    source: '',
    lastUpdated: '',
    ageInHours: 0,
    isFresh: false,
    reliability: 'low'
  });

  useEffect(() => {
    if (!lastUpdated) {
      setFreshnessInfo({
        source,
        lastUpdated: 'Unknown',
        ageInHours: Infinity,
        isFresh: false,
        reliability: SOURCE_RELIABILITY.fallback,
        warning: 'Data freshness unknown'
      });
      return;
    }

    const updateTime = new Date(lastUpdated);
    const currentTime = new Date();
    const ageInHours = (currentTime.getTime() - updateTime.getTime()) / (1000 * 60 * 60);
    
    const reliability = SOURCE_RELIABILITY[source.split(' ')[0].toLowerCase()] || 'low';
    const isFresh = ageInHours <= FRESHNESS_THRESHOLDS.high;

    let warning: string | undefined;
    if (ageInHours > FRESHNESS_THRESHOLDS.low) {
      warning = 'Data is very stale (> 1 month old)';
    } else if (ageInHours > FRESHNESS_THRESHOLDS.medium) {
      warning = 'Data may be outdated (> 1 week old)';
    } else if (source.includes('fallback')) {
      warning = 'Using backup data sources';
    }

    setFreshnessInfo({
      source,
      lastUpdated: updateTime.toLocaleString(),
      ageInHours: Math.round(ageInHours),
      isFresh,
      reliability,
      warning
    });
  }, [lastUpdated, source]);

  return freshnessInfo;
}

// Utility functions for displaying freshness information
export function formatLastUpdated(lastUpdated: string): string {
  if (!lastUpdated) return 'Unknown';
  
  const date = new Date(lastUpdated);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 1) return 'Less than 1 hour ago';
  if (diffHours < 24) return `${Math.round(diffHours)} hours ago`;
  if (diffHours < 168) return `${Math.round(diffHours / 24)} days ago`;
  return date.toLocaleDateString();
}

export function getDataQualityScore(source: string, ageInHours: number): number {
  let score = 0;
  
  // Source reliability (0-50 points)
  const reliabilityScores: Record<string, number> = {
    'high': 50,
    'medium': 30,
    'low': 10
  };
  const reliability = SOURCE_RELIABILITY[source.split(' ')[0].toLowerCase()] || 'low';
  score += reliabilityScores[reliability] || 10;
  
  // Data freshness (0-50 points)
  if (ageInHours <= 24) score += 50;
  else if (ageInHours <= 168) score += 30;
  else if (ageInHours <= 720) score += 10;
  
  return Math.min(100, Math.max(0, score));
}
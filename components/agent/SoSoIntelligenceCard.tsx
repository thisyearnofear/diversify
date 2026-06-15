/**
 * SoSoValue Intelligence Card
 * 
 * Displays market intelligence from SoSoValue API as an inline card
 * in the AI chat interface. Shows sentiment, news headlines, and
 * provides quick actions for trade proposals.
 * 
 * Part of the Buildathon "News-to-Action Autopilot" concept.
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface SoSoNewsItem {
  id: string;
  title: string;
  summary: string;
  sentiment: number; // 0-100, >50 = bullish
  tags: string[];
  source: string;
  publishedAt: string;
  url?: string;
}

export interface SoSoMarketData {
  marketSentiment: number;
  btcDominance: number;
  totalMcap: number;
  fearGreedIndex?: number;
  topCoins?: Array<{ symbol: string; change24h: number }>;
}

export interface SoSoSSIIndex {
  name: string;
  value: number;
  change24h: number;
  momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN';
}

export interface SoSoIntelligenceData {
  news: SoSoNewsItem[];
  market: SoSoMarketData;
  ssiIndex?: SoSoSSIIndex;
  timestamp: string;
  tier: 'free' | 'premium';
}

interface SoSoIntelligenceCardProps {
  data: SoSoIntelligenceData;
  onProposeTrade?: (newsItem: SoSoNewsItem) => void;
  onAnalyze?: (newsItem: SoSoNewsItem) => void;
  compact?: boolean;
}

function getSentimentBadge(sentiment: number) {
  if (sentiment >= 70) return { emoji: '🟢', label: 'Bullish', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (sentiment >= 55) return { emoji: '🟡', label: 'Slightly Bullish', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
  if (sentiment >= 45) return { emoji: '⚪', label: 'Neutral', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
  if (sentiment >= 30) return { emoji: '🟠', label: 'Slightly Bearish', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
  return { emoji: '🔴', label: 'Bearish', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
}

function getMomentumBadge(momentum: SoSoSSIIndex['momentum']) {
  switch (momentum) {
    case 'STRONG_UP': return { emoji: '📈', label: 'Strong Up', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'UP': return { emoji: '↗️', label: 'Up', className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-500' };
    case 'NEUTRAL': return { emoji: '➡️', label: 'Neutral', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
    case 'DOWN': return { emoji: '↘️', label: 'Down', className: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-500' };
    case 'STRONG_DOWN': return { emoji: '📉', label: 'Strong Down', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

export default function SoSoIntelligenceCard({ 
  data, 
  onProposeTrade, 
  onAnalyze,
  compact = false 
}: SoSoIntelligenceCardProps) {
  const { news, market, ssiIndex, tier } = data;
  const marketSentiment = getSentimentBadge(market.marketSentiment);
  
  if (compact) {
    // Compact view: just the top news item with sentiment
    const topNews = news[0];
    if (!topNews) return null;
    
    const newsSentiment = getSentimentBadge(topNews.sentiment);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">SoSoValue</span>
            {tier === 'premium' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                PRO
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${newsSentiment.className}`}>
            {newsSentiment.emoji} {topNews.sentiment}/100
          </span>
        </div>
        
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
          {topNews.title}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {topNews.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                #{tag}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-gray-400">
            {formatTimeAgo(topNews.publishedAt)}
          </span>
        </div>
      </motion.div>
    );
  }

  // Full view: market overview + multiple news items
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
    >
      {/* Header with market sentiment */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <div>
              <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">SoSoValue</span>
              <span className="text-[10px] text-gray-400 ml-2">Market Intelligence</span>
            </div>
          </div>
          {tier === 'premium' && (
            <span className="text-[10px] font-bold px-2 py-1 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
              PRO ✦ SSI
            </span>
          )}
        </div>
        
        {/* Market overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Sentiment</p>
            <div className="flex items-center gap-1">
              <span className="text-base">{marketSentiment.emoji}</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{market.marketSentiment}</span>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">BTC Dominance</p>
            <p className="text-sm font-black text-gray-900 dark:text-white">{market.btcDominance.toFixed(1)}%</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total MCap</p>
            <p className="text-sm font-black text-gray-900 dark:text-white">{formatMarketCap(market.totalMcap)}</p>
          </div>
        </div>
        
        {/* SSI Index (premium) */}
        {ssiIndex && (
          <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-bold mb-0.5">
                  SSI Protocol Index
                </p>
                <p className="text-lg font-black text-gray-900 dark:text-white">
                  {ssiIndex.value.toFixed(2)}
                  <span className="text-xs font-normal text-gray-500 ml-1">
                    {ssiIndex.change24h >= 0 ? '+' : ''}{ssiIndex.change24h.toFixed(2)}%
                  </span>
                </p>
              </div>
              <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${getMomentumBadge(ssiIndex.momentum).className}`}>
                {getMomentumBadge(ssiIndex.momentum).emoji} {getMomentumBadge(ssiIndex.momentum).label}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* News items */}
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Flash News</p>
        {news.map((item) => {
          const sentiment = getSentimentBadge(item.sentiment);
          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.01 }}
              className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
              onClick={() => onAnalyze?.(item)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100 flex-1 line-clamp-2">
                  {item.title}
                </h4>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${sentiment.className}`}>
                  {sentiment.emoji} {item.sentiment}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-gray-500 dark:text-gray-400">
                      #{tag}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-gray-400">
                  {formatTimeAgo(item.publishedAt)}
                </span>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 mt-2">
                {onAnalyze && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(item); }}
                    className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Analyze
                  </button>
                )}
                {onProposeTrade && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onProposeTrade(item); }}
                    className="text-[10px] font-bold px-2 py-1 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    Propose Trade
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50">
        <p className="text-[10px] text-gray-400 text-center">
          Powered by SoSoValue • {formatTimeAgo(data.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}
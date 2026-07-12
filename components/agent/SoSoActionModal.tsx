/**
 * SoSoValue Trade Action Modal
 * 
 * Confirmation modal that appears when user clicks "Propose Trade"
 * on a SoSoValue news item. Shows news summary, proposed order details,
 * risk warning, and SoDEX execution button.
 * 
 * Part of the Buildathon "News-to-Action Autopilot" concept.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SoSoNewsItem } from './SoSoIntelligenceCard';
import { Scrim } from '@/components/shared/Scrim';

export interface SoSoTradeProposal {
  newsItem: SoSoNewsItem;
  suggestedAction: 'BUY' | 'SELL' | 'HOLD';
  suggestedPair?: string;
  suggestedAmount?: string;
  confidence: number;
  reasoning?: string;
}

interface SoSoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: SoSoTradeProposal | null;
  onConfirm: (proposal: SoSoTradeProposal) => void;
  onViewDetails?: (newsItem: SoSoNewsItem) => void;
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment >= 70) return 'Strong Bullish';
  if (sentiment >= 55) return 'Bullish';
  if (sentiment >= 45) return 'Neutral';
  if (sentiment >= 30) return 'Bearish';
  return 'Strong Bearish';
}

export default function SoSoActionModal({
  isOpen,
  onClose,
  proposal,
  onConfirm,
  onViewDetails
}: SoSoActionModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'submitted'>('idle');

  if (!proposal) return null;

  const { newsItem, suggestedAction, suggestedPair, suggestedAmount, confidence, reasoning } = proposal;
  const sentimentPercent = newsItem.sentiment;
  const sentimentLabel = getSentimentLabel(sentimentPercent);
  
  const isBullish = sentimentPercent >= 55;
  const actionColor = suggestedAction === 'BUY' 
    ? 'text-green-600 bg-green-50 dark:bg-green-900/20' 
    : suggestedAction === 'SELL'
    ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
    : 'text-gray-600 bg-gray-50 dark:bg-gray-800';

  const handleConfirm = async () => {
    setStatus('loading');
    // Simulate a brief loading state
    await new Promise(resolve => setTimeout(resolve, 1000));
    setStatus('submitted');
    onConfirm(proposal);
  };

  const handleClose = () => {
    setStatus('idle');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <Scrim intensity="light" onClick={handleClose} />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-4 top-auto md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">S</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Propose Trade</p>
                      <p className="text-[10px] text-gray-500">SoSoValue Intelligence</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4 space-y-4">
                {/* News Summary */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isBullish ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'}`}>
                      {isBullish ? '🟢' : '🔴'} {sentimentLabel}
                    </span>
                    <span className="text-[10px] text-gray-400">{newsItem.sentiment}/100</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {newsItem.title}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {newsItem.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Suggested Trade */}
                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Suggested Action</p>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${actionColor}`}>
                      <span className="text-2xl font-black">
                        {suggestedAction === 'BUY' ? '↑' : suggestedAction === 'SELL' ? '↓' : '→'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className={`text-lg font-black ${suggestedAction === 'BUY' ? 'text-green-600' : suggestedAction === 'SELL' ? 'text-red-600' : 'text-gray-600'}`}>
                        {suggestedAction}
                      </p>
                      {suggestedPair && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{suggestedPair}</p>
                      )}
                      {suggestedAmount && (
                        <p className="text-xs text-gray-500">Est. amount: {suggestedAmount}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Confidence</p>
                      <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                        {confidence}%
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Reasoning (if available) */}
                {reasoning && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold mb-1">AI Reasoning</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{reasoning}</p>
                  </div>
                )}
                
                {/* Risk Warning */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Risk Disclaimer</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
                        This is not financial advice. Market sentiment can change rapidly. 
                        Always do your own research before executing trades.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-3">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(newsItem)}
                    className="flex-1 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    View Full Article
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={status !== 'idle'}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    suggestedAction === 'BUY' 
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                      : suggestedAction === 'SELL'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {status === 'idle' && `Execute ${suggestedAction}`}
                  {status === 'loading' && (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        ⚙️
                      </motion.span>
                      Processing...
                    </span>
                  )}
                  {status === 'submitted' && '✓ Sent to SoDEX'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
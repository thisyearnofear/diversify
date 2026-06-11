/**
 * Recommendation Ledger Decorator for AI Service
 * Wraps successful AI responses with automatic recording to the on-chain ledger
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult
} from '../types';
// We'll use dynamic import for the recommendation ledger to avoid circular deps
// The actual import will be resolved at runtime

export class RecommendationLedgerDecorator {
  /**
   * Determines if a response should be recorded to the recommendation ledger
   * Based on content keywords that indicate recommendations or strategies
   */
  private shouldRecordToLedger(options: ChatCompletionOptions, result: string): boolean {
    const contentToCheck = (options.messages || []).map(m => m.content || '').join(' ') + ' ' + result;
    const lowerContent = contentToCheck.toLowerCase();
    
    // Record if contains keywords indicating recommendations, strategies, or actions
    const recordKeywords = [
      'recommend', 'suggest', 'advise', 'propose', 
      'strategy', 'allocate', 'invest', 'buy', 'sell',
      'swap', 'bridge', 'hedge', 'portfolio', 'rebalance'
    ];
    
    return recordKeywords.some(keyword => lowerContent.includes(keyword));
  }

  async decorateChatCompletion(
    options: ChatCompletionOptions,
    providerCall: () => Promise<ChatCompletionResult>
  ): Promise<ChatCompletionResult> {
    const result = await providerCall();
    
    // Only record on server-side (not in browser)
    if (typeof window === 'undefined' && this.shouldRecordToLedger(options, result.data)) {
      try {
        // Record to recommendation ledger (non-blocking - we don't wait for this)
        this.recordToRecommendationLedger(options, result.data).catch(error => {
          console.warn('[Recommendation Ledger] Failed to record to ledger:', error);
        });
      } catch (error: any) {
        // Don't let recording failures affect the main response
        console.warn('[Recommendation Ledger] Recording preparation failed:', error);
      }
    }
    
    return result;
  }

  private async recordToRecommendationLedger(options: ChatCompletionOptions, result: string): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { recommendationLedgerService } = await import('../../recommendation-ledger.service');
      
      // Extract basic info for the ledger from the result
      // In a real implementation, we'd parse the result to determine action, token, etc.
      const anchor = await recommendationLedgerService.recordRecommendation({
        user: options.user || 'unknown',
        action: 'UNKNOWN',
        targetToken: '',
        reasoning: result.substring(0, 500),
        evidenceCid: '', // Would be from 0G anchoring if applied
        servingModel: options.model ?? 'unknown',
        confidence: 8000
      });
      if (anchor.status === 'failed') {
        console.warn('[Recommendation Ledger] Anchor failed:', anchor.error);
      } else if (anchor.status === 'pending') {
        console.warn('[Recommendation Ledger] Anchor pending confirmation:', anchor.txHash);
      }
    } catch (error: any) {
      console.warn('[Recommendation Ledger] Failed to record recommendation:', error);
    }
  }
}
/**
 * ZeroG Anchoring Decorator for AI Service
 * Wraps successful AI responses with automatic 0G Storage anchoring
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult
} from '../types';
import { zeroGStorageService } from "@diversifi/shared-0g/src/services/storage-service";
// recommendationLedgerService will be imported dynamically to avoid circular deps

export class ZeroGAnchoringDecorator {
  /**
   * Determines if a response should be anchored to 0G
   * Based on content keywords that indicate valuable insights
   */
  private shouldAnchorToZeroG(options: ChatCompletionOptions, result: string): boolean {
    const contentToCheck = (options.messages || []).map(m => m.content || '').join(' ') + ' ' + result;
    const lowerContent = contentToCheck.toLowerCase();
    
    // Anchor if contains keywords indicating analysis, recommendations, or strategy
    const anchorKeywords = [
      'analyze', 'analysis', 'recommend', 'recommendation', 
      'strategy', 'allocate', 'portfolio', 'invest', 'yield',
      'risk', 'hedge', 'balance', 'summary', 'outlook'
    ];
    
    return anchorKeywords.some(keyword => lowerContent.includes(keyword));
  }

  async decorateChatCompletion(
    options: ChatCompletionOptions,
    providerCall: () => Promise<ChatCompletionResult>
  ): Promise<ChatCompletionResult> {
    const result = await providerCall();
    
    // Only anchor on server-side (not in browser)
    if (typeof window === 'undefined' && this.shouldAnchorToZeroG(options, result.data)) {
      try {
        // Anchor to 0G Storage (non-blocking - we don't wait for this)
        this.anchorToZeroG(options, result.data).catch(error => {
          console.warn('[ZeroG Anchoring] Failed to anchor to 0G Storage:', error);
        });
        
        // Record to recommendation ledger (non-blocking)
        this.recordToRecommendationLedger(options, result.data).catch(error => {
          console.warn('[ZeroG Anchoring] Failed to record to recommendation ledger:', error);
        });
      } catch (error: any) {
        // Don't let anchoring failures affect the main response
        console.warn('[ZeroG Anchoring] Anchoring preparation failed:', error);
      }
    }
    
    return result;
  }

  private async anchorToZeroG(options: ChatCompletionOptions, result: string): Promise<void> {
    // Create a deterministic anchor content
    const anchorContent = JSON.stringify({
      timestamp: Date.now(),
      model: options.model,
      provider: 'unknown', // Would be set by the service
      messages: options.messages,
      response: result
    });
    
    const { cid, merkleRoot } = await zeroGStorageService.uploadEvidence(anchorContent, { agent: 'ai-service', source: 'zero-g-anchoring-decorator', timestamp: Date.now() }) as any;
    
    // In a real implementation, we'd return this info to be included in the result
    // For now, we just perform the anchoring side-effect
  }

  private async recordToRecommendationLedger(options: ChatCompletionOptions, result: string): Promise<void> {
    // Only record if this looks like a recommendation
    const contentToCheck = (options.messages || []).map(m => m.content || '').join(' ') + ' ' + result;
    const lowerContent = contentToCheck.toLowerCase();
    
    const recommendationKeywords = ['recommend', 'strategy', 'allocate', 'invest'];
    const isRecommendation = recommendationKeywords.some(keyword => lowerContent.includes(keyword));
    
    if (isRecommendation) {
      try {
        // Dynamic import to avoid circular dependencies
        const { recommendationLedgerService } = await import('../../recommendation-ledger.service');
        
        // Extract basic info for the ledger
        await recommendationLedgerService.recordRecommendation({
          user: options.user || 'unknown',
          action: 'UNKNOWN',
          targetToken: '',
          reasoning: result.substring(0, 500),
          evidenceCid: '', // Would be from anchorToZeroG
          servingModel: options.model ?? 'unknown',
          confidence: 8000
        });
      } catch (error: any) {
        console.warn('[ZeroG Anchoring] Failed to record recommendation:', error);
      }
    }
  }
}
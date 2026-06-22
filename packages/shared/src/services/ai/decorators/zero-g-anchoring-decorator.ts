/**
 * ZeroG Anchoring Decorator for AI Service
 *
 * Wraps high-value AI responses with automatic 0G Storage anchoring and
 * records a commitment on the chain-aware RecommendationLedger (0G Galileo
 * today, 0G mainnet canonical in Wave 3; Arbitrum retained as a mirror).
 *
 * Flow:
 *   1. Provider returns a response.
 *   2. If the response looks like a recommendation AND confidence ≥ 0.6,
 *      an encrypted evidence bundle is uploaded to 0G Storage. The returned
 *      CID is captured.
 *    3. The bundle hash + 0G CID + parsed action metadata are recorded on
 *      the RecommendationLedger (with an optional cross-chain mirror).
 */

import {
  ChatCompletionOptions,
  ChatCompletionResult
} from '../types';
import { zeroGStorageService } from "@diversifi/shared-0g/src/services/storage-service";
// recommendationLedgerService is imported dynamically to avoid circular deps

interface AnchorPayload {
  cid: string;
}

export class ZeroGAnchoringDecorator {
  /**
   * Cheap pre-filter: returns true if the response likely commits to a
   * concrete action AND confidence is high enough to warrant on-chain
   * anchoring. This is the pre-upload gate — we skip 0G Storage
   * entirely for prose-only replies or low-confidence responses.
   *
   * The keyword list is intentionally tight: only action verbs that map
   * to a real on-chain action. Words like "analyze" or "summary" used to
   * be in here and fired on nearly every chat reply — Phase 0 audit
   * finding A2 (2026-06) tightened this to action-only + confidence gate.
   */
  private shouldAnchorToZeroG(options: ChatCompletionOptions, result: ChatCompletionResult): boolean {
    const confidence = (result as any).confidence ?? 0.8;
    if (confidence < 0.6) {
      return false;
    }

    const contentToCheck = (options.messages || []).map(m => m.content || '').join(' ') + ' ' + result.data;
    const lowerContent = contentToCheck.toLowerCase();

    const anchorKeywords = [
      'recommend', 'recommendation', 'strategy', 'strategies',
      'allocate', 'allocation', 'rebalance', 'swap', 'exchange',
      'deposit', 'withdraw', 'invest', 'hedge', 'protect',
    ];

    return anchorKeywords.some(keyword => lowerContent.includes(keyword));
  }

  async decorateChatCompletion(
    options: ChatCompletionOptions,
    providerCall: () => Promise<ChatCompletionResult>
  ): Promise<ChatCompletionResult> {
    const result = await providerCall();

    // Only anchor on server-side (not in browser)
    if (typeof window === 'undefined' && this.shouldAnchorToZeroG(options, result)) {
      try {
        // Anchor to 0G Storage and record the resulting CID on Arbitrum.
        // Fire-and-forget intentionally: the user should not wait for storage.
        this.anchorAndRecord(options, result).catch(error => {
          console.warn('[ZeroG Anchoring] Failed to anchor/record:', error);
        });
      } catch (error: any) {
        // Don't let anchoring failures affect the main response
        console.warn('[ZeroG Anchoring] Anchoring preparation failed:', error);
      }
    }

    return result;
  }

  private async anchorAndRecord(
    options: ChatCompletionOptions,
    result: ChatCompletionResult,
  ): Promise<void> {
    const contentToCheck = (options.messages || []).map(m => m.content || '').join(' ') + ' ' + result.data;
    const lowerContent = contentToCheck.toLowerCase();

    // Action verbs only — same set as shouldAnchorToZeroG above, but
    // applied as a defence-in-depth check before the (costly) 0G Storage
    // upload. The outer shouldAnchorToZeroG already gates the upload
    // path; this second check would only fire if the outer were
    // bypassed. Phase 0 audit finding A2 (2026-06) — anchored on action
    // keywords, not prose keywords.
    const recommendationKeywords = ['recommend', 'strategy', 'allocate', 'invest', 'rebalance', 'swap', 'deposit', 'withdraw', 'hedge', 'protect'];
    const isRecommendation = recommendationKeywords.some(keyword => lowerContent.includes(keyword));

    if (!isRecommendation) {
      return;
    }

    // 1. Build and upload the evidence bundle to 0G Storage.
    const { action, targetToken } = this.extractActionMetadata(result.data, options);
    const evidenceBundle = JSON.stringify({
      timestamp: Date.now(),
      model: options.model,
      provider: result.provider ?? 'unknown',
      messages: options.messages,
      response: result.data,
      parsedAction: action,
      parsedTarget: targetToken,
    });

    const anchor = await this.anchorToZeroG(options, evidenceBundle);

    // 2. Record the evidence CID + bundle hash on the canonical ledger.
    await this.recordToRecommendationLedger({
      options,
      result,
      action,
      targetToken,
      evidenceCid: anchor?.cid ?? '',
      reasoning: evidenceBundle,
    });
  }

  private async anchorToZeroG(
    options: ChatCompletionOptions,
    evidenceBundle: string,
  ): Promise<AnchorPayload | null> {
    try {
      const { cid, merkleRoot } = await zeroGStorageService.uploadEvidence(
        evidenceBundle,
        {
          agent: 'ai-service',
          source: 'zero-g-anchoring-decorator',
          timestamp: Date.now(),
        },
      ) as { cid?: string; merkleRoot?: string };

      if (!cid) {
        console.warn('[ZeroG Anchoring] 0G upload did not return a CID');
        return null;
      }

      console.log('[ZeroG Anchoring] Evidence anchored:', cid, 'root:', merkleRoot);
      return { cid };
    } catch (error: any) {
      console.warn('[ZeroG Anchoring] Failed to anchor evidence:', error.message);
      return null;
    }
  }

  private async recordToRecommendationLedger(params: {
    options: ChatCompletionOptions;
    result: ChatCompletionResult;
    action: string;
    targetToken: string;
    evidenceCid: string;
    reasoning: string;
  }): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { recommendationLedgerService } = await import('../../recommendation-ledger.service');

      const anchor = await recommendationLedgerService.recordRecommendation({
        user: params.options.user || 'unknown',
        action: params.action,
        targetToken: params.targetToken,
        reasoning: params.reasoning,
        evidenceCid: params.evidenceCid,
        servingModel: params.options.model ?? params.result.provider ?? 'unknown',
        confidence: Math.round(((params.result as any).confidence ?? 0.8) * 10000),
      });

      if (anchor.status === 'failed') {
        console.warn('[ZeroG Anchoring] Ledger anchor failed:', anchor.error);
      } else if (anchor.status === 'pending') {
        console.warn('[ZeroG Anchoring] Ledger anchor pending confirmation:', anchor.txHash);
      } else {
        console.log('[ZeroG Anchoring] Ledger anchor success:', anchor.txHash, 'id:', anchor.id);
      }
    } catch (error: any) {
      console.warn('[ZeroG Anchoring] Failed to record recommendation:', error);
    }
  }

  /**
   * Naive but useful extraction of action + target token from an AI response.
   * Improves the on-chain ledger's searchability without requiring a full
   * parser. Future iterations can use a structured JSON mode from the model.
   */
  private extractActionMetadata(
    response: string,
    options: ChatCompletionOptions,
  ): { action: string; targetToken: string } {
    const lower = response.toLowerCase();
    const userMessage = (options.messages || []).slice(-1)[0]?.content?.toLowerCase() || '';

    let action = 'UNKNOWN';
    if (lower.includes('allocate') || userMessage.includes('allocate')) action = 'ALLOCATE';
    else if (lower.includes('rebalance') || userMessage.includes('rebalance')) action = 'REBALANCE';
    else if (lower.includes('deposit') || userMessage.includes('deposit')) action = 'DEPOSIT';
    else if (lower.includes('withdraw') || userMessage.includes('withdraw')) action = 'WITHDRAW';
    else if (lower.includes('swap') || userMessage.includes('swap')) action = 'SWAP';
    else if (lower.includes('hold') || userMessage.includes('hold')) action = 'HOLD';

    // Try to find an address or ticker in the response.
    const addressMatch = response.match(/0x[a-fA-F0-9]{40}/);
    const tickerMatch = response.match(/\b([A-Z]{2,10})\b/g);

    const knownStables = ['USDC', 'USDT', 'DAI', 'cUSD', 'cEUR', 'EURC', 'USDY', 'PAXG', 'SYRUPUSDC', 'MXNB'];
    const targetToken = addressMatch?.[0] ||
      (tickerMatch?.find(t => knownStables.includes(t)) ?? '');

    return { action, targetToken };
  }
}

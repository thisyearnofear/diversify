/**
 * Caching Decorator for AI Service
 * Wraps AI provider calls with caching behavior
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult
} from '../types';
import { unifiedCache } from "../../../utils/unified-cache-service";
import { generateCacheKey, hashString } from "../ai-service"; // We'll move these utils

export class CachingDecorator {
  constructor(private ttlCategory: 'volatile' | 'moderate' | 'stable' | 'static' = 'volatile') {}

  async decorateChatCompletion(
    options: ChatCompletionOptions,
    providerCall: () => Promise<ChatCompletionResult>
  ): Promise<ChatCompletionResult> {
    const cacheKey = `ai:chat:${hashString(JSON.stringify(options))}`;
    const cacheResult = await unifiedCache.getOrFetch(cacheKey, () => providerCall() as any, this.ttlCategory);
    return cacheResult as any as ChatCompletionResult;
  }

  async decorateSpeech(
    options: TTSOptions,
    providerCall: () => Promise<TTSResult>
  ): Promise<TTSResult> {
    const cacheKey = `ai:speech:${hashString(JSON.stringify(options))}`;
    const speechResult = await unifiedCache.getOrFetch(cacheKey, () => providerCall() as any, 'moderate');
    return speechResult as any as TTSResult;
  }

  async decorateTranscription(
    filePath: string,
    providerCall: () => Promise<TranscriptionResult>
  ): Promise<TranscriptionResult> {
    // For transcription, we might want to cache based on file content hash
    // For simplicity, we'll use file path + modification time in a real implementation
    const cacheKey = `ai:transcribe:${hashString(filePath)}`;
    const transcribeResult = await unifiedCache.getOrFetch(cacheKey, () => providerCall() as any, 'volatile');
    return transcribeResult as any as TranscriptionResult;
  }
}
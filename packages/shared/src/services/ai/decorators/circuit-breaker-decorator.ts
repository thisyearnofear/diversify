/**
 * Circuit Breaker Decorator for AI Service
 * Wraps AI provider calls with circuit breaker behavior
 */

import { 
  ChatCompletionOptions, 
  ChatCompletionResult, 
  TTSOptions, 
  TTSResult, 
  TranscriptionResult
} from '../types';
import { circuitBreakerManager } from "../../../utils/circuit-breaker-service";

export class CircuitBreakerDecorator {
  constructor(private providerName: string) {}

  async decorateChatCompletion(
    options: ChatCompletionOptions,
    providerCall: () => Promise<ChatCompletionResult>
  ): Promise<ChatCompletionResult> {
    // Get or create circuit breaker for this provider
    const breakerName = `ai-${this.providerName}-chat`;
    const circuitBreaker = circuitBreakerManager.getCircuit(breakerName, {
      failureThreshold: 3,
      timeout: 12000, // 12 seconds
      successThreshold: 2
    });

    return await circuitBreaker.call(() => providerCall());
  }

  async decorateSpeech(
    options: TTSOptions,
    providerCall: () => Promise<TTSResult>
  ): Promise<TTSResult> {
    // Get or create circuit breaker for this provider
    const breakerName = `ai-${this.providerName}-speech`;
    const circuitBreaker = circuitBreakerManager.getCircuit(breakerName, {
      failureThreshold: 3,
      timeout: 20000, // 20 seconds for TTS
      successThreshold: 2
    });

    return await circuitBreaker.call(() => providerCall());
  }

  async decorateTranscription(
    filePath: string,
    providerCall: () => Promise<TranscriptionResult>
  ): Promise<TranscriptionResult> {
    // Get or create circuit breaker for this provider
    const breakerName = `ai-${this.providerName}-transcribe`;
    const circuitBreaker = circuitBreakerManager.getCircuit(breakerName, {
      failureThreshold: 3,
      timeout: 30000, // 30 seconds for transcription
      successThreshold: 2
    });

    return await circuitBreaker.call(() => providerCall());
  }
}
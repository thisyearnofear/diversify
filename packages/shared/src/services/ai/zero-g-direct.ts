/**
 * 0G Compute Direct — TEE-verified inference via the 0G Router.
 *
 * 0G's wallet SDK Direct path (per-provider sub-accounts, processResponse)
 * pulls ethers v6 and nested @noble/hashes copies that break the test
 * collect graph. The Router's `verify_tee: true` extension is the live
 * TEE-verified inference API that uses the same ZERO_G_SERVING_API_KEY
 * we already hold. Independent SDK verification is a later workstream.
 *
 * Gate: confidence > 0.8 or an explicit useDirectCompute flag.
 * Timeout: 15s (TEE proofs add latency; the Router path stays at 30s).
 */

import type { ChatCompletionOptions } from './types';

export const ZERO_G_DIRECT_CONFIDENCE_GATE = 0.8;
export const ZERO_G_DIRECT_TIMEOUT_MS = 15_000;
export const ZERO_G_ROUTER_TIMEOUT_MS = 30_000;
export const ZERO_G_ROUTER_BASE_URL = 'https://router-api.0g.ai/v1';

export function shouldUseZeroGDirectCompute(
  options: ChatCompletionOptions,
): boolean {
  if (options.useDirectCompute === true) return true;
  return (
    typeof options.confidence === 'number' &&
    options.confidence > ZERO_G_DIRECT_CONFIDENCE_GATE
  );
}

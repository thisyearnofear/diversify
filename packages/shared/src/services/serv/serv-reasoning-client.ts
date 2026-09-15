/**
 * SERV Reasoning client — OpenAI-compatible Chat Completions over
 * https://inference-api.openserv.ai/v1/chat/completions.
 *
 * Server-only. `SERV_API_KEY` is never bundled to the client and never
 * logged. The caller (rwa-allocator) owns all fallback behavior — this
 * wrapper returns a typed result and never throws to its caller.
 */

import { fetchWithTimeout } from '../../utils/promise-utils';

export interface ServUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type ServCallResult =
  | { ok: true; text: string; model: string; effort: string; latencyMs: number; usage?: ServUsage }
  | { ok: false; reason: string; status?: number };

export function isServConfigured(): boolean {
  const enabled = (process.env.SERV_ENABLED ?? 'true').trim().toLowerCase();
  if (enabled === 'false' || enabled === '0' || enabled === 'off') return false;
  return typeof process.env.SERV_API_KEY === 'string' && process.env.SERV_API_KEY.trim().length > 0;
}

const DEFAULT_BASE = 'https://inference-api.openserv.ai';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const DEFAULT_TIMEOUT_MS = 8_000;

function servConfig() {
  return {
    apiKey: (process.env.SERV_API_KEY ?? '').trim(),
    baseUrl: (process.env.SERV_BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, ''),
    model: (process.env.SERV_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    effort: (process.env.SERV_REASONING_EFFORT ?? 'medium').trim() || 'medium',
    timeoutMs: Math.max(1_000, Number(process.env.SERV_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  };
}

export async function callServReasoning(opts: {
  system: string;
  user: string;
}): Promise<ServCallResult> {
  const cfg = servConfig();
  if (!cfg.apiKey) return { ok: false, reason: 'serv_not_configured' };

  const started = Date.now();
  try {
    const res = await fetchWithTimeout(
      `${cfg.baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
          reasoning_effort: cfg.effort,
          temperature: 0.2,
          max_tokens: 800,
        }),
      },
      cfg.timeoutMs,
    );

    const latencyMs = Date.now() - started;
    if (!res.ok) {
      // Never leak response bodies upstream — they can echo request content.
      const reason = res.status === 401 || res.status === 403
        ? 'serv_auth_failed'
        : res.status === 429
          ? 'serv_rate_limited'
          : `serv_http_${res.status}`;
      return { ok: false, reason, status: res.status };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: 'serv_empty_response' };

    const usage: ServUsage | undefined = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined;

    return {
      ok: true,
      text,
      model: data.model ?? cfg.model,
      effort: cfg.effort,
      latencyMs,
      usage,
    };
  } catch (err) {
    const reason =
      err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))
        ? 'serv_timeout'
        : 'serv_network_error';
    return { ok: false, reason };
  }
}

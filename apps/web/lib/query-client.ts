/**
 * The app's React Query policy — one place, so every query client (today
 * only the wallet host's, used by wagmi) behaves the same on a flaky network.
 *
 * - Queries pause while offline (`networkMode: 'online'`) and resume on
 *   reconnect instead of burning retries against a dead connection.
 * - Retries: at most 2, exponential backoff capped at 8s, and never for
 *   4xx responses — a bad request won't get better by asking again.
 * - Mutations never retry. A mutation here may be a signature or a
 *   transaction; replaying one silently is how double-submits happen.
 */
import { QueryClient } from "@tanstack/react-query";

const MAX_QUERY_RETRIES = 2;

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: unknown; response?: { status?: unknown } };
  const status = typeof e.status === "number" ? e.status : e.response?.status;
  return typeof status === "number" ? status : null;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = statusOf(error);
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "online",
        retry: shouldRetryQuery,
        retryDelay: retryDelayMs,
        staleTime: 30_000,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: "online",
        retry: false,
      },
    },
  });
}

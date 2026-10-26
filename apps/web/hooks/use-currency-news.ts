import { useEffect, useState } from 'react';
import type { CurrencyNewsItem } from '@/lib/currency-news';
import { apiUrl } from '@/lib/api-url';

// Session-scoped: the route is cached at the edge too, but a re-opened
// inspector shouldn't refetch or flash empty.
const cache = new Map<string, CurrencyNewsItem[]>();

/** Cited recent news for a currency code. Returns [] while loading and
 *  whenever the feed is unavailable — callers render nothing in that case. */
export function useCurrencyNews(code: string | null): CurrencyNewsItem[] {
  const [fetched, setFetched] = useState<{ code: string; items: CurrencyNewsItem[] } | null>(null);

  useEffect(() => {
    if (!code || cache.has(code)) return;
    const ctrl = new AbortController();
    fetch(apiUrl(`/api/agent/currency-news?code=${encodeURIComponent(code)}`), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { items?: CurrencyNewsItem[] } | null) => {
        const items = Array.isArray(body?.items) ? body.items : [];
        // Empty results aren't cached: a transient miss shouldn't stick.
        if (items.length > 0) cache.set(code, items);
        setFetched({ code, items });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [code]);

  if (!code) return [];
  return cache.get(code) ?? (fetched?.code === code ? fetched.items : []);
}
